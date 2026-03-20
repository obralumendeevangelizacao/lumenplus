"""
Rotas de Retiros — Área do Membro
==================================
GET  /retreats                    — lista retiros visíveis para o usuário logado
GET  /retreats/{id}               — detalhe do retiro + meu status de inscrição
POST /retreats/{id}/register      — inscrever-se no retiro
DELETE /retreats/{id}/my-registration — cancelar minha inscrição
POST /retreats/{id}/my-registration/payment — enviar comprovante de pagamento
"""

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
    OrgUnit,
    Retreat,
    RetreatEligibilityRule,
    RetreatEligibilityRuleType,
    RetreatRegistration,
    RetreatStatus,
    RetreatVisibilityType,
    RegistrationStatus,
    UserPermission,
    UserProfile,
    MembershipStatus,
)
from app.settings import settings

router = APIRouter(prefix="/retreats", tags=["Retreats"])

PERMISSION_MANAGE_RETREATS = "PERMISSION_MANAGE_RETREATS"


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _is_retreat_manager(db, user_id: UUID) -> bool:
    """Verifica se o usuário tem permissão de gerenciar retiros ou é admin/dev."""
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
    """Verifica se o usuário é elegível para um retiro SPECIFIC."""
    if retreat.visibility_type == RetreatVisibilityType.ALL:
        return True

    rules = db.execute(
        select(RetreatEligibilityRule).where(RetreatEligibilityRule.retreat_id == retreat.id)
    ).scalars().all()

    if not rules:
        return True  # sem regras = todos podem

    # Checa se alguma regra bate com o usuário
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
                # Compara o code do item com o code da regra
                from app.db.models import ProfileCatalogItem
                item = db.execute(
                    select(ProfileCatalogItem).where(
                        ProfileCatalogItem.id == profile.vocational_reality_item_id
                    )
                ).scalar_one_or_none()
                if item and item.code == rule.vocational_reality_code:
                    return True
    return False


def _retreat_to_dict(retreat: Retreat, registration: RetreatRegistration | None = None) -> dict:
    rules = [
        {
            "rule_type": r.rule_type.value,
            "org_unit_id": str(r.org_unit_id) if r.org_unit_id else None,
            "vocational_reality_code": r.vocational_reality_code,
        }
        for r in (retreat.eligibility_rules or [])
    ]
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
        "price_brl": retreat.price_brl,
        "visibility_type": retreat.visibility_type.value,
        "eligibility_rules": rules,
        "created_at": retreat.created_at.isoformat(),
    }
    if registration:
        result["my_registration"] = {
            "id": str(registration.id),
            "status": registration.status.value,
            "notes": registration.notes,
            "payment_proof_url": registration.payment_proof_url,
            "payment_submitted_at": registration.payment_submitted_at.isoformat() if registration.payment_submitted_at else None,
            "payment_confirmed_at": registration.payment_confirmed_at.isoformat() if registration.payment_confirmed_at else None,
            "payment_rejection_reason": registration.payment_rejection_reason,
        }
    else:
        result["my_registration"] = None
    return result


def _spots_available(db, retreat: Retreat) -> bool:
    if retreat.max_participants is None:
        return True
    confirmed_count = sum(
        1 for r in retreat.registrations
        if r.status not in (RegistrationStatus.CANCELLED,)
    )
    return confirmed_count < retreat.max_participants


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
        if not _user_eligible_for_retreat(db, current_user.id, retreat):
            continue
        reg = db.execute(
            select(RetreatRegistration).where(
                RetreatRegistration.retreat_id == retreat.id,
                RetreatRegistration.user_id == current_user.id,
            )
        ).scalar_one_or_none()
        result.append(_retreat_to_dict(retreat, reg))

    return {"retreats": result}


@router.get("/{retreat_id}")
async def get_retreat(retreat_id: UUID, current_user: CurrentUser, db: DBSession):
    """Detalhe do retiro + status da minha inscrição."""
    retreat = db.get(Retreat, retreat_id)
    if not retreat or retreat.status not in (RetreatStatus.PUBLISHED, RetreatStatus.CLOSED):
        raise HTTPException(status_code=404, detail={"error": "not_found", "message": "Retiro não encontrado"})

    if not _user_eligible_for_retreat(db, current_user.id, retreat):
        raise HTTPException(status_code=403, detail={"error": "forbidden", "message": "Você não é elegível para este retiro"})

    reg = db.execute(
        select(RetreatRegistration).where(
            RetreatRegistration.retreat_id == retreat_id,
            RetreatRegistration.user_id == current_user.id,
        )
    ).scalar_one_or_none()

    return _retreat_to_dict(retreat, reg)


class RegisterBody(BaseModel):
    notes: str | None = None


@router.post("/{retreat_id}/register", status_code=201)
async def register_for_retreat(retreat_id: UUID, body: RegisterBody, current_user: CurrentUser, db: DBSession):
    """Inscreve o usuário no retiro."""
    retreat = db.get(Retreat, retreat_id)
    if not retreat or retreat.status != RetreatStatus.PUBLISHED:
        raise HTTPException(status_code=404, detail={"error": "not_found", "message": "Retiro não encontrado ou não está aberto"})

    if not _user_eligible_for_retreat(db, current_user.id, retreat):
        raise HTTPException(status_code=403, detail={"error": "forbidden", "message": "Você não é elegível para este retiro"})

    existing = db.execute(
        select(RetreatRegistration).where(
            RetreatRegistration.retreat_id == retreat_id,
            RetreatRegistration.user_id == current_user.id,
        )
    ).scalar_one_or_none()
    if existing and existing.status != RegistrationStatus.CANCELLED:
        raise HTTPException(status_code=409, detail={"error": "already_registered", "message": "Você já está inscrito neste retiro"})

    # Verifica vagas
    if not _spots_available(db, retreat):
        # Coloca em lista de espera
        status = RegistrationStatus.WAITLIST
    else:
        status = RegistrationStatus.PENDING_PAYMENT

    if existing:
        # Reativar inscrição cancelada
        existing.status = status
        existing.notes = body.notes
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
        )
        db.add(reg)

    db.commit()
    db.refresh(reg)

    return {
        "id": str(reg.id),
        "status": reg.status.value,
        "message": "Inscrição realizada com sucesso" if status != RegistrationStatus.WAITLIST else "Vagas esgotadas — você foi adicionado à lista de espera",
    }


@router.delete("/{retreat_id}/my-registration", status_code=200)
async def cancel_my_registration(retreat_id: UUID, current_user: CurrentUser, db: DBSession):
    """Cancela a inscrição do usuário no retiro."""
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

    # Valida tipo do arquivo
    if not file.content_type or not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail={"error": "invalid_file", "message": "Apenas imagens são aceitas"})

    # Configura e envia ao Cloudinary
    cloudinary.config(
        cloud_name=settings.cloudinary_cloud_name,
        api_key=settings.cloudinary_api_key,
        api_secret=settings.cloudinary_api_secret,
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
    except Exception:
        raise HTTPException(status_code=502, detail={"error": "upload_failed", "message": "Falha ao enviar imagem. Tente novamente."})

    reg.payment_proof_url = url
    reg.payment_submitted_at = datetime.now(timezone.utc)
    reg.status = RegistrationStatus.PAYMENT_SUBMITTED
    db.commit()

    return {"message": "Comprovante enviado com sucesso. Aguarde a confirmação do administrador.", "payment_proof_url": url}
