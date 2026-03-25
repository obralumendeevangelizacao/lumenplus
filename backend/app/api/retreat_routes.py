"""
Rotas de Retiros — Área do Membro
==================================
GET  /retreats                    — lista retiros visíveis para o usuário logado
GET  /retreats/{id}               — detalhe do retiro + meu status de inscrição + minha taxa
POST /retreats/{id}/register      — inscrever-se no retiro (com preferência de modalidade)
DELETE /retreats/{id}/my-registration — cancelar minha inscrição
POST /retreats/{id}/my-registration/payment — enviar comprovante de pagamento
"""

import logging
from datetime import datetime, timezone
from uuid import UUID

import cloudinary
import cloudinary.uploader
from fastapi import APIRouter, File, HTTPException, UploadFile
from pydantic import BaseModel
from sqlalchemy import select

from app.api.deps import CurrentUser, DBSession
from app.db.models import (
    OrgMembership,
    ProfileCatalogItem,
    Retreat,
    RetreatEligibilityRule,
    RetreatEligibilityRuleType,
    RetreatFeeType,
    RetreatRegistration,
    RetreatServiceTeam,
    RetreatTeamPreference,
    RetreatStatus,
    RetreatVisibilityType,
    RegistrationStatus,
    UserPermission,
    UserProfile,
    MembershipStatus,
)
from app.settings import settings

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/retreats", tags=["Retreats"])

PERMISSION_MANAGE_RETREATS = "PERMISSION_MANAGE_RETREATS"

FEE_CATEGORY_LABELS = {
    "PARTICIPANTE": "Participante",
    "PARTICIPANTE_MISSAO": "Participante de Missão",
    "PARTICIPANTE_CASAS": "Participante de Casas",
    "PARTICIPANTE_CV": "Participante da Comunidade de Vida",
    "EQUIPE_SERVICO": "Equipe de Serviço",
    "EQUIPE_SERVICO_MISSAO": "Equipe de Serviço de Missão",
    "EQUIPE_SERVICO_CASAS": "Equipe de Serviço de Casas",
    "EQUIPE_SERVICO_CV": "Equipe de Serviço da Comunidade de Vida",
    "HIBRIDO": "Híbrido",
}


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _is_retreat_manager(db, user_id: UUID) -> bool:
    from app.db.models import GlobalRole, UserGlobalRole
    roles = db.execute(
        select(GlobalRole.code)
        .join(UserGlobalRole, UserGlobalRole.global_role_id == GlobalRole.id)
        .where(UserGlobalRole.user_id == user_id)
    ).scalars().all()
    if any(r in ("ADMIN", "DEV") for r in roles):
        return True
    perm = db.execute(
        select(UserPermission).where(
            UserPermission.user_id == user_id,
            UserPermission.permission_code == PERMISSION_MANAGE_RETREATS,
        )
    ).scalar_one_or_none()
    return perm is not None


def _user_eligible_for_retreat(db, user_id: UUID, retreat: Retreat) -> bool:
    if retreat.visibility_type == RetreatVisibilityType.ALL:
        return True

    rules = db.execute(
        select(RetreatEligibilityRule).where(RetreatEligibilityRule.retreat_id == retreat.id)
    ).scalars().all()

    if not rules:
        return True

    for rule in rules:
        if rule.rule_type == RetreatEligibilityRuleType.ORG_UNIT:
            membership = db.execute(
                select(OrgMembership).where(
                    OrgMembership.user_id == user_id,
                    OrgMembership.org_unit_id == rule.org_unit_id,
                    OrgMembership.status == MembershipStatus.ACTIVE,
                )
            ).scalar_one_or_none()
            if membership:
                return True
        elif rule.rule_type == RetreatEligibilityRuleType.VOCATIONAL_REALITY:
            profile = db.execute(
                select(UserProfile).where(UserProfile.user_id == user_id)
            ).scalar_one_or_none()
            if profile and profile.vocational_reality_item_id:
                item = db.execute(
                    select(ProfileCatalogItem).where(
                        ProfileCatalogItem.id == profile.vocational_reality_item_id
                    )
                ).scalar_one_or_none()
                if item and item.code == rule.vocational_reality_code:
                    return True
    return False


