"""
Schemas — ponto de entrada público
====================================
Re-exporta todos os schemas públicos agrupados por domínio.

Uso preferido:
    from app.schemas import RegisterRequest, ProfileOut, OrgUnitOut
    # ou
    from app.schemas.auth import RegisterRequest  # import direto também funciona

Não importe de sub-módulos internos que não estejam listados aqui.
"""

# --- Base / utilitários -------------------------------------------------------
from app.schemas.base import (
    BaseSchema,
    ErrorDetail,
    ErrorResponse,
    SuccessResponse,
    PaginatedResponse,
    HealthResponse,
    AuditInfo,
)

# --- Auth ---------------------------------------------------------------------
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

# --- Profile ------------------------------------------------------------------
from app.schemas.profile import (
    ProfileUpdateRequest,
    ProfileOut,
    ProfileWithLabelsOut,
    EmergencyContactRequest,
    EmergencyContactOut,
    CatalogItemOut,
    CatalogOut,
    PhotoUploadResponse,
)

# --- Verification (telefone) --------------------------------------------------
from app.schemas.verification import (
    StartVerificationRequest,
    StartVerificationResponse,
    ConfirmVerificationRequest,
    ConfirmVerificationResponse,
)

# --- Organization -------------------------------------------------------------
from app.schemas.organization import (
    CreateOrgUnitRequest,
    OrgUnitOut,
    OrgUnitWithChildren,
    OrgTreeResponse,
    SendInviteRequest,
    InviteResponse,
    InviteDetailOut,
    PendingInvitesResponse,
    MemberOut,
    MembersListResponse,
)

__all__ = [
    # base
    "BaseSchema",
    "ErrorDetail",
    "ErrorResponse",
    "SuccessResponse",
    "PaginatedResponse",
    "HealthResponse",
    "AuditInfo",
    # auth
    "RegisterRequest",
    "LoginRequest",
    "TokenResponse",
    "AuthResponse",
    "IdentityOut",
    "ConsentsStatus",
    "MembershipOut",
    "InviteOut",
    "UserMeResponse",
    # profile
    "ProfileUpdateRequest",
    "ProfileOut",
    "ProfileWithLabelsOut",
    "EmergencyContactRequest",
    "EmergencyContactOut",
    "CatalogItemOut",
    "CatalogOut",
    "PhotoUploadResponse",
    # verification
    "StartVerificationRequest",
    "StartVerificationResponse",
    "ConfirmVerificationRequest",
    "ConfirmVerificationResponse",
    # organization
    "CreateOrgUnitRequest",
    "OrgUnitOut",
    "OrgUnitWithChildren",
    "OrgTreeResponse",
    "SendInviteRequest",
    "InviteResponse",
    "InviteDetailOut",
    "PendingInvitesResponse",
    "MemberOut",
    "MembersListResponse",
]
