"""
Rotas de Retiros — Área Admin
==============================
POST   /admin/retreats                                         — criar retiro (DRAFT)
GET    /admin/retreats                                         — listar todos
GET    /admin/retreats/{id}                                    — detalhe (com casas e taxas)
PATCH  /admin/retreats/{id}                                    — editar
POST   /admin/retreats/{id}/publish                            — publicar (dispara inbox)
POST   /admin/retreats/{id}/close                              — fechar inscrições
POST   /admin/retreats/{id}/cancel                             — cancelar retiro
POST   /admin/retreats/{id}/houses                             — adicionar casa
PUT    /admin/retreats/{id}/houses/{house_id}                  — editar casa
DELETE /admin/retreats/{id}/houses/{house_id}                  — remover casa
POST   /admin/retreats/{id}/fee-types                          — definir taxas (bulk upsert)
GET    /admin/retreats/{id}/registrations                      — lista de inscrições
POST   /admin/retreats/{id}/registrations/{reg}/confirm        — confirmar pagamento
POST   /admin/retreats/{id}/registrations/{reg}/reject         — rejeitar comprovante
PATCH  /admin/retreats/{id}/registrations/{reg}/house          — atribuir casa
PATCH  /admin/retreats/{id}/registrations/{reg}/role           — mudar papel (PARTICIPANTE/EQUIPE)
GET    /admin/retreats/{id}/export                             — exportar CSV
"""

import csv
import io
from datetime import datetime, timezone
from uuid import UUID

from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from sqlalchemy import select

from app.api.deps import CurrentUser, DBSession
from app.db.models import (
    GlobalRole,
    InboxMessage,
    InboxMessageType,
    InboxRecipient,
    OrgMembership,
    Retreat,
    RetreatEligibilityRule,
    RetreatEligibilityRuleType,
    RetreatFeeType,
    RetreatHouse,
    RetreatRegistration,
    RetreatServiceTeam,
    RetreatServiceTeamMember,
    RetreatTeamPreference,
    RetreatStatus,
    RetreatType,
    RetreatVisibilityType,
    RegistrationStatus,
    ServiceTeamRole,
    User,
    UserGlobalRole,
    UserPermission,
    UserProfile,
    MembershipStatus,
)

router = APIRouter(prefix="/admin/retreats", tags=["Admin — Retreats"])

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

ALL_FEE_CATEGORIES = list(FEE_CATEGORY_LABELS.keys())


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _require_retreat_manager(db, user_id: UUID) -> None:
    roles = db.execute(
        select(GlobalRole.code)
        .join(UserGlobalRole, UserGlobalRole.global_role_id == GlobalRole.id)
        .where(UserGlobalRole.user_id == user_id)
    ).scalars().all()
    if any(r in ("ADMIN", "DEV") for r in roles):
        return
    perm = db.execute(
        select(UserPermission).where(
            UserPermission.user_id == user_id,
            UserPermission.permission_code == PERMISSION_MANAGE_RETREATS,
        )
    ).scalar_one_or_none()
    if not perm:
        raise HTTPException(
            status_code=403,
            detail={"error": "forbidden", "message": "Você não tem permissão para gerenciar retiros"},
        )


def _houses_to_list(houses) -> list[dict]:
    return [
        {
            "id": str(h.id),
            "name": h.name,
            "modality": h.modality,
            "max_participants": h.max_participants,
        }
        for h in (houses or [])
    ]


def _fee_types_to_list(fee_types) -> list[dict]:
    return [
        {
            "id": str(ft.id),
            "fee_category": ft.fee_category,
            "label": FEE_CATEGORY_LABELS.get(ft.fee_category, ft.fee_category),
            "amount_brl": ft.amount_brl,
        }
        for ft in (fee_types or [])
    ]


def _service_teams_to_list(teams) -> list[dict]:
    result = []
    for team in (teams or []):
        members = []
        for m in (team.members or []):
            reg = m.registration
            members.append({
                "id": str(m.id),
                "registration_id": str(m.registration_id),
                "user_id": str(reg.user_id) if reg else None,
                "user_name": (reg.user.profile.full_name if reg and reg.user and hasattr(reg.user, "profile") else None),
                "role": m.role.value,
                "house_id": str(m.house_id) if m.house_id else None,
                "house_name": m.house.name if m.house else None,
                "created_at": m.created_at.isoformat(),
            })
        result.append({
            "id": str(team.id),
            "name": team.name,
            "description": team.description,
            "members": members,
            "created_at": team.created_at.isoformat(),
        })
    return result


def _rule_to_dict(r) -> dict:
    return {
        "id": str(r.id),
        "rule_type": r.rule_type.value,
        "org_unit_id": str(r.org_unit_id) if r.org_unit_id else None,
        "org_unit_name": r.org_unit.name if r.org_unit else None,
        "vocational_reality_code": r.vocational_reality_code,
        "rule_group": r.rule_group,
    }


