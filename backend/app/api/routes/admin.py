"""
Admin Routes
============
Endpoints administrativos.

SEGURANÇA: Toda visualização de CPF/RG é auditada obrigatoriamente.
"""

from datetime import datetime, timedelta, timezone
from uuid import UUID

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import select, or_, func, exists, nullslast, delete, desc

from app.api.deps import CurrentUser, DBSession
from app.db.models import (
    UserProfile, User, UserIdentity, UserGlobalRole, GlobalRole,
    ProfileCatalogItem, ProfileCatalog,
    OrgMembership, MembershipStatus, OrgUnit, OrgUnitType,
    OrgInvite, InviteStatus,
    AuditLog,
)
from app.services.organization import get_user_global_roles, is_conselho_geral_coordinator  # noqa: F401

router = APIRouter(prefix="/admin", tags=["Admin"])


# =============================================================================
# HELPER — verifica acesso ao dashboard/analytics
# =============================================================================

def require_admin_or_analista(db, user_id):
    roles = get_user_global_roles(db, user_id)
    if not any(r in roles for r in ["ADMIN", "DEV", "ANALISTA"]):
        raise HTTPException(
            status_code=403,
            detail={
                "error": "permission_denied",
                "message": "Acesso restrito a administradores e analistas",
            },
        )


# =============================================================================
# USERS — listagem administrativa
# =============================================================================


@router.get("/users")
async def list_users(
    current_user: CurrentUser,
    db: DBSession,
    search: str = Query(default="", description="Busca por nome ou e-mail"),
    limit: int = Query(default=50, le=200),
    offset: int = Query(default=0, ge=0),
):
    """
    Lista usuários com perfil, e-mail e papéis globais.
    Requer DEV, ADMIN ou SECRETARY.
    """
    global_roles = get_user_global_roles(db, current_user.id)
    if not any(r in global_roles for r in ["DEV", "ADMIN", "SECRETARY"]):
        if not is_conselho_geral_coordinator(db, current_user.id):
            raise HTTPException(
                status_code=403,
                detail={"error": "forbidden", "message": "Sem permissão para listar usuários"},
            )

    # Join apenas com UserProfile (1-para-1) para evitar duplicatas.
    # Busca por email usa EXISTS → sem JOIN com UserIdentity na query principal.
    def _apply_search(stmt, term: str):
        email_match = exists().where(
            UserIdentity.user_id == User.id,
            UserIdentity.email.ilike(term),
        )
        return stmt.where(or_(UserProfile.full_name.ilike(term), email_match))

    base = (
        select(User)
        .join(UserProfile, UserProfile.user_id == User.id, isouter=True)
        .where(User.is_active == True)  # noqa: E712
    )

    if search.strip():
        base = _apply_search(base, f"%{search.strip()}%")

    # Paginação
    stmt = base.order_by(nullslast(UserProfile.full_name.asc())).offset(offset).limit(limit)
    users = db.execute(stmt).scalars().all()

    # Contagem total
    count_base = (
        select(func.count(User.id))
        .join(UserProfile, UserProfile.user_id == User.id, isouter=True)
        .where(User.is_active == True)  # noqa: E712
    )
    if search.strip():
        count_base = _apply_search(count_base, f"%{search.strip()}%")
    total = db.execute(count_base).scalar() or 0

    result = []
    for u in users:
        profile = u.profile
        email = u.identities[0].email if u.identities else None
        user_roles = get_user_global_roles(db, u.id)

        result.append(
            {
                "id": str(u.id),
                "name": profile.full_name if profile else None,
                "email": email,
                "photo_url": profile.photo_url if profile else None,
                "profile_status": profile.status if profile else "INCOMPLETE",
                "global_roles": user_roles,
                "created_at": u.created_at.isoformat(),
            }
        )

    return {"users": result, "total": total, "limit": limit, "offset": offset}


# =============================================================================
# USERS — edição administrativa
# =============================================================================


class UpdateUserRequest(BaseModel):
    full_name: str | None = None
    global_roles: list[str] | None = None  # Ex: ["DEV", "ADMIN"]


