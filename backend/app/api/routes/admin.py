"""
Admin Routes
============
Endpoints administrativos.

SEGURANÇA: Toda visualização de CPF/RG é auditada obrigatoriamente.
"""

from uuid import UUID

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import select, or_, func, exists, nullslast, delete

from app.api.deps import CurrentUser, DBSession
from app.db.models import UserProfile, User, UserIdentity, UserGlobalRole, GlobalRole
from app.services.organization import get_user_global_roles, is_conselho_geral_coordinator

router = APIRouter(prefix="/admin", tags=["Admin"])


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
