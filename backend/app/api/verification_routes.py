"""
Rotas de Verificacao de Telefone e E-mail
==========================================
Schemas vivem em app.schemas.verification -- este modulo apenas orquestra.

SEGURANCA:
  - phone_e164/email e codigos sao enviados no BODY (nunca em query string)
  - OTP de telefone armazenado apenas como hash SHA-256
  - Token de e-mail armazenado apenas como hash SHA-256
  - debug_code/debug_token so retornados quando DEBUG_VERIFICATION_CODE=true (DEV)
"""

import hashlib
import secrets
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, HTTPException, Request

from app.api.deps import CurrentUser, DBSession
from app.audit.service import create_audit_log
from app.db.models import EmailVerification, PhoneVerification, UserIdentity, UserProfile
from app.notifications.provider import MockNotificationProvider, notification_provider
from app.schemas.verification import (
    ConfirmEmailVerificationRequest,
    ConfirmVerificationRequest,
    ConfirmVerificationResponse,
    EmailVerificationResponse,
    StartEmailVerificationRequest,
    StartEmailVerificationResponse,
    StartVerificationRequest,
    StartVerificationResponse,
)
from app.settings import settings

router = APIRouter(prefix="/verify", tags=["Verification"])

CODE_LENGTH = 6
CODE_EXPIRY_MINUTES = 10
MAX_ATTEMPTS = 3


def _generate_code() -> str:
    """Gera OTP de 6 digitos usando gerador criptograficamente seguro."""
    return "".join(secrets.choice("0123456789") for _ in range(CODE_LENGTH))


def _hash_code(code: str) -> str:
    """SHA-256 do codigo OTP -- nunca armazenamos o codigo em claro."""
    return hashlib.sha256(code.encode()).hexdigest()


# =============================================================================
# INICIAR VERIFICACAO
# =============================================================================


@router.post("/phone/start", response_model=StartVerificationResponse)
async def start_phone_verification(
    request: Request,
    body: StartVerificationRequest,
    current_user: CurrentUser,
    db: DBSession,
) -> StartVerificationResponse:
    """
    Inicia verificacao de telefone via SMS ou WhatsApp.

    SEGURANCA: phone_e164 e channel sao recebidos no request body,
    nunca como query parameters (evita exposicao em logs e proxies).
    """
    if not settings.enable_phone_verification:
        raise HTTPException(
            status_code=503,
            detail={
                "error": "service_unavailable",
                "message": "Verificacao de telefone desabilitada",
            },
        )

    # Rate limit por usuario
    one_hour_ago = datetime.now(timezone.utc) - timedelta(hours=1)
    recent_count = (
        db.query(PhoneVerification)
        .filter(
            PhoneVerification.user_id == current_user.id,
            PhoneVerification.created_at > one_hour_ago,
        )
        .count()
    )
    if recent_count >= settings.rate_limit_verification_per_hour:
        raise HTTPException(
            status_code=429,
            detail={
                "error": "rate_limit",
                "message": "Muitas tentativas. Aguarde antes de tentar novamente.",
            },
        )

    # Verifica / inicializa telefone no perfil
    # Fluxo de cadastro novo (Firebase): perfil pode não existir ainda ou não ter telefone.
    # Nesse caso, salvamos o telefone agora e prosseguimos com a verificação.
    # Se o perfil já possui um telefone diferente, rejeitamos (proteção contra troca silenciosa).
    profile = db.query(UserProfile).filter(UserProfile.user_id == current_user.id).first()
    if profile and profile.phone_e164 and profile.phone_e164 != body.phone_e164:
        raise HTTPException(
            status_code=400,
            detail={
                "error": "bad_request",
                "message": "Telefone nao corresponde ao perfil cadastrado",
            },
        )
    elif not profile:
        # Primeiro acesso: cria perfil com o telefone informado
        profile = UserProfile(user_id=current_user.id, phone_e164=body.phone_e164)
        db.add(profile)
        db.flush()
    elif not profile.phone_e164:
        # Perfil existe mas ainda sem telefone (cadastro via Firebase)
        profile.phone_e164 = body.phone_e164

    code = _generate_code()
    expires_at = datetime.now(timezone.utc) + timedelta(minutes=CODE_EXPIRY_MINUTES)

    verification = PhoneVerification(
        user_id=current_user.id,
        phone_e164=body.phone_e164,
        channel=body.channel,
        code_hash=_hash_code(code),
        expires_at=expires_at,
    )
    db.add(verification)

    # Envia notificacao
    message = (
        f"Seu codigo de verificacao Lumen+ e: {code}. Valido por {CODE_EXPIRY_MINUTES} minutos."
    )
    _provider = notification_provider
    try:
        if _provider is None:
            raise NotImplementedError("No notification provider configured")
        if body.channel == "SMS":
            _provider.send_sms(body.phone_e164, message)
        else:
            _provider.send_whatsapp(body.phone_e164, message)
    except NotImplementedError:
        if not settings.is_dev:
            db.rollback()
            raise HTTPException(
                status_code=503,
                detail={
                    "error": "service_unavailable",
                    "message": "Servico de notificacao indisponivel",
                },
            )

    # Em DEV com mock provider: salva codigo para testes
    if settings.is_dev and isinstance(notification_provider, MockNotificationProvider):
        notification_provider.set_last_code(code)

    create_audit_log(
        db=db,
        actor_user_id=current_user.id,
        action="phone_verification_started",
        entity_type="phone_verification",
        entity_id=str(verification.id) if verification.id else None,
        ip=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
        metadata={"channel": body.channel},
    )
    db.commit()
    db.refresh(verification)

    # debug_code so aparece em DEV com DEBUG_VERIFICATION_CODE=true
    debug_code = code if (settings.is_dev and settings.debug_verification_code) else None

    return StartVerificationResponse(
        verification_id=verification.id,
        expires_at=verification.expires_at,
        debug_code=debug_code,
    )