def _retreat_to_dict(retreat: Retreat, include_registrations: bool = False) -> dict:
    all_rules = retreat.eligibility_rules or []
    participant_rules = [_rule_to_dict(r) for r in all_rules if r.rule_group == "PARTICIPANT"]
    service_rules     = [_rule_to_dict(r) for r in all_rules if r.rule_group == "SERVICE"]
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
        "participant_eligibility_rules": participant_rules,
        "service_eligibility_rules": service_rules,
        "houses": _houses_to_list(retreat.houses),
        "fee_types": _fee_types_to_list(retreat.fee_types),
        "service_teams": _service_teams_to_list(retreat.service_teams),
        "created_by_user_id": str(retreat.created_by_user_id) if retreat.created_by_user_id else None,
        "created_at": retreat.created_at.isoformat(),
        "updated_at": retreat.updated_at.isoformat(),
    }
    if include_registrations:
        result["registrations_count"] = len([
            r for r in retreat.registrations
            if r.status != RegistrationStatus.CANCELLED
        ])
    return result


def _notify_eligible_users(db, retreat: Retreat) -> None:
    """Envia aviso no inbox para todos os usuários elegíveis ao publicar um retiro."""
    if retreat.visibility_type == RetreatVisibilityType.ALL:
        users = db.execute(select(User).where(User.is_active == True)).scalars().all()
    else:
        rules = db.execute(
            select(RetreatEligibilityRule).where(RetreatEligibilityRule.retreat_id == retreat.id)
        ).scalars().all()

        user_ids: set[UUID] = set()
        for rule in rules:
            if rule.rule_type == RetreatEligibilityRuleType.ORG_UNIT:
                memberships = db.execute(
                    select(OrgMembership).where(
                        OrgMembership.org_unit_id == rule.org_unit_id,
                        OrgMembership.status == MembershipStatus.ACTIVE,
                    )
                ).scalars().all()
                user_ids.update(m.user_id for m in memberships)
            elif rule.rule_type == RetreatEligibilityRuleType.VOCATIONAL_REALITY:
                from app.db.models import ProfileCatalogItem
                item = db.execute(
                    select(ProfileCatalogItem).where(
                        ProfileCatalogItem.code == rule.vocational_reality_code
                    )
                ).scalar_one_or_none()
                if item:
                    profiles = db.execute(
                        select(UserProfile).where(
                            UserProfile.vocational_reality_item_id == item.id
                        )
                    ).scalars().all()
                    user_ids.update(p.user_id for p in profiles)

        users = db.execute(
            select(User).where(User.id.in_(user_ids), User.is_active == True)
        ).scalars().all()

    if not users:
        return

    msg = InboxMessage(
        title=f"🏕️ Novo Retiro: {retreat.title}",
        message=(
            f"Um novo retiro foi publicado: **{retreat.title}**\n\n"
            f"📅 Data: {retreat.start_date.strftime('%d/%m/%Y')} a {retreat.end_date.strftime('%d/%m/%Y')}\n"
            f"📍 Local: {retreat.location or 'A definir'}\n\n"
            "Acesse o app para se inscrever!"
        ),
        type=InboxMessageType.INFO,
        created_by_user_id=retreat.created_by_user_id or list(users)[0].id,
        expires_at=retreat.start_date,
    )
    db.add(msg)
    db.flush()

    for user in users:
        db.add(InboxRecipient(message_id=msg.id, user_id=user.id))


# ---------------------------------------------------------------------------
# Schemas
# ---------------------------------------------------------------------------

class EligibilityRuleInput(BaseModel):
    rule_type: str  # ORG_UNIT | VOCATIONAL_REALITY
    org_unit_id: UUID | None = None
    vocational_reality_code: str | None = None
    rule_group: str = "PARTICIPANT"  # PARTICIPANT | SERVICE


class CreateRetreatBody(BaseModel):
    title: str
    description: str | None = None
    retreat_type: str  # WEEKEND | DAY | FORMATION
    start_date: datetime
    end_date: datetime
    location: str | None = None
    address: str | None = None
    max_participants: int | None = None
    price_brl: str | None = None
    visibility_type: str = "ALL"
    eligibility_rules: list[EligibilityRuleInput] = []
    service_eligibility_rules: list[EligibilityRuleInput] = []


class PatchRetreatBody(BaseModel):
    title: str | None = None
    description: str | None = None
    retreat_type: str | None = None
    start_date: datetime | None = None
    end_date: datetime | None = None
    location: str | None = None
    address: str | None = None
    max_participants: int | None = None
    price_brl: str | None = None
    visibility_type: str | None = None
    eligibility_rules: list[EligibilityRuleInput] | None = None
    service_eligibility_rules: list[EligibilityRuleInput] | None = None


class AddEligibilityRuleBody(BaseModel):
    rule_type: str  # ORG_UNIT | VOCATIONAL_REALITY
    org_unit_id: UUID | None = None
    vocational_reality_code: str | None = None
    rule_group: str  # PARTICIPANT | SERVICE


class RejectBody(BaseModel):
    reason: str | None = None


class HouseBody(BaseModel):
    name: str
    modality: str  # PRESENCIAL | HIBRIDO
    max_participants: int | None = None


class FeeTypeInput(BaseModel):
    fee_category: str
    amount_brl: str


class SetFeeTypesBody(BaseModel):
    fee_types: list[FeeTypeInput]


class AssignHouseBody(BaseModel):
    house_id: UUID | None = None  # None = desatribuir


