"""
Dependências compartilhadas do FastAPI.
Fonte única de get_current_user — todos os routers importam daqui.
"""

from typing import Annotated, Generator

from fastapi import Depends, Header, HTTPException, Request, status
from sqlalchemy.orm import Session

from app.auth.firebase import FirebaseAuth, TokenPayload
from app.db.models import User, UserIdentity, UserProfile
from app.db.session import SessionLocal
from app.settings import settings


def get_db() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


DBSession = Annotated[Session, Depends(get_db)]


firebase_auth = FirebaseAuth(
    project_id=settings.firebase_project_id,
    dev_mode=(settings.auth_mode == "DEV"),
)


async def get_current_user(
    request: Request,
    db: DBSession,
    authorization: Annotated[str | None, Header()] = None,
) -> User:
    if not authorization:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"error": "unauthorized", "message": "Header de autorização ausente"},
        )

    if not authorization.startswith("Bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={
                "error": "unauthorized",
                "message": "Formato de autorização inválido. Use: Bearer <token>",
            },
        )

    token = authorization[7:]

    try:
        payload = firebase_auth.verify_token(token)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"error": "unauthorized", "message": str(e)},
        )

    user = _provision_user(db, payload, request)
    return user


def _provision_user(db: Session, payload: TokenPayload, request: Request) -> User:
    """
    Encontra ou cria o usuário para o token verificado.

    Lookup em ordem:
    1. Por (provider, provider_uid) — caminho principal Firebase / DEV novo
    2. Por email — fallback de compatibilidade com usuários criados via /auth/register
    Se não encontrar nenhum, provisiona um novo com identidade firebase.
    """
    from app.audit.service import create_audit_log

    # 1. Lookup primário: provider + uid
    identity = (
        db.query(UserIdentity)
        .filter(
            UserIdentity.provider == "firebase",
            UserIdentity.provider_uid == payload.uid,
        )
        .first()
    )

    # 2. Fallback DEV: lookup por email (compatibilidade com identidades criadas via /auth/register)
    if identity is None and payload.email:
        identity = db.query(UserIdentity).filter(UserIdentity.email == payload.email).first()

    if identity is not None:
        if identity.user and not identity.user.is_active:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail={"error": "forbidden", "message": "Conta de usuário desativada"},
            )
        return identity.user  # type: ignore[return-value]

    # 3. Provisionar novo usuário
    user = User(is_active=True)
    db.add(user)
    db.flush()

    # Garante que o perfil existe desde o início
    profile = UserProfile(user_id=user.id, status="INCOMPLETE")
    db.add(profile)

    identity = UserIdentity(
        user_id=user.id,
        provider="firebase",
        provider_uid=payload.uid,
        email=payload.email,
        email_verified=payload.email_verified,
    )
    db.add(identity)

    create_audit_log(
        db=db,
        actor_user_id=user.id,
        action="user_provisioned",
        entity_type="user",
        entity_id=str(user.id),
        ip=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
        metadata={"provider": "firebase", "email": payload.email},
    )

    db.commit()
    db.refresh(user)

    return user


CurrentUser = Annotated[User, Depends(get_current_user)]
