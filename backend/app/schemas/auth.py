from pydantic import BaseModel, EmailStr, Field
from typing import Optional, List
from uuid import UUID
from datetime import datetime


# =============================================================================
# BASE
# =============================================================================

class BaseSchema(BaseModel):
    """Base para todos os schemas."""
    class Config:
        from_attributes = True


# =============================================================================
# REQUESTS
# =============================================================================

class RegisterRequest(BaseModel):
    """Registro de novo usuário."""
    email: EmailStr
    password: str = Field(..., min_length=6)
    full_name: str = Field(..., min_length=2)


class LoginRequest(BaseModel):
    """Login do usuário."""
    email: EmailStr
    password: str


# =============================================================================
# RESPONSES
# =============================================================================

class TokenResponse(BaseModel):
    """Resposta com token."""
    access_token: str
    token_type: str = "bearer"


class AuthResponse(BaseModel):
    """Resposta de autenticação (login/registro)."""
    access_token: str
    token_type: str = "bearer"
    user_id: UUID


class IdentityOut(BaseModel):
    """Identity do usuário."""
    provider: str
    provider_uid: str
    email: Optional[str] = None
    email_verified: bool = False

    class Config:
        from_attributes = True


class ConsentsStatus(BaseModel):
    """Status dos consentimentos."""
    status: str  # "pending" | "accepted"
    pending_terms: bool = False
    pending_privacy: bool = False


class MembershipOut(BaseModel):
    """Membership do usuário."""
    id: UUID
    org_unit_id: UUID
    org_unit_name: str
    org_unit_type: str
    role: str
    status: str
    joined_at: datetime

    class Config:
        from_attributes = True


class InviteOut(BaseModel):
    """Convite pendente."""
    id: UUID
    org_unit_id: UUID
    org_unit_name: str
    org_unit_type: str
    role: str
    status: str
    message: Optional[str] = None
    invited_by_name: str
    created_at: datetime
    expires_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class UserMeResponse(BaseModel):
    """Resposta completa do /me."""
    user_id: UUID
    is_active: bool = True
    identities: List[IdentityOut] = []
    profile_status: str = "INCOMPLETE"
    profile_completed_at: Optional[datetime] = None
    phone_verified: bool = False
    email_verified: bool = False
    consents: ConsentsStatus
    memberships: List[MembershipOut] = []
    pending_invites: List[InviteOut] = []
    global_roles: List[str] = []

    class Config:
        from_attributes = True
