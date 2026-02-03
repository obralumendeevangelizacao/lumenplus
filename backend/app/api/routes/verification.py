"""
Verification Routes
===================
Endpoints para verificação de telefone.
"""

import hashlib
import secrets
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, HTTPException, Request, status

from app.api.deps import CurrentUser, DBSession
from app.core.settings import settings
from app.db.models import PhoneVerification, UserProfile
from app.notifications.provider import notification_provider, MockNotificationProvider
from app.schemas import (
    ConfirmVerificationRequest,
    ConfirmVerificationResponse,
    ErrorResponse,
    StartVerificationRequest,
    StartVerificationResponse,
)
from app.services import create_audit_log

router = APIRouter(prefix="/verify", tags=["Verification"])

CODE_LENGTH = 6
CODE_EXPIRY_MINUTES = 10
MAX_ATTEMPTS = 3


def generate_code() -> str:
    return "".join(secrets.choice("0123456789") for _ in range(CODE_LENGTH))


def hash_code(code: str) -> str:
    return hashlib.sha256(code.encode()).hexdigest()


@router.post("/phone/start", response_model=StartVerificationResponse)
async def start_phone_verification(
    request: Request, body: StartVerificationRequest, current_user: CurrentUser, db: DBSession
) -> StartVerificationResponse:
    if not settings.enable_phone_verification:
        raise HTTPException(status_code=503, detail={"error": "service_unavailable", "message": "Verificação desabilitada"})

    one_hour_ago = datetime.now(timezone.utc) - timedelta(hours=1)
    recent_count = db.query(PhoneVerification).filter(PhoneVerification.user_id == current_user.id, PhoneVerification.created_at > one_hour_ago).count()

    if recent_count >= settings.rate_limit_verification_per_hour:
        raise HTTPException(status_code=429, detail={"error": "rate_limit", "message": "Muitas tentativas"})

    profile = db.query(UserProfile).filter(UserProfile.user_id == current_user.id).first()
    if not profile or profile.phone_e164 != body.phone_e164:
        raise HTTPException(status_code=400, detail={"error": "bad_request", "message": "Telefone não corresponde ao perfil"})

    code = generate_code()
    expires_at = datetime.now(timezone.utc) + timedelta(minutes=CODE_EXPIRY_MINUTES)

    verification = PhoneVerification(user_id=current_user.id, phone_e164=body.phone_e164, channel=body.channel, code_hash=hash_code(code), expires_at=expires_at)
    db.add(verification)

    message = f"Seu código Lumen+: {code}. Válido por {CODE_EXPIRY_MINUTES} min."
    try:
        if body.channel == "SMS":
            notification_provider.send_sms(body.phone_e164, message)
        else:
            notification_provider.send_whatsapp(body.phone_e164, message)
    except NotImplementedError:
        if not settings.is_dev:
            db.rollback()
            raise HTTPException(status_code=503, detail={"error": "service_unavailable", "message": "Notificação indisponível"})

    if settings.is_dev and isinstance(notification_provider, MockNotificationProvider):
        notification_provider.set_last_code(code)

    create_audit_log(db=db, actor_user_id=current_user.id, action="phone_verification_started", entity_type="phone_verification", entity_id=str(verification.id), ip=request.client.host if request.client else None, user_agent=request.headers.get("user-agent"), metadata={"channel": body.channel})
    db.commit()
    db.refresh(verification)

    return StartVerificationResponse(verification_id=verification.id, expires_at=verification.expires_at, debug_code=code if settings.debug_verification_code else None)


@router.post("/phone/confirm", response_model=ConfirmVerificationResponse)
async def confirm_phone_verification(
    request: Request, body: ConfirmVerificationRequest, current_user: CurrentUser, db: DBSession
) -> ConfirmVerificationResponse:
    verification = db.query(PhoneVerification).filter(PhoneVerification.id == body.verification_id, PhoneVerification.user_id == current_user.id).first()

    if not verification:
        raise HTTPException(status_code=404, detail={"error": "not_found", "message": "Verificação não encontrada"})
    if verification.verified_at:
        return ConfirmVerificationResponse(verified=True, message="Já verificado")
    if verification.expires_at < datetime.now(timezone.utc):
        raise HTTPException(status_code=400, detail={"error": "expired", "message": "Código expirado"})
    if verification.attempts >= MAX_ATTEMPTS:
        raise HTTPException(status_code=400, detail={"error": "max_attempts", "message": "Máximo de tentativas"})

    verification.attempts += 1

    if hash_code(body.code) != verification.code_hash:
        db.commit()
        raise HTTPException(status_code=400, detail={"error": "invalid_code", "message": f"Código inválido. {MAX_ATTEMPTS - verification.attempts} restantes"})

    verification.verified_at = datetime.now(timezone.utc)
    profile = db.query(UserProfile).filter(UserProfile.user_id == current_user.id).first()
    if profile:
        profile.phone_verified = True
        profile.status = "COMPLETE"
        if not profile.completed_at:
            profile.completed_at = datetime.now(timezone.utc)

    create_audit_log(db=db, actor_user_id=current_user.id, action="phone_verified", entity_type="phone_verification", entity_id=str(verification.id), ip=request.client.host if request.client else None, user_agent=request.headers.get("user-agent"))
    db.commit()

    return ConfirmVerificationResponse(verified=True, message="Telefone verificado")