@router.patch("/users/{user_id}")
async def update_user(
    user_id: UUID,
    data: UpdateUserRequest,
    current_user: CurrentUser,
    db: DBSession,
):
    """
    Edita nome e/ou roles globais de um usuário.
    Requer DEV ou ADMIN.
    """
    global_roles = get_user_global_roles(db, current_user.id)
    if not any(r in global_roles for r in ["DEV", "ADMIN"]):
        raise HTTPException(
            status_code=403,
            detail={"error": "forbidden", "message": "Sem permissão para editar usuários"},
        )

    target = db.get(User, user_id)
    if not target or not target.is_active:
        raise HTTPException(
            status_code=404,
            detail={"error": "not_found", "message": "Usuário não encontrado"},
        )

    # Atualiza nome no perfil
    if data.full_name is not None:
        profile = target.profile
        if profile is None:
            profile = UserProfile(user_id=user_id, status="INCOMPLETE")
            db.add(profile)
        profile.full_name = data.full_name.strip() or None

    # Atualiza roles globais (substitui completamente)
    if data.global_roles is not None:
        # Remove todas as roles atuais
        db.execute(delete(UserGlobalRole).where(UserGlobalRole.user_id == user_id))
        # Insere as novas
        allowed_roles = {"DEV", "ADMIN", "SECRETARY", "AVISOS"}
        for role_code in data.global_roles:
            role_code = role_code.upper().strip()
            if role_code not in allowed_roles:
                continue
            role = db.execute(
                select(GlobalRole).where(GlobalRole.code == role_code)
            ).scalar_one_or_none()
            if role:
                db.add(UserGlobalRole(user_id=user_id, global_role_id=role.id))

    db.commit()
    db.refresh(target)

    profile = target.profile
    email = target.identities[0].email if target.identities else None
    updated_roles = get_user_global_roles(db, user_id)

    return {
        "id": str(target.id),
        "name": profile.full_name if profile else None,
        "email": email,
        "photo_url": profile.photo_url if profile else None,
        "profile_status": profile.status if profile else "INCOMPLETE",
        "global_roles": updated_roles,
        "created_at": target.created_at.isoformat(),
    }


# =============================================================================
# USERS — concessão/revogação do cargo AVISOS
# =============================================================================


class ToggleAvisosRequest(BaseModel):
    grant: bool  # True = conceder, False = revogar


@router.post("/users/{user_id}/toggle-avisos")
async def toggle_avisos_role(
    user_id: UUID,
    data: ToggleAvisosRequest,
    current_user: CurrentUser,
    db: DBSession,
):
    """
    Concede ou revoga o cargo AVISOS de um usuário.
    Requer DEV, ADMIN ou ser coordenador do Conselho Geral.
    """
    global_roles = get_user_global_roles(db, current_user.id)
    if not any(r in global_roles for r in ["DEV", "ADMIN"]):
        if not is_conselho_geral_coordinator(db, current_user.id):
            raise HTTPException(
                status_code=403,
                detail={
                    "error": "forbidden",
                    "message": "Sem permissão para gerenciar o cargo Avisos",
                },
            )

    target = db.get(User, user_id)
    if not target or not target.is_active:
        raise HTTPException(
            status_code=404,
            detail={"error": "not_found", "message": "Usuário não encontrado"},
        )

    avisos_role = db.execute(
        select(GlobalRole).where(GlobalRole.code == "AVISOS")
    ).scalar_one_or_none()
    if not avisos_role:
        raise HTTPException(
            status_code=500,
            detail={
                "error": "config_error",
                "message": "Cargo AVISOS não configurado. Execute o seed novamente.",
            },
        )

    existing = db.execute(
        select(UserGlobalRole).where(
            UserGlobalRole.user_id == user_id,
            UserGlobalRole.global_role_id == avisos_role.id,
        )
    ).scalar_one_or_none()

    if data.grant and not existing:
        db.add(UserGlobalRole(user_id=user_id, global_role_id=avisos_role.id))
        db.commit()
    elif not data.grant and existing:
        db.delete(existing)
        db.commit()

    db.refresh(target)
    profile = target.profile
    email = target.identities[0].email if target.identities else None
    updated_roles = get_user_global_roles(db, user_id)

    return {
        "id": str(target.id),
        "name": profile.full_name if profile else None,
        "email": email,
        "photo_url": profile.photo_url if profile else None,
        "profile_status": profile.status if profile else "INCOMPLETE",
        "global_roles": updated_roles,
        "created_at": target.created_at.isoformat(),
    }


# =============================================================================
# DASHBOARD — métricas de governança
# =============================================================================

def _calc_age_ranges(birth_dates: list) -> list[dict]:
    """Agrupa datas de nascimento em faixas etárias."""
    today = datetime.now(timezone.utc).date()
    buckets: dict[str, int] = {
        "< 18": 0,
        "18-25": 0,
        "26-35": 0,
        "36-45": 0,
        "46-60": 0,
        "> 60": 0,
        "Não informado": 0,
    }
    for bd in birth_dates:
        if bd is None:
            buckets["Não informado"] += 1
            continue
        age = (today - bd).days // 365
        if age < 18:
            buckets["< 18"] += 1
        elif age <= 25:
            buckets["18-25"] += 1
        elif age <= 35:
            buckets["26-35"] += 1
        elif age <= 45:
            buckets["36-45"] += 1
        elif age <= 60:
            buckets["46-60"] += 1
        else:
            buckets["> 60"] += 1
    return [{"range": k, "count": v} for k, v in buckets.items()]


