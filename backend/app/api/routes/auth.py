"""
Rotas de Autenticação
=====================
Login, registro, /me

get_current_user vive em app.api.deps — importado aqui para re-export,
mantendo compatibilidade com todos os módulos que fazem:
    from app.api.routes.auth import get_current_user
"""

from datetime import datetime, timezone
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.db.models import (
    User, UserIdentity, UserProfile, UserConsent,
    OrgMembership, MembershipStatus, OrgInvite, InviteStatus,
    UserGlobalRole, GlobalRole, LegalDocument, UserPreferences,
)
from app.schemas.auth import (
    RegisterRequest,
    LoginRequest,
    AuthResponse,
    IdentityOut,
    ConsentsStatus,
    MembershipOut,
    InviteOut,
    UserMeResponse,
)
from app.settings import settings

# Re-export para compatibilidade com módulos que importam daqui
from app.api.deps import get_current_user, CurrentUser  # noqa: F401

router = APIRouter(prefix="/auth", tags=["auth"])


# =============================================================================
# ROUTES
# =============================================================================

@router.post("/register", response_model=AuthResponse)
async def register(data: RegisterRequest, db: Session = Depends(get_db)):
    """Registra novo usuário (somente em modo DEV)."""
    # SEGURANÇA: verificar modo ANTES de qualquer operação no banco.
    # Em PROD, usuários são provisionados automaticamente via Firebase Auth
    # na primeira chamada autenticada — /auth/register não é necessário.
    if settings.auth_mode != "DEV":
        raise HTTPException(
            status_code=501,
            detail={
                "error": "not_implemented",
                "message": "Registro via API não disponível em produção. Use Firebase Auth.",
            },
        )

    existing = db.execute(
        select(UserIdentity).where(UserIdentity.email == data.email)
    ).scalar_one_or_none()

    if existing:
        raise HTTPException(
            status_code=400,
            detail={"error": "email_exists", "message": "Email já cadastrado"}
        )

    user = User()
    db.add(user)
    db.flush()

    identity = UserIdentity(
        user_id=user.id,
        provider="email",
        provider_uid=str(data.email),
        email=str(data.email),
        email_verified=False,
    )
    db.add(identity)

    profile = UserProfile(
        user_id=user.id,
        full_name=data.full_name,
        status="INCOMPLETE",
    )
    db.add(profile)

    db.commit()

    token = f"dev:{user.id}:{data.email}"
    return AuthResponse(
        access_token=token,
        user_id=user.id,
    )


@router.post("/login", response_model=AuthResponse)
async def login(data: LoginRequest, db: Session = Depends(get_db)):
    """Login do usuário."""
    if settings.auth_mode != "DEV":
        # Em PROD, /auth/login não está implementado — use Firebase Auth diretamente
        raise HTTPException(
            status_code=501,
            detail={
                "error": "not_implemented",
                "message": "Login via API não disponível em produção. Use Firebase Auth.",
            },
        )

    identity = db.execute(
        select(UserIdentity).where(UserIdentity.email == str(data.email))
    ).scalar_one_or_none()

    if not identity:
        raise HTTPException(
            status_code=401,
            detail={"error": "invalid_credentials", "message": "Email ou senha inválidos"}
        )

    # TODO: Validar senha (quando implementar auth real com Firebase)

    user = identity.user
    token = f"dev:{user.id}:{data.email}"
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

    pending_terms = bool(latest_terms and latest_terms.id not in user_consent_doc_ids)
    pending_privacy = bool(latest_privacy and latest_privacy.id not in user_consent_doc_ids)

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

    # Pending invites (exclui expirados)
    pending_invites = []
    now = datetime.now(timezone.utc)
    invites = db.execute(
        select(OrgInvite)
        .where(
            OrgInvite.invited_user_id == user.id,
            OrgInvite.status == InviteStatus.PENDING,
        )
    ).scalars().all()

    for inv in invites:
        # Filtra expirados sem alterar status (a expiração formal ocorre no respond_to_invite)
        if inv.expires_at and inv.expires_at < now:
            continue

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
    global_roles = [ugr.global_role.code for ugr in user.global_roles]

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


@router.delete("/me", status_code=204)
async def delete_me(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Exclusão de conta — LGPD art. 18, VI (eliminação de dados).

    Estratégia: anonimização (não exclusão da linha User) para preservar
    os registros de auditoria e os consentimentos aceitos, conforme
    obrigação legal de retenção de 5 anos declarada na Política de
    Privacidade.

    O que é removido imediatamente:
    - UserProfile (CPF, RG e todos os dados pessoais)
    - UserPreferences
    - OrgMembership e UserGlobalRole
    - E-mail anonimizado em UserIdentity

    O que é retido (obrigação legal):
    - Linha User (is_active=False) — âncora para logs de auditoria
    - UserConsent — evidência legal de aceite dos termos (5 anos)
    - AuditLog — rastreabilidade de segurança (5 anos)
    """
    from app.audit.service import create_audit_log

    user_id = user.id

    # 1. Deleta perfil (CPF/RG criptografados e dados biográficos)
    if user.profile:
        db.delete(user.profile)

    # 2. Anonimiza identidades (user_id.hex garante unicidade da constraint)
    for identity in user.identities:
        anon = f"deleted+{user_id.hex}@deleted.invalid"
        identity.email = anon
        identity.provider_uid = anon
        identity.email_verified = False

    # 3. Remove memberships e global roles
    for m in list(user.memberships):
        db.delete(m)
    for ugr in list(user.global_roles):
        db.delete(ugr)

    # 4. Remove preferências
    prefs = db.execute(
        select(UserPreferences).where(UserPreferences.user_id == user_id)
    ).scalar_one_or_none()
    if prefs:
        db.delete(prefs)

    # 5. Desativa conta
    user.is_active = False

    # 6. Registra a exclusão no audit log (sem dados pessoais)
    create_audit_log(
        db=db,
        actor_user_id=user_id,
        action="account_deleted",
        entity_type="user",
        entity_id=str(user_id),
        metadata={"reason": "user_request", "lgpd_art": "18_VI"},
    )

    db.commit()
