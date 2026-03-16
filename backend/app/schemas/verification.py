"""
Verification Schemas
====================
Schemas para verificação de telefone e e-mail.
"""

from datetime import datetime
from uuid import UUID

from pydantic import Field

from app.schemas.base import BaseSchema


# =============================================================================
# PHONE
# =============================================================================

class StartVerificationRequest(BaseSchema):
    """Request para iniciar verificação de telefone."""
    
    phone_e164: str = Field(..., pattern=r"^\+[1-9]\d{10,14}$")
    channel: str = Field(..., pattern="^(SMS|WHATSAPP)$")


class StartVerificationResponse(BaseSchema):
    """Response após iniciar verificação."""
    
    verification_id: UUID
    expires_at: datetime
    # debug_code só aparece quando DEBUG_VERIFICATION_CODE=true
    debug_code: str | None = None


class ConfirmVerificationRequest(BaseSchema):
    """Request para confirmar código de verificação."""
    
    verification_id: UUID
    code: str = Field(..., min_length=6, max_length=6)


class ConfirmVerificationResponse(BaseSchema):
    """Response após confirmar verificação."""

    verified: bool
    message: str


# =============================================================================
# EMAIL
# =============================================================================

class StartEmailVerificationRequest(BaseSchema):
    """Request para iniciar verificação de e-mail."""

    email: str = Field(..., pattern=r"^[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+$")


class StartEmailVerificationResponse(BaseSchema):
    """Response após iniciar verificação de e-mail."""

    verification_id: UUID
    expires_at: datetime
    # debug_token só aparece quando DEBUG_VERIFICATION_CODE=true em DEV
    debug_token: str | None = None


class ConfirmEmailVerificationRequest(BaseSchema):
    """Request para confirmar token de e-mail."""

    token: str = Field(..., min_length=32, max_length=200)


class EmailVerificationResponse(BaseSchema):
    """Response após confirmar verificação de e-mail."""

    verified: bool
    message: str
