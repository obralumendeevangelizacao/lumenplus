"""Phone verification endpoints."""

import hashlib
import secrets
from datetime import datetime, timedelta, timezone
from uuid import UUID

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field

from app.api.deps import CurrentUser, DBSession
from app.audit.service import create_audit_log
from app.db.models import PhoneVerification, UserProfile
from app.notifications.provider import notification_provider, MockNotificationProvider
from app.settings import settings

router = APIRouter(prefix="/verify", tags=["Verification"])

CODE_LENGTH = 6
CODE_EXPIRY_MINUTES = 10
MAX_ATTEMPTS = 3


class StartVerificationRequest(BaseModel):
    phone_e164: str = Field(..., pattern=r"^\+[1-9]\d{10,14}$")
    channel: str = Field(..., pattern="^(SMS|WHATSAPP)$")


class StartVerificationResponse(BaseModel):
    verification_id: UUID
    expires_at: datetime
    debug_code: str | None = None


class ConfirmVerificationRequest(BaseModel):
    verification_id: UUID
    code: str = Field(..., min_length=6, max_length=6)


class ConfirmVerificationResponse(BaseModel):
    verified: bool
    message: str


def generate_code() -> str:
    return "".join(secrets.choice("0123456789") for _ in range(CODE_LENGTH))


def hash_code(code: str) -> str:
    return hashlib.sha256(code.encode()).hexdigest()


@router.post("/phone/start", response_model=StartVerificationResponse)
async def start_phone_verification(
    request: Request,
    body: StartVerificationRequest,
    current_user: CurrentUser,
    db: DBSession,
) -> StartVerificationResponse:
    """Start phone verification process."""
    # Rate limit
    one_hour_ago = datetime.now(timezone.utc) - timedelta(hours=1)
    recent_count = db.query(PhoneVerification).filter(
        PhoneVerification.user_id == current_user.id,
        PhoneVerification.created_at > one_hour_ago,
    ).count()

    if recent_count >= settings.rate_limit_verification_per_hour:
        raise HTTPException(status_code=429, detail={"error": "rate_limit", "message": "Too many verification attempts. Try again later."})

    # Verify phone matches profile
    profile = db.query(UserProfile).filter(UserProfile.user_id == current_user.id).first()
    if not profile or profile.phone_e164 != body.phone_e164:
        raise HTTPException(status_code=400, detail={"error": "bad_request", "message": "Phone number does not match profile"})

    code = generate_code()
    code_hash = hash_code(code)
    expires_at = datetime.now(timezone.utc) + timedelta(minutes=CODE_EXPIRY_MINUTES)

    verification = PhoneVerification(
        user_id=current_user.id,
        phone_e164=body.phone_e164,
        channel=body.channel,
        code_hash=code_hash,
        expires_at=expires_at,
    )
    db.add(verification)

    # Send message
    message = f"Seu código de verificação Lumen+ é: {code}. Válido por {CODE_EXPIRY_MINUTES} minutos."
    try:
        if body.channel == "SMS":
            notification_provider.send_sms(body.phone_e164, message)
        else:
            notification_provider.send_whatsapp(body.phone_e164, message)
    except NotImplementedError:
        if not settings.is_dev:
            db.rollback()
            raise HTTPException(status_code=503, detail={"error": "service_unavailable", "message": "Notification service not available"})

    # Store code for testing
    if settings.is_dev and isinstance(notification_provider, MockNotificationProvider):
        notification_provider.set_last_code(code)

    create_audit_log(db=db, actor_user_id=current_user.id, action="phone_verification_started", entity_type="phone_verification", entity_id=str(verification.id), ip=request.client.host if request.client else None, user_agent=request.headers.get("user-agent"), metadata={"channel": body.channel})
    db.commit()
    db.refresh(verification)

    debug_code = code if settings.is_dev and settings.debug_verification_code else None
    return StartVerificationResponse(verification_id=verification.id, expires_at=verification.expires_at, debug_code=debug_code)


@router.post("/phone/confirm", response_model=ConfirmVerificationResponse)
async def confirm_phone_verification(
    request: Request,
    body: ConfirmVerificationRequest,
    current_user: CurrentUser,
    db: DBSession,
) -> ConfirmVerificationResponse:
    """Confirm phone verification with code."""
    verification = db.query(PhoneVerification).filter(
        PhoneVerification.id == body.verification_id,
        PhoneVerification.user_id == current_user.id,
    ).first()

    if not verification:
        raise HTTPException(status_code=404, detail={"error": "not_found", "message": "Verification not found"})

    if verification.verified_at:
        return ConfirmVerificationResponse(verified=True, message="Already verified")

    if verification.expires_at < datetime.now(timezone.utc):
        raise HTTPException(status_code=400, detail={"error": "expired", "message": "Verification code expired"})

    if verification.attempts >= MAX_ATTEMPTS:
        raise HTTPException(status_code=400, detail={"error": "max_attempts", "message": "Maximum attempts exceeded"})

    verification.attempts += 1
    code_hash = hash_code(body.code)

    if code_hash != verification.code_hash:
        db.commit()
        remaining = MAX_ATTEMPTS - verification.attempts
        raise HTTPException(status_code=400, detail={"error": "invalid_code", "message": f"Invalid code. {remaining} attempts remaining."})

    verification.verified_at = datetime.now(timezone.utc)

    # Update profile
    profile = db.query(UserProfile).filter(UserProfile.user_id == current_user.id).first()
    if profile:
        profile.phone_verified = True
        profile.status = "COMPLETE"
        if not profile.completed_at:
            profile.completed_at = datetime.now(timezone.utc)

    create_audit_log(db=db, actor_user_id=current_user.id, action="phone_verified", entity_type="phone_verification", entity_id=str(verification.id), ip=request.client.host if request.client else None, user_agent=request.headers.get("user-agent"))
    db.commit()

    return ConfirmVerificationResponse(verified=True, message="Phone verified successfully")