# =============================================================================
# CONFIRMAR CODIGO
# =============================================================================


@router.post("/phone/confirm", response_model=ConfirmVerificationResponse)
async def confirm_phone_verification(
    request: Request,
    body: ConfirmVerificationRequest,
    current_user: CurrentUser,
    db: DBSession,
) -> ConfirmVerificationResponse:
    """
    Confirma o codigo OTP enviado por SMS/WhatsApp.

    Regras de seguranca:
      - Codigo comparado via hash (nunca em texto claro no banco)
      - Maximo de 3 tentativas por verificacao
      - Expiracao de 10 minutos
    """
    verification = (
        db.query(PhoneVerification)
        .filter(
            PhoneVerification.id == body.verification_id,
            PhoneVerification.user_id == current_user.id,
        )
        .first()
    )

    if not verification:
        raise HTTPException(
            status_code=404,
            detail={"error": "not_found", "message": "Verificacao nao encontrada"},
        )

    if verification.verified_at:
        return ConfirmVerificationResponse(verified=True, message="Telefone ja verificado")

    if verification.expires_at < datetime.now(timezone.utc):
        raise HTTPException(
            status_code=400,
            detail={"error": "expired", "message": "Codigo de verificacao expirado"},
        )

    if verification.attempts >= MAX_ATTEMPTS:
        raise HTTPException(
            status_code=400,
            detail={"error": "max_attempts", "message": "Numero maximo de tentativas atingido"},
        )

    verification.attempts += 1

    if _hash_code(body.code) != verification.code_hash:
        db.commit()
        remaining = MAX_ATTEMPTS - verification.attempts
        raise HTTPException(
            status_code=400,
            detail={
                "error": "invalid_code",
                "message": f"Codigo invalido. {remaining} tentativa(s) restante(s)",
            },
        )

    verification.verified_at = datetime.now(timezone.utc)

    # Atualiza status do perfil
    profile = db.query(UserProfile).filter(UserProfile.user_id == current_user.id).first()
    if profile:
        profile.phone_verified = True
        profile.status = "COMPLETE"
        if not profile.completed_at:
            profile.completed_at = datetime.now(timezone.utc)

    create_audit_log(
        db=db,
        actor_user_id=current_user.id,
        action="phone_verified",
        entity_type="phone_verification",
        entity_id=str(verification.id),
        ip=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
    )
    db.commit()

    return ConfirmVerificationResponse(verified=True, message="Telefone verificado com sucesso")


