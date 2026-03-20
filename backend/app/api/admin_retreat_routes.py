"""
Rotas de Retiros — Área Admin
==============================
POST   /admin/retreats                              — criar retiro (DRAFT)
GET    /admin/retreats                              — listar todos
GET    /admin/retreats/{id}                         — detalhe
PATCH  /admin/retreats/{id}                         — editar
POST   /admin/retreats/{id}/publish                 — publicar (dispara inbox)
POST   /admin/retreats/{id}/close                   — fechar inscrições
POST   /admin/retreats/{id}/cancel                  — cancelar retiro
GET    /admin/retreats/{id}/registrations           — lista de inscrições
POST   /admin/retreats/{id}/registrations/{reg}/confirm — confirmar pagamento
POST   /admin/retreats/{id}/registrations/{reg}/reject  — rejeitar comprovante
GET    /admin/retreats/{id}/export                  — exportar CSV
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
    RetreatRegistration,
    RetreatStatus,
    RetreatType,
    RetreatVisibilityType,
    RegistrationStatus,
    User,
    UserGlobalRole,
    UserPermission,
    UserProfile,
    MembershipStatus,
)

router = APIRouter(prefix="/admin/retreats", tags=["Admin — Retreats"])

PERMISSION_MANAGE_RETREATS = "PERMISSION_MANAGE_RETREATS"


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


def _retreat_to_dict(retreat: Retreat, include_registrations: bool = False) -> dict:
    rules = [
        {
            "id": str(r.id),
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

    from datetime import timedelta
    msg = InboxMessage(
        title=f"🏕️ Novo Retiro: {retreat.title}",
        message=(
            f"Um novo retiro foi publicado: **{retreat.title}**\n\n"
            f"📅 Data: {retreat.start_date.strftime('%d/%m/%Y')} a {retreat.end_date.strftime('%d/%m/%Y')}\n"
            f"📍 Local: {retreat.location or 'A definir'}\n"
            f"💰 Valor: R$ {retreat.price_brl or '0,00'}\n\n"
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


class RejectBody(BaseModel):
    reason: str | None = None


# ---------------------------------------------------------------------------
# Endpoints
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

    for rule_input in body.eligibility_rules:
        db.add(RetreatEligibilityRule(
            retreat_id=retreat.id,
            rule_type=RetreatEligibilityRuleType(rule_input.rule_type),
            org_unit_id=rule_input.org_unit_id,
            vocational_reality_code=rule_input.vocational_reality_code,
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
    if body.eligibility_rules is not None:
        # Substitui todas as regras
        existing_rules = db.execute(
            select(RetreatEligibilityRule).where(RetreatEligibilityRule.retreat_id == retreat_id)
        ).scalars().all()
        for rule in existing_rules:
            db.delete(rule)
        db.flush()
        for rule_input in body.eligibility_rules:
            db.add(RetreatEligibilityRule(
                retreat_id=retreat.id,
                rule_type=RetreatEligibilityRuleType(rule_input.rule_type),
                org_unit_id=rule_input.org_unit_id,
                vocational_reality_code=rule_input.vocational_reality_code,
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
# Registrations
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
        items.append({
            "id": str(reg.id),
            "user_id": str(reg.user_id),
            "user_name": profile.full_name if profile else None,
            "status": reg.status.value,
            "notes": reg.notes,
            "payment_proof_url": reg.payment_proof_url,
            "payment_submitted_at": reg.payment_submitted_at.isoformat() if reg.payment_submitted_at else None,
            "payment_confirmed_at": reg.payment_confirmed_at.isoformat() if reg.payment_confirmed_at else None,
            "payment_rejection_reason": reg.payment_rejection_reason,
            "created_at": reg.created_at.isoformat(),
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
        "Nome", "Status", "Observações", "Comprovante enviado em",
        "Pagamento confirmado em", "Inscrito em",
    ])

    for reg in regs:
        profile = db.execute(
            select(UserProfile).where(UserProfile.user_id == reg.user_id)
        ).scalar_one_or_none()
        writer.writerow([
            profile.full_name if profile else str(reg.user_id),
            reg.status.value,
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
