from typing import Annotated, Generator

from fastapi import Depends, Header, HTTPException, Request, status
from sqlalchemy.orm import Session

from app.auth.firebase import FirebaseAuth, TokenPayload
from app.db.models import User, UserIdentity
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
            detail={"error": "unauthorized", "message": "Missing authorization header"},
        )

    if not authorization.startswith("Bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"error": "unauthorized", "message": "Invalid authorization format"},
        )

    token = authorization[7:]

    try:
        payload = firebase_auth.verify_token(token)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"error": "unauthorized", "message": str(e)},
        )

    user = provision_user(db, payload, request)
    return user


def provision_user(db: Session, payload: TokenPayload, request: Request) -> User:
    from app.audit.service import create_audit_log

    identity = (
        db.query(UserIdentity)
        .filter(
            UserIdentity.provider == "firebase",
            UserIdentity.provider_uid == payload.uid,
        )
        .first()
    )

    if identity:
        if identity.user and not identity.user.is_active:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail={"error": "forbidden", "message": "User account is deactivated"},
            )
        return identity.user  # type: ignore[return-value]

    user = User(is_active=True)
    db.add(user)
    db.flush()

    identity = UserIdentity(
        user_id=user.id,
        provider="firebase",
        provider_uid=payload.uid,
        email=payload.email,
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