def _compute_fee_category(
    retreat_role: str,
    vocational_reality_code: str | None,
    modality: str | None = None,
) -> str:
    """
    Calcula a categoria de taxa.
    Modalidade HIBRIDO tem taxa própria (ignora papel/vocacional).
    """
    if modality == "HIBRIDO":
        return "HIBRIDO"

    voc = (vocational_reality_code or "").upper()
    is_equipe = retreat_role == "EQUIPE_SERVICO"
    prefix = "EQUIPE_SERVICO" if is_equipe else "PARTICIPANTE"

    if "MISSAO" in voc or "MISSÃO" in voc:
        return f"{prefix}_MISSAO"
    if "CASAS" in voc or "CASA" in voc:
        return f"{prefix}_CASAS"
    if "CV" in voc or "COMUNIDADE" in voc or "VIDA" in voc:
        return f"{prefix}_CV"
    return prefix


def _get_user_voc_code(db, user_id: UUID) -> str | None:
    profile = db.execute(
        select(UserProfile).where(UserProfile.user_id == user_id)
    ).scalar_one_or_none()
    if profile and profile.vocational_reality_item_id:
        item = db.execute(
            select(ProfileCatalogItem).where(ProfileCatalogItem.id == profile.vocational_reality_item_id)
        ).scalar_one_or_none()
        if item:
            return item.code
    return None


def _get_user_fee_info(db, user_id: UUID, retreat: Retreat, modality: str | None = None) -> dict | None:
    """
    Retorna a taxa esperada do usuário para o retiro.
    Se modalidade = HÍBRIDO, retorna a taxa HIBRIDO independente de perfil.
    Caso contrário, calcula a partir da realidade vocacional (papel = PARTICIPANTE por padrão).
    """
    voc_code = _get_user_voc_code(db, user_id)
    fee_cat = _compute_fee_category("PARTICIPANTE", voc_code, modality)
    fee_type = db.execute(
        select(RetreatFeeType).where(
            RetreatFeeType.retreat_id == retreat.id,
            RetreatFeeType.fee_category == fee_cat,
        )
    ).scalar_one_or_none()
    return {
        "fee_category": fee_cat,
        "fee_label": FEE_CATEGORY_LABELS.get(fee_cat, fee_cat),
        "amount_brl": fee_type.amount_brl if fee_type else None,
    }


def _user_eligible_as_service(db, user_id: UUID, retreat: Retreat) -> bool:
    """Verifica se o usuário é elegível para a equipe de serviço."""
    service_rules = [r for r in (retreat.eligibility_rules or []) if r.rule_group == "SERVICE"]
    if not service_rules:
        return False  # sem regras de serviço = equipe fechada (convite do admin)

    for rule in service_rules:
        if rule.rule_type == RetreatEligibilityRuleType.ORG_UNIT:
            membership = db.execute(
                select(OrgMembership).where(
                    OrgMembership.user_id == user_id,
                    OrgMembership.org_unit_id == rule.org_unit_id,
                    OrgMembership.status == MembershipStatus.ACTIVE,
                )
            ).scalar_one_or_none()
            if membership:
                return True
        elif rule.rule_type == RetreatEligibilityRuleType.VOCATIONAL_REALITY:
            profile = db.execute(
                select(UserProfile).where(UserProfile.user_id == user_id)
            ).scalar_one_or_none()
            if profile and profile.vocational_reality_item_id:
                item = db.execute(
                    select(ProfileCatalogItem).where(
                        ProfileCatalogItem.id == profile.vocational_reality_item_id
                    )
                ).scalar_one_or_none()
                if item and item.code == rule.vocational_reality_code:
                    return True
    return False


def _available_modalities(retreat: Retreat) -> list[str]:
    """Retorna as modalidades disponíveis com base nas casas do retiro."""
    if not retreat.houses:
        return []
    seen = set()
    result = []
    for h in retreat.houses:
        if h.modality not in seen:
            seen.add(h.modality)
            result.append(h.modality)
    return result


