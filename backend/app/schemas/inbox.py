"""
Inbox Schemas
=============
Schemas para o sistema de avisos/inbox.
"""

from datetime import datetime
from typing import Any
from uuid import UUID

from pydantic import BaseModel, Field


# === ENUMS ===

class InboxMessageTypeEnum(str):
    INFO = "info"
    WARNING = "warning"
    SUCCESS = "success"
    URGENT = "urgent"


# === REQUEST SCHEMAS ===

class InboxFilters(BaseModel):
    """Filtros para segmentação de destinatários."""
    vocational_reality_codes: list[str] | None = Field(None, description="Códigos de realidade vocacional")
    life_state_codes: list[str] | None = Field(None, description="Códigos de estado de vida")
    marital_status_codes: list[str] | None = Field(None, description="Códigos de estado civil")
    states: list[str] | None = Field(None, description="UFs (ex: CE, SP)")
    cities: list[str] | None = Field(None, description="Cidades")


class InboxAttachment(BaseModel):
    """Anexo de uma mensagem."""
    type: str = Field(..., description="Tipo: image ou link")
    url: str = Field(..., description="URL do anexo")
    title: str | None = Field(None, description="Título/descrição do anexo")


class InboxSendRequest(BaseModel):
    """Request para enviar um aviso."""
    title: str = Field(..., min_length=3, max_length=200, description="Título do aviso")
    message: str = Field(..., min_length=10, max_length=5000, description="Conteúdo do aviso")
    type: str = Field(default="info", description="Tipo: info, warning, success, urgent")
    
    # Destinatários
    send_to_all: bool = Field(default=False, description="Enviar para todos os usuários")
    filters: InboxFilters | None = Field(None, description="Filtros de segmentação (se não for para todos)")
    
    # Anexos
    attachments: list[InboxAttachment] | None = Field(None, description="Anexos (imagens ou links)")


class InboxPreviewRequest(BaseModel):
    """Request para preview de quantos receberão."""
    send_to_all: bool = Field(default=False)
    filters: InboxFilters | None = None


# === RESPONSE SCHEMAS ===

class InboxMessageResponse(BaseModel):
    """Resposta com dados de uma mensagem do inbox."""
    id: UUID
    title: str
    message: str
    type: str
    read: bool
    read_at: datetime | None
    created_at: datetime
    expires_at: datetime
    attachments: list[dict[str, Any]] | None = None
    
    # Dados do remetente (opcional)
    sender_name: str | None = None

    class Config:
        from_attributes = True


class InboxListResponse(BaseModel):
    """Lista de mensagens do inbox."""
    messages: list[InboxMessageResponse]
    total: int
    unread_count: int


class InboxPreviewResponse(BaseModel):
    """Resposta do preview de envio."""
    recipient_count: int
    filters_applied: dict[str, Any] | None


class InboxSendResponse(BaseModel):
    """Resposta após enviar um aviso."""
    message_id: UUID
    recipient_count: int
    success: bool


class InboxFiltersOptionsResponse(BaseModel):
    """Opções disponíveis para filtros."""
    vocational_realities: list[dict[str, str]]
    life_states: list[dict[str, str]]
    marital_statuses: list[dict[str, str]]
    states: list[str]
    cities: list[str]


# === PERMISSION SCHEMAS ===

class UserPermissionResponse(BaseModel):
    """Permissão de um usuário."""
    permission_code: str
    granted_at: datetime

    class Config:
        from_attributes = True


class UserPermissionsResponse(BaseModel):
    """Lista de permissões do usuário."""
    permissions: list[str]
    has_admin_access: bool