class SetRoleBody(BaseModel):
    retreat_role: str  # PARTICIPANTE | EQUIPE_SERVICO


class CreateServiceTeamBody(BaseModel):
    name: str
    description: str | None = None


class PatchServiceTeamBody(BaseModel):
    name: str | None = None
    description: str | None = None


class AssignTeamMemberBody(BaseModel):
    registration_id: UUID
    role: str = "MEMBRO"   # COORDENADOR | MEMBRO | APOIO
    house_id: UUID | None = None


class PatchTeamMemberBody(BaseModel):
    role: str | None = None
    house_id: UUID | None = None



# ---------------------------------------------------------------------------
# Endpoints — Retiro CRUD
# ---------------------------------------------------------------------------

@router.post("", status_code=201)
async def create_retreat(body: CreateRetreatBody, current_user: CurrentUser, db: DBSession):
    _require_retreat_manager(db, current_user.id)

    try:
        rtype = RetreatType(body.retreat_type)
        vtype = RetreatVisibilityType(body.visibility_type)
    except ValueError as e:
        raise HTTPException(status_code=400, detail={"error": "invalid_param", "message": str(e)})

    retreat = Retreat(
        title=body.title,
        description=body.description,
        retreat_type=rtype,
        status=RetreatStatus.DRAFT,
        start_date=body.start_date,
        end_date=body.end_date,
        location=body.location,
        address=body.address,
        max_participants=body.max_participants,
        price_brl=body.price_brl,
        visibility_type=vtype,
        created_by_user_id=current_user.id,
    )
    db.add(retreat)
    db.flush()

    all_rule_inputs = [
        *[(r, "PARTICIPANT") for r in body.eligibility_rules],
        *[(r, "SERVICE") for r in body.service_eligibility_rules],
    ]
    for rule_input, group in all_rule_inputs:
        db.add(RetreatEligibilityRule(
            retreat_id=retreat.id,
            rule_type=RetreatEligibilityRuleType(rule_input.rule_type),
            org_unit_id=rule_input.org_unit_id,
            vocational_reality_code=rule_input.vocational_reality_code,
            rule_group=group,
        ))

    db.commit()
    db.refresh(retreat)
    return _retreat_to_dict(retreat)


@router.get("")
async def list_retreats(current_user: CurrentUser, db: DBSession):
    _require_retreat_manager(db, current_user.id)
    retreats = db.execute(select(Retreat)).scalars().all()
    return {"retreats": [_retreat_to_dict(r, include_registrations=True) for r in retreats]}


@router.get("/{retreat_id}")
async def get_retreat(retreat_id: UUID, current_user: CurrentUser, db: DBSession):
    _require_retreat_manager(db, current_user.id)
    retreat = db.get(Retreat, retreat_id)
    if not retreat:
        raise HTTPException(status_code=404, detail={"error": "not_found", "message": "Retiro não encontrado"})
    return _retreat_to_dict(retreat, include_registrations=True)


@router.patch("/{retreat_id}")
async def update_retreat(retreat_id: UUID, body: PatchRetreatBody, current_user: CurrentUser, db: DBSession):
    _require_retreat_manager(db, current_user.id)
    retreat = db.get(Retreat, retreat_id)
    if not retreat:
        raise HTTPException(status_code=404, detail={"error": "not_found", "message": "Retiro não encontrado"})
    if retreat.status in (RetreatStatus.CANCELLED,):
        raise HTTPException(status_code=409, detail={"error": "immutable", "message": "Retiro cancelado não pode ser editado"})

    if body.title is not None:
        retreat.title = body.title
    if body.description is not None:
        retreat.description = body.description
    if body.retreat_type is not None:
        retreat.retreat_type = RetreatType(body.retreat_type)
    if body.start_date is not None:
        retreat.start_date = body.start_date
    if body.end_date is not None:
        retreat.end_date = body.end_date
    if body.location is not None:
        retreat.location = body.location
    if body.address is not None:
        retreat.address = body.address
    if body.max_participants is not None:
        retreat.max_participants = body.max_participants
    if body.price_brl is not None:
        retreat.price_brl = body.price_brl
    if body.visibility_type is not None:
        retreat.visibility_type = RetreatVisibilityType(body.visibility_type)
    if body.eligibility_rules is not None or body.service_eligibility_rules is not None:
        # Substitui apenas os grupos que foram enviados
        if body.eligibility_rules is not None:
            existing_part = db.execute(
                select(RetreatEligibilityRule).where(
                    RetreatEligibilityRule.retreat_id == retreat_id,
                    RetreatEligibilityRule.rule_group == "PARTICIPANT",
                )
            ).scalars().all()
            for rule in existing_part:
                db.delete(rule)
            db.flush()
            for rule_input in body.eligibility_rules:
                db.add(RetreatEligibilityRule(
                    retreat_id=retreat.id,
                    rule_type=RetreatEligibilityRuleType(rule_input.rule_type),
                    org_unit_id=rule_input.org_unit_id,
                    vocational_reality_code=rule_input.vocational_reality_code,
                    rule_group="PARTICIPANT",
                ))
        if body.service_eligibility_rules is not None:
            existing_svc = db.execute(
                select(RetreatEligibilityRule).where(
                    RetreatEligibilityRule.retreat_id == retreat_id,
                    RetreatEligibilityRule.rule_group == "SERVICE",
                )
            ).scalars().all()
            for rule in existing_svc:
                db.delete(rule)
            db.flush()
            for rule_input in body.service_eligibility_rules:
                db.add(RetreatEligibilityRule(
                    retreat_id=retreat.id,
                    rule_type=RetreatEligibilityRuleType(rule_input.rule_type),
                    org_unit_id=rule_input.org_unit_id,
                    vocational_reality_code=rule_input.vocational_reality_code,
                    rule_group="SERVICE",
                ))

    db.commit()
    db.refresh(retreat)
    return _retreat_to_dict(retreat)


