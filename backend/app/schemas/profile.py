"""Schemas de profile e verificação."""

from datetime import date, datetime
from uuid import UUID
from typing import Optional
from pydantic import Field, field_validator, model_validator
import re

from app.schemas.base import BaseSchema


# =============================================================================
# PROFILE
# =============================================================================

class ProfileUpdateRequest(BaseSchema):
    """Atualização de perfil completa."""
    
    # Dados básicos
    full_name: str = Field(..., min_length=2, max_length=200)
    birth_date: date
    cpf: str = Field(..., min_length=11, max_length=14)
    rg: str = Field(..., min_length=5, max_length=20)
    phone_e164: str = Field(..., pattern=r"^\+[1-9]\d{10,14}$")
    city: str = Field(..., min_length=2, max_length=100)
    state: str = Field(..., min_length=2, max_length=2)
    
    # Foto (URL ou base64)
    photo_url: Optional[str] = None
    
    # Catálogos
    life_state_item_id: UUID
    marital_status_item_id: UUID
    vocational_reality_item_id: UUID
    
    # Ano de consagração (obrigatório se CONSAGRADO_FILHO_DA_LUZ)
    consecration_year: Optional[int] = Field(None, ge=1900, le=2100)
    
    # Acompanhamento Vocacional
    has_vocational_accompaniment: Optional[bool] = None
    vocational_accompanist_user_id: Optional[UUID] = None
    vocational_accompanist_name: Optional[str] = Field(None, max_length=200)
    
    # Interesse em Ministério
    interested_in_ministry: Optional[bool] = None
    interested_ministry_id: Optional[UUID] = None
    ministry_interest_notes: Optional[str] = Field(None, max_length=500)

    @field_validator("cpf")
    @classmethod
    def clean_cpf(cls, v: str) -> str:
        return re.sub(r"\D", "", v)

    @field_validator("state")
    @classmethod
    def uppercase_state(cls, v: str) -> str:
        return v.upper()
    
    @model_validator(mode="after")
    def validate_conditional_fields(self):
        """Valida campos condicionais."""
        # Se tem acompanhamento, deve informar quem
        if self.has_vocational_accompaniment:
            if not self.vocational_accompanist_user_id and not self.vocational_accompanist_name:
                raise ValueError(
                    "Se faz acompanhamento vocacional, informe quem é o acompanhador"
                )
        
        # Se tem interesse em ministério, deve informar qual
        if self.interested_in_ministry:
            if not self.interested_ministry_id and not self.ministry_interest_notes:
                raise ValueError(
                    "Se tem interesse em ministério, informe qual ou descreva"
                )
        
        return self


class ProfileOut(BaseSchema):
    """Perfil do usuário (sem dados sensíveis)."""
    user_id: UUID
    full_name: Optional[str] = None
    birth_date: Optional[date] = None
    photo_url: Optional[str] = None
    phone_e164: Optional[str] = None
    phone_verified: bool = False
    city: Optional[str] = None
    state: Optional[str] = None
    
    # Catálogos (IDs)
    life_state_item_id: Optional[UUID] = None
    marital_status_item_id: Optional[UUID] = None
    vocational_reality_item_id: Optional[UUID] = None
    
    # Campos adicionais
    consecration_year: Optional[int] = None
    has_vocational_accompaniment: Optional[bool] = None
    vocational_accompanist_user_id: Optional[UUID] = None
    vocational_accompanist_name: Optional[str] = None
    interested_in_ministry: Optional[bool] = None
    interested_ministry_id: Optional[UUID] = None
    ministry_interest_notes: Optional[str] = None
    
    # Status
    status: str = "INCOMPLETE"
    completed_at: Optional[datetime] = None
    has_documents: bool = False  # True se tem CPF/RG


class ProfileWithLabelsOut(ProfileOut):
    """Perfil com labels dos catálogos (para exibição)."""
    life_state_label: Optional[str] = None
    marital_status_label: Optional[str] = None
    vocational_reality_label: Optional[str] = None
    interested_ministry_name: Optional[str] = None
    vocational_accompanist_display_name: Optional[str] = None


class EmergencyContactRequest(BaseSchema):
    """Adicionar contato de emergência."""
    name: str = Field(..., min_length=2, max_length=200)
    phone_e164: str = Field(..., pattern=r"^\+[1-9]\d{10,14}$")
    relationship: str = Field(..., min_length=2, max_length=50)


class EmergencyContactOut(BaseSchema):
    """Contato de emergência."""
    id: UUID
    name: str
    phone_e164: str
    relationship: str


# =============================================================================
# CATALOGS
# =============================================================================

class CatalogItemOut(BaseSchema):
    """Item de catálogo."""
    id: UUID
    code: str
    label: str
    sort_order: int = 0


class CatalogOut(BaseSchema):
    """Catálogo."""
    code: str
    name: str
    items: list[CatalogItemOut]


# =============================================================================
# VERIFICATION - PHONE
# =============================================================================

class StartPhoneVerificationRequest(BaseSchema):
    """Iniciar verificação de telefone."""
    phone_e164: str = Field(..., pattern=r"^\+[1-9]\d{10,14}$")
    channel: str = Field(default="WHATSAPP")  # SMS | WHATSAPP


class StartPhoneVerificationResponse(BaseSchema):
    """Resposta de início de verificação."""
    verification_id: UUID
    expires_at: datetime
    debug_code: Optional[str] = None  # Só em dev


class ConfirmPhoneVerificationRequest(BaseSchema):
    """Confirmar verificação de telefone."""
    verification_id: UUID
    code: str = Field(..., min_length=6, max_length=6)


class PhoneVerificationResponse(BaseSchema):
    """Resposta de verificação de telefone."""
    verified: bool
    message: str


# =============================================================================
# VERIFICATION - EMAIL
# =============================================================================

class StartEmailVerificationRequest(BaseSchema):
    """Iniciar verificação de email."""
    email: str = Field(..., pattern=r"^[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+$")


class StartEmailVerificationResponse(BaseSchema):
    """Resposta de início de verificação de email."""
    verification_id: UUID
    expires_at: datetime
    debug_token: Optional[str] = None  # Só em dev


class ConfirmEmailVerificationRequest(BaseSchema):
    """Confirmar verificação de email via token."""
    token: str = Field(..., min_length=32, max_length=128)


class EmailVerificationResponse(BaseSchema):
    """Resposta de verificação de email."""
    verified: bool
    message: str


# =============================================================================
# PHOTO UPLOAD
# =============================================================================

class PhotoUploadResponse(BaseSchema):
    """Resposta de upload de foto."""
    photo_url: str
    message: str


# =============================================================================
# ALIASES PARA COMPATIBILIDADE
# =============================================================================
ConfirmVerificationRequest = ConfirmPhoneVerificationRequest
VerificationResponse = PhoneVerificationResponse