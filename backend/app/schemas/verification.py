"""
Verification Schemas
====================
Schemas para verificação de telefone.
"""

from datetime import datetime
from uuid import UUID

from pydantic import Field

from app.schemas.base import BaseSchema


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