@router.post("/{retreat_id}/publish")
async def publish_retreat(retreat_id: UUID, current_user: CurrentUser, db: DBSession):
    _require_retreat_manager(db, current_user.id)
    retreat = db.get(Retreat, retreat_id)
    if not retreat:
        raise HTTPException(status_code=404, detail={"error": "not_found", "message": "Retiro não encontrado"})
    if retreat.status != RetreatStatus.DRAFT:
        raise HTTPException(status_code=409, detail={"error": "invalid_status", "message": "Apenas retiros em DRAFT podem ser publicados"})

    retreat.status = RetreatStatus.PUBLISHED
    _notify_eligible_users(db, retreat)
    db.commit()
    return {"message": "Retiro publicado com sucesso. Aviso enviado aos membros elegíveis."}


@router.post("/{retreat_id}/close")
async def close_retreat(retreat_id: UUID, current_user: CurrentUser, db: DBSession):
    _require_retreat_manager(db, current_user.id)
    retreat = db.get(Retreat, retreat_id)
    if not retreat:
        raise HTTPException(status_code=404, detail={"error": "not_found", "message": "Retiro não encontrado"})
    if retreat.status != RetreatStatus.PUBLISHED:
        raise HTTPException(status_code=409, detail={"error": "invalid_status", "message": "Apenas retiros publicados podem ser fechados"})
    retreat.status = RetreatStatus.CLOSED
    db.commit()
    return {"message": "Inscrições encerradas"}


@router.post("/{retreat_id}/cancel")
async def cancel_retreat(retreat_id: UUID, current_user: CurrentUser, db: DBSession):
    _require_retreat_manager(db, current_user.id)
    retreat = db.get(Retreat, retreat_id)
    if not retreat:
        raise HTTPException(status_code=404, detail={"error": "not_found", "message": "Retiro não encontrado"})
    if retreat.status == RetreatStatus.CANCELLED:
        raise HTTPException(status_code=409, detail={"error": "already_cancelled", "message": "Retiro já está cancelado"})
    retreat.status = RetreatStatus.CANCELLED
    db.commit()
    return {"message": "Retiro cancelado"}


# ---------------------------------------------------------------------------
# Endpoints — Casas
# ---------------------------------------------------------------------------

@router.post("/{retreat_id}/houses", status_code=201)
async def add_house(retreat_id: UUID, body: HouseBody, current_user: CurrentUser, db: DBSession):
    _require_retreat_manager(db, current_user.id)
    retreat = db.get(Retreat, retreat_id)
    if not retreat:
        raise HTTPException(status_code=404, detail={"error": "not_found", "message": "Retiro não encontrado"})
    if body.modality not in ("PRESENCIAL", "HIBRIDO"):
        raise HTTPException(status_code=400, detail={"error": "invalid_modality", "message": "Modalidade deve ser PRESENCIAL ou HIBRIDO"})

    house = RetreatHouse(
        retreat_id=retreat_id,
        name=body.name,
        modality=body.modality,
        max_participants=body.max_participants,
    )
    db.add(house)
    db.commit()
    db.refresh(house)
    return {"id": str(house.id), "name": house.name, "modality": house.modality, "max_participants": house.max_participants}


@router.put("/{retreat_id}/houses/{house_id}")
async def update_house(retreat_id: UUID, house_id: UUID, body: HouseBody, current_user: CurrentUser, db: DBSession):
    _require_retreat_manager(db, current_user.id)
    house = db.get(RetreatHouse, house_id)
    if not house or house.retreat_id != retreat_id:
        raise HTTPException(status_code=404, detail={"error": "not_found", "message": "Casa não encontrada"})
    if body.modality not in ("PRESENCIAL", "HIBRIDO"):
        raise HTTPException(status_code=400, detail={"error": "invalid_modality", "message": "Modalidade deve ser PRESENCIAL ou HIBRIDO"})

    house.name = body.name
    house.modality = body.modality
    house.max_participants = body.max_participants
    db.commit()
    db.refresh(house)
    return {"id": str(house.id), "name": house.name, "modality": house.modality, "max_participants": house.max_participants}


@router.delete("/{retreat_id}/houses/{house_id}", status_code=200)
async def delete_house(retreat_id: UUID, house_id: UUID, current_user: CurrentUser, db: DBSession):
    _require_retreat_manager(db, current_user.id)
    house = db.get(RetreatHouse, house_id)
    if not house or house.retreat_id != retreat_id:
        raise HTTPException(status_code=404, detail={"error": "not_found", "message": "Casa não encontrada"})
    db.delete(house)
    db.commit()
    return {"message": "Casa removida"}