def _retreat_to_dict(
    retreat: Retreat,
    registration: RetreatRegistration | None = None,
    user_fee_info: dict | None = None,
    eligible_as_participant: bool = True,
    eligible_as_service: bool = False,
) -> dict:
    result = {
        "id": str(retreat.id),
        "title": retreat.title,
        "description": retreat.description,
        "retreat_type": retreat.retreat_type.value,
        "status": retreat.status.value,
        "start_date": retreat.start_date.isoformat(),
        "end_date": retreat.end_date.isoformat(),
        "location": retreat.location,
        "address": retreat.address,
        "max_participants": retreat.max_participants,
        "visibility_type": retreat.visibility_type.value,
        "available_modalities": _available_modalities(retreat),
        "houses": [
            {"id": str(h.id), "name": h.name, "modality": h.modality, "max_participants": h.max_participants}
            for h in (retreat.houses or [])
        ],
        "fee_types": [
            {
                "fee_category": ft.fee_category,
                "label": FEE_CATEGORY_LABELS.get(ft.fee_category, ft.fee_category),
                "amount_brl": ft.amount_brl,
            }
            for ft in (retreat.fee_types or [])
        ],
        "my_fee": user_fee_info,
        "eligible_as_participant": eligible_as_participant,
        "eligible_as_service": eligible_as_service,
        "created_at": retreat.created_at.isoformat(),
    }
    if registration:
        result["my_registration"] = {
            "id": str(registration.id),
            "status": registration.status.value,
            "modality_preference": registration.modality_preference,
            "retreat_role": registration.retreat_role,
            "fee_category": registration.fee_category,
            "fee_label": FEE_CATEGORY_LABELS.get(registration.fee_category, registration.fee_category) if registration.fee_category else None,
            "assigned_house_id": str(registration.assigned_house_id) if registration.assigned_house_id else None,
            "notes": registration.notes,
            "payment_proof_url": registration.payment_proof_url,
            "payment_submitted_at": registration.payment_submitted_at.isoformat() if registration.payment_submitted_at else None,
            "payment_confirmed_at": registration.payment_confirmed_at.isoformat() if registration.payment_confirmed_at else None,
            "payment_rejection_reason": registration.payment_rejection_reason,
        }
    else:
        result["my_registration"] = None
    return result


def _spots_available(db, retreat: Retreat, modality: str | None = None) -> bool:
    """Verifica vagas globais e, se informado, vagas por modalidade."""
    active_regs = [r for r in retreat.registrations if r.status != RegistrationStatus.CANCELLED]

    # Verifica limite global
    if retreat.max_participants is not None:
        if len(active_regs) >= retreat.max_participants:
            return False

    # Verifica limite por modalidade (soma das capacidades das casas dessa modalidade)
    if modality and retreat.houses:
        modality_houses = [h for h in retreat.houses if h.modality == modality]
        modality_capacity = sum(h.max_participants for h in modality_houses if h.max_participants is not None)
        if modality_capacity > 0:
            modality_regs = sum(1 for r in active_regs if r.modality_preference == modality)
            if modality_regs >= modality_capacity:
                return False

    return True


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@router.get("")
async def list_retreats(current_user: CurrentUser, db: DBSession):
    """Lista retiros publicados visíveis para o usuário logado."""
    retreats = db.execute(
        select(Retreat).where(Retreat.status == RetreatStatus.PUBLISHED)
    ).scalars().all()

    result = []
    for retreat in retreats:
        as_participant = _user_eligible_for_retreat(db, current_user.id, retreat)
        as_service = _user_eligible_as_service(db, current_user.id, retreat)
        if not as_participant and not as_service:
            continue
        reg = db.execute(
            select(RetreatRegistration).where(
                RetreatRegistration.retreat_id == retreat.id,
                RetreatRegistration.user_id == current_user.id,
            )
        ).scalar_one_or_none()
        user_fee = _get_user_fee_info(db, current_user.id, retreat)
        result.append(_retreat_to_dict(retreat, reg, user_fee, as_participant, as_service))

    return {"retreats": result}


@router.get("/{retreat_id}")
async def get_retreat(retreat_id: UUID, current_user: CurrentUser, db: DBSession):
    """Detalhe do retiro + status da minha inscrição + minha taxa."""
    retreat = db.get(Retreat, retreat_id)
    if not retreat or retreat.status not in (RetreatStatus.PUBLISHED, RetreatStatus.CLOSED):
        raise HTTPException(status_code=404, detail={"error": "not_found", "message": "Retiro não encontrado"})

    as_participant = _user_eligible_for_retreat(db, current_user.id, retreat)
    as_service = _user_eligible_as_service(db, current_user.id, retreat)
    if not as_participant and not as_service:
        raise HTTPException(status_code=403, detail={"error": "forbidden", "message": "Você não é elegível para este retiro"})

    reg = db.execute(
        select(RetreatRegistration).where(
            RetreatRegistration.retreat_id == retreat_id,
            RetreatRegistration.user_id == current_user.id,
        )
    ).scalar_one_or_none()

    user_fee = _get_user_fee_info(db, current_user.id, retreat)
    return _retreat_to_dict(retreat, reg, user_fee, as_participant, as_service)


@router.get("/{retreat_id}/service-teams")
async def list_retreat_service_teams(retreat_id: UUID, current_user: CurrentUser, db: DBSession):
    """Lista equipes de serviço disponíveis para o inscrito escolher suas preferências."""
    retreat = db.get(Retreat, retreat_id)
    if not retreat or retreat.status not in (RetreatStatus.PUBLISHED, RetreatStatus.CLOSED):
        raise HTTPException(status_code=404, detail={"error": "not_found", "message": "Retiro não encontrado"})
    teams = db.execute(
        select(RetreatServiceTeam).where(RetreatServiceTeam.retreat_id == retreat_id)
    ).scalars().all()
    result = []
    for team in teams:
        result.append({
            "id": str(team.id),
            "name": team.name,
            "description": team.description,
            "member_count": len(team.members or []),
        })
    return {"service_teams": result}


