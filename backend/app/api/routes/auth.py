"""
Rotas de Autenticação
=====================
Login, registro, /me
"""

from datetime import datetime, timezone
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.db.models import (
    User, UserIdentity, UserProfile, UserConsent,
    OrgMembership, MembershipStatus, OrgInvite, InviteStatus,
    UserGlobalRole, GlobalRole, LegalDocument,
)
from app.schemas.auth import (
    RegisterRequest,
    LoginRequest,
    TokenResponse,
    AuthResponse,
    IdentityOut,
    ConsentsStatus,
    MembershipOut,
    InviteOut,
    UserMeResponse,
)

from app.core.settings import settings

router = APIRouter(prefix="/auth", tags=["auth"])


# =============================================================================
# DEPENDENCIES
# =============================================================================

async def get_current_user(request: Request, db: Session = Depends(get_db)) -> User:
    """
    Obtém usuário autenticado.
    
    DEV mode: aceita header Authorization: Bearer dev:user_id:email
    PROD mode: valida token Firebase
    """
    auth_header = request.headers.get("Authorization", "")
    
    if not auth_header.startswith("Bearer "):
        raise HTTPException(status_code=401, detail={"error": "unauthorized", "message": "Token não fornecido"})
    
    token = auth_header.replace("Bearer ", "")
    
    if settings.auth_mode == "DEV":
        # DEV mode: token formato dev:user_id:email ou dev:email
        if not token.startswith("dev:"):
            raise HTTPException(status_code=401, detail={"error": "invalid_token", "message": "Token inválido"})
        
        parts = token.split(":")
        if len(parts) < 2:
            raise HTTPException(status_code=401, detail={"error": "invalid_token", "message": "Token inválido"})
        
        email = parts[-1] if "@" in parts[-1] else f"{parts[1]}@dev.local"
        
        # Busca ou cria usuário
        identity = db.execute(
            select(UserIdentity).where(UserIdentity.email == email)
        ).scalar_one_or_none()
        
        if identity:
            user = identity.user
        else:
            # Cria usuário
            user = User()
            db.add(user)
            db.flush()
            
            identity = UserIdentity(
                user_id=user.id,
                provider="email",
                provider_uid=email,
                email=email,
                email_verified=False,
            )
            db.add(identity)
            
            profile = UserProfile(user_id=user.id, status="INCOMPLETE")
            db.add(profile)
            
            db.commit()
            db.refresh(user)
        
        return user
    
    else:
        # PROD mode: Firebase
        # TODO: Implementar validação Firebase
        raise HTTPException(status_code=501, detail={"error": "not_implemented", "message": "Firebase auth não implementado"})


# =============================================================================
# ROUTES
# =============================================================================

@router.post("/register", response_model=AuthResponse)
async def register(data: RegisterRequest, db: Session = Depends(get_db)):
    """Registra novo usuário."""
    # Verifica se email já existe
    existing = db.execute(
        select(UserIdentity).where(UserIdentity.email == data.email)
    ).scalar_one_or_none()
    
    if existing:
        raise HTTPException(
            status_code=400,
            detail={"error": "email_exists", "message": "Email já cadastrado"}
        )
    
    # Cria usuário
    user = User()
    db.add(user)
    db.flush()
    
    # Cria identity
    identity = UserIdentity(
        user_id=user.id,
        provider="email",
        provider_uid=data.email,
        email=data.email,
        email_verified=False,
    )
    db.add(identity)
    
    # Cria profile
    profile = UserProfile(
        user_id=user.id,
        full_name=data.full_name,
        status="INCOMPLETE",
    )
    db.add(profile)
    
    db.commit()
    
    # Em DEV, retorna token fake
    if settings.auth_mode == "DEV":
        token = f"dev:{user.id}:{data.email}"
    else:
        # TODO: Gerar token real
        token = "not-implemented"
    
    return AuthResponse(
        access_token=token,
        user_id=user.id,
    )