_UNIT_TYPE_LABELS = {
    "CONSELHO_GERAL": "Conselho Geral",
    "CONSELHO_EXECUTIVO": "Conselho Executivo",
    "SETOR": "Setor",
    "MINISTERIO": "Ministério",
    "GRUPO": "Grupo",
}


@router.get("/dashboard")
async def get_dashboard(
    current_user: CurrentUser,
    db: DBSession,
):
    """
    Retorna métricas consolidadas do aplicativo.
    Requer ADMIN, DEV ou ANALISTA.
    """
    require_admin_or_analista(db, current_user.id)

    now = datetime.now(timezone.utc)
    cutoff_7d = now - timedelta(days=7)
    cutoff_30d = now - timedelta(days=30)

    # --- Usuários ---
    total_users = db.execute(
        select(func.count(User.id)).where(User.is_active == True)  # noqa: E712
    ).scalar() or 0

    complete_profiles = db.execute(
        select(func.count(UserProfile.user_id)).where(UserProfile.status == "COMPLETE")
    ).scalar() or 0

    incomplete_profiles = db.execute(
        select(func.count(UserProfile.user_id)).where(UserProfile.status != "COMPLETE")
    ).scalar() or 0

    new_7d = db.execute(
        select(func.count(User.id)).where(
            User.is_active == True,  # noqa: E712
            User.created_at >= cutoff_7d,
        )
    ).scalar() or 0

    new_30d = db.execute(
        select(func.count(User.id)).where(
            User.is_active == True,  # noqa: E712
            User.created_at >= cutoff_30d,
        )
    ).scalar() or 0

    # --- Faixas etárias ---
    birth_dates = db.execute(
        select(UserProfile.birth_date)
    ).scalars().all()
    age_ranges = _calc_age_ranges(list(birth_dates))

    # --- Geografia ---
    city_rows = db.execute(
        select(UserProfile.city, func.count(UserProfile.user_id).label("cnt"))
        .where(UserProfile.city.isnot(None))
        .group_by(UserProfile.city)
        .order_by(desc("cnt"))
        .limit(10)
    ).all()
    by_city = [{"city": r[0], "count": r[1]} for r in city_rows]

    state_rows = db.execute(
        select(UserProfile.state, func.count(UserProfile.user_id).label("cnt"))
        .where(UserProfile.state.isnot(None))
        .group_by(UserProfile.state)
        .order_by(desc("cnt"))
        .limit(10)
    ).all()
    by_state = [{"state": r[0], "count": r[1]} for r in state_rows]

    # --- Catálogos ---
    def _catalog_breakdown(catalog_code: str, fk_col):
        rows = db.execute(
            select(ProfileCatalogItem.label, func.count(fk_col).label("cnt"))
            .join(
                ProfileCatalog,
                ProfileCatalogItem.catalog_id == ProfileCatalog.id,
            )
            .join(
                UserProfile,
                fk_col == ProfileCatalogItem.id,
            )
            .where(ProfileCatalog.code == catalog_code)
            .group_by(ProfileCatalogItem.label)
            .order_by(desc("cnt"))
        ).all()
        return [{"label": r[0], "count": r[1]} for r in rows]

    by_life_state = _catalog_breakdown("LIFE_STATE", UserProfile.life_state_item_id)
    by_marital_status = _catalog_breakdown("MARITAL_STATUS", UserProfile.marital_status_item_id)
    by_vocational_reality = _catalog_breakdown("VOCATIONAL_REALITY", UserProfile.vocational_reality_item_id)

    with_voc = db.execute(
        select(func.count(UserProfile.user_id)).where(
            UserProfile.has_vocational_accompaniment == True  # noqa: E712
        )
    ).scalar() or 0

    without_voc = db.execute(
        select(func.count(UserProfile.user_id)).where(
            UserProfile.has_vocational_accompaniment == False  # noqa: E712
        )
    ).scalar() or 0

    interested_ministry_count = db.execute(
        select(func.count(UserProfile.user_id)).where(
            UserProfile.interested_in_ministry == True  # noqa: E712
        )
    ).scalar() or 0

    from_mission_count = db.execute(
        select(func.count(UserProfile.user_id)).where(
            UserProfile.is_from_mission == True  # noqa: E712
        )
    ).scalar() or 0

    # --- Memberships ---
    total_active_memberships = db.execute(
        select(func.count(OrgMembership.id)).where(
            OrgMembership.status == MembershipStatus.ACTIVE
        )
    ).scalar() or 0

    unit_type_rows = db.execute(
        select(OrgUnit.type, func.count(OrgMembership.id).label("cnt"))
        .join(OrgUnit, OrgMembership.org_unit_id == OrgUnit.id)
        .where(OrgMembership.status == MembershipStatus.ACTIVE)
        .group_by(OrgUnit.type)
        .order_by(desc("cnt"))
    ).all()
    by_unit_type = [
        {
            "type": r[0].value,
            "label": _UNIT_TYPE_LABELS.get(r[0].value, r[0].value),
            "count": r[1],
        }
        for r in unit_type_rows
    ]

    # --- Convites ---
    total_invites = db.execute(select(func.count(OrgInvite.id))).scalar() or 0
    accepted_invites = db.execute(
        select(func.count(OrgInvite.id)).where(OrgInvite.status == InviteStatus.ACCEPTED)
    ).scalar() or 0
    pending_invites = db.execute(
        select(func.count(OrgInvite.id)).where(OrgInvite.status == InviteStatus.PENDING)
    ).scalar() or 0
    declined_invites = db.execute(
        select(func.count(OrgInvite.id)).where(OrgInvite.status == InviteStatus.REJECTED)
    ).scalar() or 0
    acceptance_rate = round(accepted_invites / total_invites * 100, 1) if total_invites > 0 else 0.0

    # --- Top ministérios ---
    top_ministry_rows = db.execute(
        select(OrgUnit.name, func.count(OrgMembership.id).label("cnt"))
        .join(OrgUnit, OrgMembership.org_unit_id == OrgUnit.id)
        .where(
            OrgUnit.type == OrgUnitType.MINISTERIO,
            OrgMembership.status == MembershipStatus.ACTIVE,
        )
        .group_by(OrgUnit.name)
        .order_by(desc("cnt"))
        .limit(10)
    ).all()
    top_ministries = [{"name": r[0], "member_count": r[1]} for r in top_ministry_rows]

    return {
        "users": {
            "total": total_users,
            "complete_profiles": complete_profiles,
            "incomplete_profiles": incomplete_profiles,
            "new_last_7d": new_7d,
            "new_last_30d": new_30d,
        },
        "age_ranges": age_ranges,
        "geography": {
            "by_city": by_city,
            "by_state": by_state,
        },
        "profile_breakdown": {
            "by_life_state": by_life_state,
            "by_marital_status": by_marital_status,
            "by_vocational_reality": by_vocational_reality,
            "with_vocational_accompaniment": with_voc,
            "without_vocational_accompaniment": without_voc,
            "interested_in_ministry": interested_ministry_count,
            "from_mission": from_mission_count,
        },
        "memberships": {
            "total_active": total_active_memberships,
            "by_unit_type": by_unit_type,
        },
        "invites": {
            "total": total_invites,
            "accepted": accepted_invites,
            "pending": pending_invites,
            "declined": declined_invites,
            "acceptance_rate": acceptance_rate,
        },
        "top_ministries": top_ministries,
    }