class RegisterBody(BaseModel):
    notes: str | None = None
    modality_preference: str | None = None   # PRESENCIAL | HIBRIDO
    registration_type: str = "PARTICIPANT"    # PARTICIPANT | SERVICE
    team_preferences: list[UUID] = []         # máx 3, em ordem de preferência (apenas SERVICE)


@router.post("/{retreat_id}/register", status_code=201)
async def register_for_retreat(retreat_id: UUID, body: RegisterBody, current_user: CurrentUser, db: DBSession):
    """Inscreve o usuário no retiro como PARTICIPANTE ou EQUIPE_SERVICO."""
    retreat = db.get(Retreat, retreat_id)
    if not retreat or retreat.status != RetreatStatus.PUBLISHED:
        raise HTTPException(status_code=404, detail={"error": "not_found", "message": "Retiro não encontrado ou não está aberto"})

    # Verifica elegibilidade conforme tipo de inscrição
    if body.registration_type == "SERVICE":
        if not _user_eligible_as_service(db, current_user.id, retreat):
            raise HTTPException(status_code=403, detail={"error": "forbidden", "message": "Você não é elegível para a equipe de serviço deste retiro"})
    else:
        if not _user_eligible_for_retreat(db, current_user.id, retreat):
            raise HTTPException(status_code=403, detail={"error": "forbidden", "message": "Você não é elegível para este retiro"})

    # Valida modalidade
    available_modalities = _available_modalities(retreat)
    modality = body.modality_preference
    if available_modalities:
        if len(available_modalities) > 1 and not modality:
            raise HTTPException(
                status_code=400,
                detail={"error": "modality_required", "message": "Selecione a modalidade de participação"}
            )
        if modality and modality not in available_modalities:
            raise HTTPException(
                status_code=400,
                detail={"error": "invalid_modality", "message": f"Modalidade '{modality}' não disponível neste retiro"}
            )
        if not modality and len(available_modalities) == 1:
            modality = available_modalities[0]

    existing = db.execute(
        select(RetreatRegistration).where(
            RetreatRegistration.retreat_id == retreat_id,
            RetreatRegistration.user_id == current_user.id,
        )
    ).scalar_one_or_none()
    if existing and existing.status != RegistrationStatus.CANCELLED:
        raise HTTPException(status_code=409, detail={"error": "already_registered", "message": "Você já está inscrito neste retiro"})

    # Define retreat_role conforme tipo de inscrição
    retreat_role = "EQUIPE_SERVICO" if body.registration_type == "SERVICE" else "PARTICIPANTE"

    # Calcula fee_category (HIBRIDO tem taxa própria; demais usam papel + vocacional)
    voc_code = _get_user_voc_code(db, current_user.id)
    fee_category = _compute_fee_category(retreat_role, voc_code, modality)

    # Verifica vagas
    if not _spots_available(db, retreat, modality):
        status = RegistrationStatus.WAITLIST
    else:
        status = RegistrationStatus.PENDING_PAYMENT

    if existing:
        existing.status = status
        existing.notes = body.notes
        existing.modality_preference = modality
        existing.fee_category = fee_category
        existing.retreat_role = retreat_role
        existing.cancelled_at = None
        existing.cancelled_by_user_id = None
        existing.payment_proof_url = None
        existing.payment_submitted_at = None
        reg = existing
    else:
        reg = RetreatRegistration(
            retreat_id=retreat_id,
            user_id=current_user.id,
            status=status,
            notes=body.notes,
            modality_preference=modality,
            retreat_role=retreat_role,
            fee_category=fee_category,
        )
        db.add(reg)

    db.commit()
    db.refresh(reg)

    # Salva preferências de equipe (apenas SERVICE, máx 3)
    if body.registration_type == "SERVICE" and body.team_preferences:
        prefs_to_save = body.team_preferences[:3]
        # Remove preferências anteriores desta inscrição
        old_prefs = db.execute(
            select(RetreatTeamPreference).where(RetreatTeamPreference.registration_id == reg.id)
        ).scalars().all()
        for old_p in old_prefs:
            db.delete(old_p)
        db.flush()
        # Valida e persiste as novas preferências
        for order, team_id in enumerate(prefs_to_save, start=1):
            team = db.get(RetreatServiceTeam, team_id)
            if not team or team.retreat_id != retreat_id:
                raise HTTPException(
                    status_code=400,
                    detail={"error": "invalid_team", "message": f"Equipe {team_id} não pertence a este retiro"},
                )
            db.add(RetreatTeamPreference(
                registration_id=reg.id,
                team_id=team_id,
                preference_order=order,
            ))
        db.commit()
        db.refresh(reg)

    # Descobre valor da taxa
    fee_type = db.execute(
        select(RetreatFeeType).where(
            RetreatFeeType.retreat_id == retreat_id,
            RetreatFeeType.fee_category == fee_category,
        )
    ).scalar_one_or_none()

    return {
        "id": str(reg.id),
        "status": reg.status.value,
        "modality_preference": reg.modality_preference,
        "fee_category": reg.fee_category,
        "fee_label": FEE_CATEGORY_LABELS.get(fee_category, fee_category),
        "amount_brl": fee_type.amount_brl if fee_type else None,
        "team_preferences": [
            {"team_id": str(p.team_id), "preference_order": p.preference_order}
            for p in sorted(reg.team_preferences or [], key=lambda p: p.preference_order)
        ],
        "message": (
            "Inscrição realizada com sucesso"
            if status != RegistrationStatus.WAITLIST
            else "Vagas esgotadas — você foi adicionado à lista de espera"
        ),
    }