# ---------------------------------------------------------------------------
# Endpoints — Regras de elegibilidade (add/remove individual)
# ---------------------------------------------------------------------------

@router.post("/{retreat_id}/eligibility-rules", status_code=201)
async def add_eligibility_rule(retreat_id: UUID, body: AddEligibilityRuleBody, current_user: CurrentUser, db: DBSession):
    """Adiciona uma regra de elegibilidade ao retiro (PARTICIPANT ou SERVICE)."""
    _require_retreat_manager(db, current_user.id)
    retreat = db.get(Retreat, retreat_id)
    if not retreat:
        raise HTTPException(status_code=404, detail={"error": "not_found", "message": "Retiro não encontrado"})
    if body.rule_group not in ("PARTICIPANT", "SERVICE"):
        raise HTTPException(status_code=400, detail={"error": "invalid_group", "message": "rule_group deve ser PARTICIPANT ou SERVICE"})
    try:
        rtype = RetreatEligibilityRuleType(body.rule_type)
    except ValueError:
        raise HTTPException(status_code=400, detail={"error": "invalid_type", "message": "rule_type deve ser ORG_UNIT ou VOCATIONAL_REALITY"})

    rule = RetreatEligibilityRule(
        retreat_id=retreat_id,
        rule_type=rtype,
        org_unit_id=body.org_unit_id,
        vocational_reality_code=body.vocational_reality_code,
        rule_group=body.rule_group,
    )
    db.add(rule)
    db.commit()
    db.refresh(rule)
    return _rule_to_dict(rule)


@router.delete("/{retreat_id}/eligibility-rules/{rule_id}", status_code=200)
async def delete_eligibility_rule(retreat_id: UUID, rule_id: UUID, current_user: CurrentUser, db: DBSession):
    """Remove uma regra de elegibilidade do retiro."""
    _require_retreat_manager(db, current_user.id)
    rule = db.get(RetreatEligibilityRule, rule_id)
    if not rule or rule.retreat_id != retreat_id:
        raise HTTPException(status_code=404, detail={"error": "not_found", "message": "Regra não encontrada"})
    db.delete(rule)
    db.commit()
    return {"message": "Regra removida"}


# ---------------------------------------------------------------------------
# Endpoints — Taxas
# ---------------------------------------------------------------------------

@router.post("/{retreat_id}/fee-types")
async def set_fee_types(retreat_id: UUID, body: SetFeeTypesBody, current_user: CurrentUser, db: DBSession):
    """Substitui todas as taxas do retiro (bulk upsert)."""
    _require_retreat_manager(db, current_user.id)
    retreat = db.get(Retreat, retreat_id)
    if not retreat:
        raise HTTPException(status_code=404, detail={"error": "not_found", "message": "Retiro não encontrado"})

    # Valida categorias
    for ft in body.fee_types:
        if ft.fee_category not in ALL_FEE_CATEGORIES:
            raise HTTPException(
                status_code=400,
                detail={"error": "invalid_category", "message": f"Categoria inválida: {ft.fee_category}"}
            )

    # Remove todas as taxas existentes e recria
    existing = db.execute(
        select(RetreatFeeType).where(RetreatFeeType.retreat_id == retreat_id)
    ).scalars().all()
    for ft in existing:
        db.delete(ft)
    db.flush()

    created = []
    for ft_input in body.fee_types:
        ft = RetreatFeeType(
            retreat_id=retreat_id,
            fee_category=ft_input.fee_category,
            amount_brl=ft_input.amount_brl,
        )
        db.add(ft)
        created.append(ft)

    db.commit()
    return {
        "fee_types": [
            {
                "fee_category": ft.fee_category,
                "label": FEE_CATEGORY_LABELS.get(ft.fee_category, ft.fee_category),
                "amount_brl": ft.amount_brl,
            }
            for ft in created
        ]
    }


# ---------------------------------------------------------------------------
# Endpoints — Inscrições
# ---------------------------------------------------------------------------

@router.get("/{retreat_id}/registrations")
async def list_registrations(retreat_id: UUID, current_user: CurrentUser, db: DBSession):
    _require_retreat_manager(db, current_user.id)
    retreat = db.get(Retreat, retreat_id)
    if not retreat:
        raise HTTPException(status_code=404, detail={"error": "not_found", "message": "Retiro não encontrado"})

    regs = db.execute(
        select(RetreatRegistration).where(RetreatRegistration.retreat_id == retreat_id)
    ).scalars().all()

    items = []
    for reg in regs:
        profile = db.execute(
            select(UserProfile).where(UserProfile.user_id == reg.user_id)
        ).scalar_one_or_none()
        house = db.get(RetreatHouse, reg.assigned_house_id) if reg.assigned_house_id else None
        team_prefs = sorted(reg.team_preferences or [], key=lambda p: p.preference_order)
        team_assignments = [
            {
                "member_id": str(m.id),
                "team_id": str(m.team_id),
                "role": m.role.value,
                "house_id": str(m.house_id) if m.house_id else None,
            }
            for m in (reg.team_assignment_entries or [])
        ]
        items.append({
            "id": str(reg.id),
            "user_id": str(reg.user_id),
            "user_name": profile.full_name if profile else None,
            "status": reg.status.value,
            "modality_preference": reg.modality_preference,
            "retreat_role": reg.retreat_role,
            "fee_category": reg.fee_category,
            "fee_label": FEE_CATEGORY_LABELS.get(reg.fee_category, reg.fee_category) if reg.fee_category else None,
            "assigned_house_id": str(reg.assigned_house_id) if reg.assigned_house_id else None,
            "assigned_house_name": house.name if house else None,
            "notes": reg.notes,
            "payment_proof_url": reg.payment_proof_url,
            "payment_submitted_at": reg.payment_submitted_at.isoformat() if reg.payment_submitted_at else None,
            "payment_confirmed_at": reg.payment_confirmed_at.isoformat() if reg.payment_confirmed_at else None,
            "payment_rejection_reason": reg.payment_rejection_reason,
            "created_at": reg.created_at.isoformat(),
            "team_preferences": [
                {"team_id": str(p.team_id), "preference_order": p.preference_order}
                for p in team_prefs
            ],
            "team_assignments": team_assignments,
        })

    return {"total": len(items), "registrations": items}


