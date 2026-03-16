"""
Admin Routes
============
Endpoints administrativos.

SEGURANÇA: Toda visualização de CPF/RG é auditada obrigatoriamente.
"""

from fastapi import APIRouter, HTTPException, Query
from sqlalchemy import select, or_, func

from app.api.deps import CurrentUser, DBSession
from app.db.models import UserProfile, User, UserIdentity
from app.services.organization import get_user_global_roles

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
        raise HTTPException(
            status_code=403,
            detail={"error": "forbidden", "message": "Sem permissão para listar usuários"},
        )

    # Base query: join profile + identities
    stmt = (
        select(User)
        .join(UserProfile, UserProfile.user_id == User.id, isouter=True)
        .join(UserIdentity, UserIdentity.user_id == User.id, isouter=True)
        .where(User.is_active == True)  # noqa: E712
    )

    if search.strip():
        term = f"%{search.strip()}%"
        stmt = stmt.where(
            or_(
                UserProfile.full_name.ilike(term),
                UserIdentity.email.ilike(term),
            )
        )

    stmt = stmt.distinct().order_by(UserProfile.full_name.asc()).offset(offset).limit(limit)
    users = db.execute(stmt).scalars().all()

    # Conta total
    count_stmt = (
        select(func.count(User.id.distinct()))
        .join(UserProfile, UserProfile.user_id == User.id, isouter=True)
        .join(UserIdentity, UserIdentity.user_id == User.id, isouter=True)
        .where(User.is_active == True)  # noqa: E712
    )
    if search.strip():
        term = f"%{search.strip()}%"
        count_stmt = count_stmt.where(
            or_(
                UserProfile.full_name.ilike(term),
                UserIdentity.email.ilike(term),
            )
        )
    total = db.execute(count_stmt).scalar() or 0

    result = []
    for u in users:
        profile = u.profile
        email = u.identities[0].email if u.identities else None
        user_roles = get_user_global_roles(db, u.id)

        result.append({
            "id": str(u.id),
            "name": profile.full_name if profile else None,
            "email": email,
            "photo_url": profile.photo_url if profile else None,
            "profile_status": profile.status if profile else "INCOMPLETE",
            "global_roles": user_roles,
            "created_at": u.created_at.isoformat(),
        })

    return {"users": result, "total": total, "limit": limit, "offset": offset}