@router.post("/login", response_model=AuthResponse)
async def login(data: LoginRequest, db: Session = Depends(get_db)):
    """Login do usuário."""
    identity = db.execute(
        select(UserIdentity).where(UserIdentity.email == data.email)
    ).scalar_one_or_none()
    
    if not identity:
        raise HTTPException(
            status_code=401,
            detail={"error": "invalid_credentials", "message": "Email ou senha inválidos"}
        )
    
    # TODO: Validar senha (quando implementar auth real)
    
    user = identity.user
    
    if settings.auth_mode == "DEV":
        token = f"dev:{user.id}:{data.email}"
    else:
        token = "not-implemented"
    
    return AuthResponse(
        access_token=token,
        user_id=user.id,
    )


@router.get("/me", response_model=UserMeResponse)
async def get_me(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Retorna dados do usuário autenticado."""
    # Identities
    identities = [
        IdentityOut(
            provider=i.provider,
            provider_uid=i.provider_uid,
            email=i.email,
            email_verified=i.email_verified,
        )
        for i in user.identities
    ]
    
    # Profile status
    profile = user.profile
    profile_status = profile.status if profile else "INCOMPLETE"
    profile_completed_at = profile.completed_at if profile else None
    phone_verified = profile.phone_verified if profile else False
    email_verified = any(i.email_verified for i in user.identities)
    
    # Consents
    latest_terms = db.execute(
        select(LegalDocument)
        .where(LegalDocument.type == "TERMS")
        .order_by(LegalDocument.published_at.desc())
    ).scalar_one_or_none()
    
    latest_privacy = db.execute(
        select(LegalDocument)
        .where(LegalDocument.type == "PRIVACY")
        .order_by(LegalDocument.published_at.desc())
    ).scalar_one_or_none()
    
    user_consent_doc_ids = set()
    consents = db.execute(
        select(UserConsent).where(UserConsent.user_id == user.id)
    ).scalars().all()
    for c in consents:
        user_consent_doc_ids.add(c.document_id)
    
    pending_terms = latest_terms and latest_terms.id not in user_consent_doc_ids
    pending_privacy = latest_privacy and latest_privacy.id not in user_consent_doc_ids
    
    consents_status = ConsentsStatus(
        status="pending" if (pending_terms or pending_privacy) else "accepted",
        pending_terms=pending_terms,
        pending_privacy=pending_privacy,
    )
    
    # Memberships
    memberships = []
    for m in user.memberships:
        if m.status == MembershipStatus.ACTIVE:
            memberships.append(MembershipOut(
                id=m.id,
                org_unit_id=m.org_unit_id,
                org_unit_name=m.org_unit.name,
                org_unit_type=m.org_unit.type.value,
                role=m.role.value,
                status=m.status.value,
                joined_at=m.joined_at,
            ))
    
    # Pending invites
    pending_invites = []
    invites = db.execute(
        select(OrgInvite)
        .where(
            OrgInvite.invited_user_id == user.id,
            OrgInvite.status == InviteStatus.PENDING,
        )
    ).scalars().all()
    
    for inv in invites:
        invited_by = db.get(User, inv.invited_by_user_id)
        invited_by_name = "Desconhecido"
        if invited_by and invited_by.profile:
            invited_by_name = invited_by.profile.full_name or "Usuário"
        
        pending_invites.append(InviteOut(
            id=inv.id,
            org_unit_id=inv.org_unit_id,
            org_unit_name=inv.org_unit.name,
            org_unit_type=inv.org_unit.type.value,
            role=inv.role.value,
            status=inv.status.value,
            message=inv.message,
            invited_by_name=invited_by_name,
            created_at=inv.created_at,
            expires_at=inv.expires_at,
        ))
    
    # Global roles
    global_roles = []
    for ugr in user.global_roles:
        global_roles.append(ugr.global_role.code)
    
    return UserMeResponse(
        user_id=user.id,
        is_active=user.is_active,
        identities=identities,
        profile_status=profile_status,
        profile_completed_at=profile_completed_at,
        phone_verified=phone_verified,
        email_verified=email_verified,
        consents=consents_status,
        memberships=memberships,
        pending_invites=pending_invites,
        global_roles=global_roles,
    )