@router.post("/{retreat_id}/registrations/{registration_id}/confirm")
async def confirm_payment(retreat_id: UUID, registration_id: UUID, current_user: CurrentUser, db: DBSession):
    _require_retreat_manager(db, current_user.id)
    reg = db.get(RetreatRegistration, registration_id)
    if not reg or reg.retreat_id != retreat_id:
        raise HTTPException(status_code=404, detail={"error": "not_found", "message": "Inscrição não encontrada"})
    if reg.status not in (RegistrationStatus.PAYMENT_SUBMITTED, RegistrationStatus.PENDING_PAYMENT):
        raise HTTPException(status_code=409, detail={"error": "invalid_status", "message": f"Não é possível confirmar inscrição com status {reg.status.value}"})

    reg.status = RegistrationStatus.CONFIRMED
    reg.payment_confirmed_at = datetime.now(timezone.utc)
    reg.payment_confirmed_by_user_id = current_user.id
    db.commit()
    return {"message": "Pagamento confirmado"}


@router.post("/{retreat_id}/registrations/{registration_id}/reject")
async def reject_payment(retreat_id: UUID, registration_id: UUID, body: RejectBody, current_user: CurrentUser, db: DBSession):
    _require_retreat_manager(db, current_user.id)
    reg = db.get(RetreatRegistration, registration_id)
    if not reg or reg.retreat_id != retreat_id:
        raise HTTPException(status_code=404, detail={"error": "not_found", "message": "Inscrição não encontrada"})
    if reg.status != RegistrationStatus.PAYMENT_SUBMITTED:
        raise HTTPException(status_code=409, detail={"error": "invalid_status", "message": "Apenas comprovantes enviados podem ser rejeitados"})

    reg.status = RegistrationStatus.PENDING_PAYMENT
    reg.payment_rejected_at = datetime.now(timezone.utc)
    reg.payment_rejected_by_user_id = current_user.id
    reg.payment_rejection_reason = body.reason
    reg.payment_proof_url = None
    reg.payment_submitted_at = None
    db.commit()
    return {"message": "Comprovante rejeitado. Membro deverá enviar novo comprovante."}


@router.patch("/{retreat_id}/registrations/{registration_id}/house")
async def assign_house(retreat_id: UUID, registration_id: UUID, body: AssignHouseBody, current_user: CurrentUser, db: DBSession):
    """Atribui (ou remove) uma casa a uma inscrição."""
    _require_retreat_manager(db, current_user.id)
    reg = db.get(RetreatRegistration, registration_id)
    if not reg or reg.retreat_id != retreat_id:
        raise HTTPException(status_code=404, detail={"error": "not_found", "message": "Inscrição não encontrada"})

    if body.house_id is not None:
        house = db.get(RetreatHouse, body.house_id)
        if not house or house.retreat_id != retreat_id:
            raise HTTPException(status_code=404, detail={"error": "not_found", "message": "Casa não encontrada neste retiro"})

    reg.assigned_house_id = body.house_id
    db.commit()
    return {"message": "Casa atribuída" if body.house_id else "Atribuição removida"}


@router.patch("/{retreat_id}/registrations/{registration_id}/role")
async def set_registration_role(retreat_id: UUID, registration_id: UUID, body: SetRoleBody, current_user: CurrentUser, db: DBSession):
    """Muda o papel do participante (PARTICIPANTE ou EQUIPE_SERVICO) e recalcula fee_category."""
    _require_retreat_manager(db, current_user.id)
    if body.retreat_role not in ("PARTICIPANTE", "EQUIPE_SERVICO"):
        raise HTTPException(status_code=400, detail={"error": "invalid_role", "message": "Papel deve ser PARTICIPANTE ou EQUIPE_SERVICO"})

    reg = db.get(RetreatRegistration, registration_id)
    if not reg or reg.retreat_id != retreat_id:
        raise HTTPException(status_code=404, detail={"error": "not_found", "message": "Inscrição não encontrada"})

    reg.retreat_role = body.retreat_role

    # Participante híbrido mantém taxa HIBRIDO independente do papel
    if reg.modality_preference == "HIBRIDO":
        reg.fee_category = "HIBRIDO"
    else:
        # Recalcula fee_category com base no novo papel + realidade vocacional do perfil
        profile = db.execute(
            select(UserProfile).where(UserProfile.user_id == reg.user_id)
        ).scalar_one_or_none()
        voc_code = None
        if profile and profile.vocational_reality_item_id:
            from app.db.models import ProfileCatalogItem
            item = db.execute(
                select(ProfileCatalogItem).where(ProfileCatalogItem.id == profile.vocational_reality_item_id)
            ).scalar_one_or_none()
            if item:
                voc_code = item.code
        reg.fee_category = _compute_fee_category(body.retreat_role, voc_code)
    db.commit()
    return {
        "retreat_role": reg.retreat_role,
        "fee_category": reg.fee_category,
        "fee_label": FEE_CATEGORY_LABELS.get(reg.fee_category, reg.fee_category),
    }