@router.delete("/{retreat_id}/my-registration", status_code=200)
async def cancel_my_registration(retreat_id: UUID, current_user: CurrentUser, db: DBSession):
    reg = db.execute(
        select(RetreatRegistration).where(
            RetreatRegistration.retreat_id == retreat_id,
            RetreatRegistration.user_id == current_user.id,
        )
    ).scalar_one_or_none()

    if not reg or reg.status == RegistrationStatus.CANCELLED:
        raise HTTPException(status_code=404, detail={"error": "not_found", "message": "Inscrição não encontrada"})

    reg.status = RegistrationStatus.CANCELLED
    reg.cancelled_at = datetime.now(timezone.utc)
    reg.cancelled_by_user_id = current_user.id
    db.commit()

    return {"message": "Inscrição cancelada com sucesso"}


@router.post("/{retreat_id}/my-registration/payment", status_code=200)
async def submit_payment_proof(
    retreat_id: UUID,
    current_user: CurrentUser,
    db: DBSession,
    file: UploadFile = File(...),
):
    """Envia o comprovante de pagamento (imagem) para o Cloudinary."""
    reg = db.execute(
        select(RetreatRegistration).where(
            RetreatRegistration.retreat_id == retreat_id,
            RetreatRegistration.user_id == current_user.id,
        )
    ).scalar_one_or_none()

    if not reg or reg.status == RegistrationStatus.CANCELLED:
        raise HTTPException(status_code=404, detail={"error": "not_found", "message": "Inscrição não encontrada"})

    if reg.status == RegistrationStatus.CONFIRMED:
        raise HTTPException(status_code=409, detail={"error": "already_confirmed", "message": "Pagamento já confirmado"})

    if not file.content_type or not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail={"error": "invalid_file", "message": "Apenas imagens são aceitas"})

    cloudinary.config(
        cloud_name=settings.cloudinary_cloud_name,
        api_key=settings.cloudinary_api_key,
        api_secret=settings.cloudinary_api_secret,
    )

    # Verifica se as credenciais do Cloudinary estão configuradas
    if not settings.cloudinary_cloud_name or not settings.cloudinary_api_key or not settings.cloudinary_api_secret:
        logger.error("Cloudinary credentials not configured. Set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET.")
        raise HTTPException(
            status_code=503,
            detail={"error": "storage_not_configured", "message": "Serviço de armazenamento não configurado. Contate o administrador."},
        )

    try:
        contents = await file.read()
        upload_result = cloudinary.uploader.upload(
            contents,
            folder=f"lumenplus/retreat_payments/{retreat_id}",
            public_id=f"user_{current_user.id}",
            overwrite=True,
            resource_type="image",
        )
        url = upload_result["secure_url"]
    except Exception as exc:
        logger.exception("Cloudinary upload failed: %s", exc)
        raise HTTPException(status_code=502, detail={"error": "upload_failed", "message": "Falha ao enviar imagem. Tente novamente."})

    reg.payment_proof_url = url
    reg.payment_submitted_at = datetime.now(timezone.utc)
    reg.status = RegistrationStatus.PAYMENT_SUBMITTED
    db.commit()

    return {"message": "Comprovante enviado com sucesso. Aguarde a confirmação do administrador.", "payment_proof_url": url}