# =============================================================================
# AUDIT LOGS
# =============================================================================

@router.get("/audit-logs")
async def get_audit_logs(
    current_user: CurrentUser,
    db: DBSession,
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    action: str = Query(default=None),
    actor_user_id: str = Query(default=None),
):
    """
    Lista logs de auditoria com paginação.
    Requer ADMIN, DEV ou ANALISTA.
    """
    require_admin_or_analista(db, current_user.id)

    base = select(AuditLog)

    if action:
        base = base.where(AuditLog.action == action)
    if actor_user_id:
        try:
            parsed_id = UUID(actor_user_id)
        except ValueError:
            raise HTTPException(
                status_code=400,
                detail={"error": "invalid_param", "message": "actor_user_id inválido"},
            )
        base = base.where(AuditLog.actor_user_id == parsed_id)

    total = db.execute(
        select(func.count()).select_from(base.subquery())
    ).scalar() or 0

    offset_val = (page - 1) * page_size
    rows = db.execute(
        base.order_by(desc(AuditLog.created_at)).offset(offset_val).limit(page_size)
    ).scalars().all()

    items = []
    for log in rows:
        actor_name: str | None = None
        if log.actor_user_id:
            actor_profile = db.execute(
                select(UserProfile).where(UserProfile.user_id == log.actor_user_id)
            ).scalar_one_or_none()
            actor_name = actor_profile.full_name if actor_profile else None

        items.append({
            "id": str(log.id),
            "action": log.action,
            "actor_name": actor_name,
            "entity_type": log.entity_type,
            "entity_id": log.entity_id,
            "extra_data": log.extra_data,
            "created_at": log.created_at.isoformat(),
        })

    return {
        "total": total,
        "page": page,
        "page_size": page_size,
        "items": items,
    }