# =============================================================================
# VERIFICACAO DE E-MAIL
# =============================================================================

EMAIL_TOKEN_EXPIRY_MINUTES = 30


@router.post("/email/start", response_model=StartEmailVerificationResponse)
async def start_email_verification(
    request: Request,
    body: StartEmailVerificationRequest,
    current_user: CurrentUser,
    db: DBSession,
) -> StartEmailVerificationResponse:
    """
    Inicia verificacao de e-mail.
    Gera token seguro, armazena hash, retorna debug_token em DEV.
    """
    if not settings.enable_email_verification:
        raise HTTPException(
            status_code=503,
            detail={
                "error": "service_unavailable",
                "message": "Verificacao de e-mail desabilitada",
            },
        )

    # Valida que o e-mail pertence a uma identidade do usuario
    identity = (
        db.query(UserIdentity)
        .filter(
            UserIdentity.user_id == current_user.id,
            UserIdentity.email == body.email,
        )
        .first()
    )
    if not identity:
        raise HTTPException(
            status_code=400,
            detail={"error": "bad_request", "message": "E-mail nao corresponde ao cadastro"},
        )

    if identity.email_verified:
        raise HTTPException(
            status_code=400,
            detail={"error": "already_verified", "message": "E-mail ja verificado"},
        )

    # Gera token URL-safe (32 bytes = 43 chars base64url)
    token = secrets.token_urlsafe(32)
    token_hash = hashlib.sha256(token.encode()).hexdigest()
    expires_at = datetime.now(timezone.utc) + timedelta(minutes=EMAIL_TOKEN_EXPIRY_MINUTES)

    verification = EmailVerification(
        user_id=current_user.id,
        email=body.email,
        token_hash=token_hash,
        expires_at=expires_at,
    )
    db.add(verification)

    create_audit_log(
        db=db,
        actor_user_id=current_user.id,
        action="email_verification_started",
        entity_type="email_verification",
        entity_id=None,
        ip=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
        metadata={"email_prefix": body.email[:3] + "***"},
    )
    db.commit()
    db.refresh(verification)

    # debug_token so aparece em DEV com DEBUG_VERIFICATION_CODE=true
    debug_token = token if (settings.is_dev and settings.debug_verification_code) else None

    return StartEmailVerificationResponse(
        verification_id=verification.id,
        expires_at=verification.expires_at,
        debug_token=debug_token,
    )


@router.post("/email/confirm", response_model=EmailVerificationResponse)
async def confirm_email_verification(
    request: Request,
    body: ConfirmEmailVerificationRequest,
    current_user: CurrentUser,
    db: DBSession,
) -> EmailVerificationResponse:
    """
    Confirma o token de verificacao de e-mail.
    Token comparado via hash SHA-256 (nunca armazenado em texto claro).
    """
    token_hash = hashlib.sha256(body.token.encode()).hexdigest()

    verification = (
        db.query(EmailVerification)
        .filter(
            EmailVerification.token_hash == token_hash,
            EmailVerification.user_id == current_user.id,
        )
        .first()
    )

    if not verification:
        raise HTTPException(
            status_code=400,
            detail={"error": "invalid_token", "message": "Token invalido"},
        )

    if verification.verified_at:
        return EmailVerificationResponse(verified=True, message="E-mail ja verificado")

    if verification.expires_at < datetime.now(timezone.utc):
        raise HTTPException(
            status_code=400,
            detail={"error": "expired", "message": "Token expirado. Solicite um novo."},
        )

    verification.verified_at = datetime.now(timezone.utc)

    # Marca identidade como verificada
    identity = (
        db.query(UserIdentity)
        .filter(
            UserIdentity.user_id == current_user.id,
            UserIdentity.email == verification.email,
        )
        .first()
    )
    if identity:
        identity.email_verified = True

    create_audit_log(
        db=db,
        actor_user_id=current_user.id,
        action="email_verified",
        entity_type="email_verification",
        entity_id=str(verification.id),
        ip=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
    )
    db.commit()

    return EmailVerificationResponse(verified=True, message="E-mail verificado com sucesso")