def _compute_fee_category(retreat_role: str, vocational_reality_code: str | None, modality: str | None = None) -> str:
    """
    Computa a categoria de taxa.
    Modalidade HIBRIDO tem taxa própria — ignora papel e vocacional.
    Quando o admin muda o papel de um inscrito híbrido, preserva HIBRIDO.
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


# ---------------------------------------------------------------------------
# Equipes de Serviço
# ---------------------------------------------------------------------------

@router.post("/{retreat_id}/service-teams", status_code=201)
async def create_service_team(
    retreat_id: UUID,
    body: CreateServiceTeamBody,
    current_user: CurrentUser,
    db: DBSession,
):
    _require_retreat_manager(db, current_user.id)
    retreat = db.get(Retreat, retreat_id)
    if not retreat:
        raise HTTPException(status_code=404, detail={"error": "not_found", "message": "Retiro não encontrado"})
    team = RetreatServiceTeam(retreat_id=retreat_id, name=body.name.strip(), description=body.description)
    db.add(team)
    db.commit()
    db.refresh(team)
    return {"id": str(team.id), "name": team.name, "description": team.description, "members": [], "created_at": team.created_at.isoformat()}


@router.get("/{retreat_id}/service-teams")
async def list_service_teams(retreat_id: UUID, current_user: CurrentUser, db: DBSession):
    _require_retreat_manager(db, current_user.id)
    retreat = db.get(Retreat, retreat_id)
    if not retreat:
        raise HTTPException(status_code=404, detail={"error": "not_found", "message": "Retiro não encontrado"})
    teams = db.execute(
        select(RetreatServiceTeam).where(RetreatServiceTeam.retreat_id == retreat_id)
    ).scalars().all()
    return {"service_teams": _service_teams_to_list(teams)}


@router.put("/{retreat_id}/service-teams/{team_id}")
async def update_service_team(
    retreat_id: UUID,
    team_id: UUID,
    body: PatchServiceTeamBody,
    current_user: CurrentUser,
    db: DBSession,
):
    _require_retreat_manager(db, current_user.id)
    team = db.get(RetreatServiceTeam, team_id)
    if not team or team.retreat_id != retreat_id:
        raise HTTPException(status_code=404, detail={"error": "not_found", "message": "Equipe não encontrada"})
    if body.name is not None:
        team.name = body.name.strip()
    if body.description is not None:
        team.description = body.description
    db.commit()
    db.refresh(team)
    return {"id": str(team.id), "name": team.name, "description": team.description, "created_at": team.created_at.isoformat()}


@router.delete("/{retreat_id}/service-teams/{team_id}", status_code=200)
async def delete_service_team(retreat_id: UUID, team_id: UUID, current_user: CurrentUser, db: DBSession):
    _require_retreat_manager(db, current_user.id)
    team = db.get(RetreatServiceTeam, team_id)
    if not team or team.retreat_id != retreat_id:
        raise HTTPException(status_code=404, detail={"error": "not_found", "message": "Equipe não encontrada"})
    db.delete(team)
    db.commit()
    return {"message": "Equipe removida"}


@router.post("/{retreat_id}/service-teams/{team_id}/members", status_code=201)
async def assign_team_member(
    retreat_id: UUID,
    team_id: UUID,
    body: AssignTeamMemberBody,
    current_user: CurrentUser,
    db: DBSession,
):
    _require_retreat_manager(db, current_user.id)
    team = db.get(RetreatServiceTeam, team_id)
    if not team or team.retreat_id != retreat_id:
        raise HTTPException(status_code=404, detail={"error": "not_found", "message": "Equipe não encontrada"})
    reg = db.get(RetreatRegistration, body.registration_id)
    if not reg or reg.retreat_id != retreat_id:
        raise HTTPException(status_code=404, detail={"error": "not_found", "message": "Inscrição não encontrada neste retiro"})
    try:
        role = ServiceTeamRole(body.role)
    except ValueError:
        raise HTTPException(status_code=400, detail={"error": "invalid_role", "message": "Role deve ser COORDENADOR, MEMBRO ou APOIO"})
    if body.house_id is not None:
        house = db.get(RetreatHouse, body.house_id)
        if not house or house.retreat_id != retreat_id:
            raise HTTPException(status_code=404, detail={"error": "not_found", "message": "Casa não encontrada neste retiro"})
    existing = db.execute(
        select(RetreatServiceTeamMember).where(
            RetreatServiceTeamMember.team_id == team_id,
            RetreatServiceTeamMember.registration_id == body.registration_id,
        )
    ).scalar_one_or_none()
    if existing:
        raise HTTPException(status_code=409, detail={"error": "already_member", "message": "Inscrição já é membro desta equipe"})
    member = RetreatServiceTeamMember(
        team_id=team_id,
        registration_id=body.registration_id,
        role=role,
        house_id=body.house_id,
    )
    db.add(member)
    db.commit()
    db.refresh(member)
    return {
        "id": str(member.id),
        "team_id": str(member.team_id),
        "registration_id": str(member.registration_id),
        "role": member.role.value,
        "house_id": str(member.house_id) if member.house_id else None,
        "created_at": member.created_at.isoformat(),
    }


@router.patch("/{retreat_id}/service-teams/{team_id}/members/{member_id}")
async def patch_team_member(
    retreat_id: UUID,
    team_id: UUID,
    member_id: UUID,
    body: PatchTeamMemberBody,
    current_user: CurrentUser,
    db: DBSession,
):
    _require_retreat_manager(db, current_user.id)
    team = db.get(RetreatServiceTeam, team_id)
    if not team or team.retreat_id != retreat_id:
        raise HTTPException(status_code=404, detail={"error": "not_found", "message": "Equipe não encontrada"})
    member = db.get(RetreatServiceTeamMember, member_id)
    if not member or member.team_id != team_id:
        raise HTTPException(status_code=404, detail={"error": "not_found", "message": "Membro não encontrado"})
    if body.role is not None:
        try:
            member.role = ServiceTeamRole(body.role)
        except ValueError:
            raise HTTPException(status_code=400, detail={"error": "invalid_role", "message": "Role deve ser COORDENADOR, MEMBRO ou APOIO"})
    if "house_id" in body.model_fields_set:
        if body.house_id is not None:
            house = db.get(RetreatHouse, body.house_id)
            if not house or house.retreat_id != retreat_id:
                raise HTTPException(status_code=404, detail={"error": "not_found", "message": "Casa não encontrada neste retiro"})
        member.house_id = body.house_id
    db.commit()
    return {"id": str(member.id), "role": member.role.value, "house_id": str(member.house_id) if member.house_id else None}


@router.delete("/{retreat_id}/service-teams/{team_id}/members/{member_id}", status_code=200)
async def remove_team_member(
    retreat_id: UUID,
    team_id: UUID,
    member_id: UUID,
    current_user: CurrentUser,
    db: DBSession,
):
    _require_retreat_manager(db, current_user.id)
    team = db.get(RetreatServiceTeam, team_id)
    if not team or team.retreat_id != retreat_id:
        raise HTTPException(status_code=404, detail={"error": "not_found", "message": "Equipe não encontrada"})
    member = db.get(RetreatServiceTeamMember, member_id)
    if not member or member.team_id != team_id:
        raise HTTPException(status_code=404, detail={"error": "not_found", "message": "Membro não encontrado"})
    db.delete(member)
    db.commit()
    return {"message": "Membro removido da equipe"}


# ---------------------------------------------------------------------------
# Export CSV
# ---------------------------------------------------------------------------

@router.get("/{retreat_id}/export")
async def export_registrations_csv(retreat_id: UUID, current_user: CurrentUser, db: DBSession):
    _require_retreat_manager(db, current_user.id)
    retreat = db.get(Retreat, retreat_id)
    if not retreat:
        raise HTTPException(status_code=404, detail={"error": "not_found", "message": "Retiro não encontrado"})

    regs = db.execute(
        select(RetreatRegistration).where(
            RetreatRegistration.retreat_id == retreat_id,
            RetreatRegistration.status != RegistrationStatus.CANCELLED,
        )
    ).scalars().all()

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow([
        "Nome", "Status", "Modalidade", "Papel", "Categoria de Taxa",
        "Casa Atribuída", "Observações",
        "Comprovante enviado em", "Pagamento confirmado em", "Inscrito em",
    ])

    for reg in regs:
        profile = db.execute(
            select(UserProfile).where(UserProfile.user_id == reg.user_id)
        ).scalar_one_or_none()
        house = db.get(RetreatHouse, reg.assigned_house_id) if reg.assigned_house_id else None
        writer.writerow([
            profile.full_name if profile else str(reg.user_id),
            reg.status.value,
            reg.modality_preference or "",
            reg.retreat_role or "PARTICIPANTE",
            FEE_CATEGORY_LABELS.get(reg.fee_category, reg.fee_category or ""),
            house.name if house else "",
            reg.notes or "",
            reg.payment_submitted_at.strftime("%d/%m/%Y %H:%M") if reg.payment_submitted_at else "",
            reg.payment_confirmed_at.strftime("%d/%m/%Y %H:%M") if reg.payment_confirmed_at else "",
            reg.created_at.strftime("%d/%m/%Y %H:%M"),
        ])

    output.seek(0)
    filename = f"retiro_{retreat.title.lower().replace(' ', '_')}_{datetime.now().strftime('%Y%m%d')}.csv"
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
