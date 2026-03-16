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

    # Escopo: unidade organizacional alvo (coordenadores usam este campo)
    scope_org_unit_id: UUID | None = Field(None, description="UUID da OrgUnit alvo (nil = sem escopo de org)")

    # Destinatários globais (requer CAN_SEND_INBOX)
    send_to_all: bool = Field(default=False, description="Enviar para todos os usuários ativos")
    filters: InboxFilters | None = Field(None, description="Filtros de perfil adicionais")

    # Anexos
    attachments: list[InboxAttachment] | None = Field(None, description="Anexos (imagens ou links)")


class InboxPreviewRequest(BaseModel):
    """Request para preview de quantos receberão."""
    send_to_all: bool = Field(default=False)
    scope_org_unit_id: UUID | None = None
    filters: InboxFilters | None = None


# === RESPONSE SCHEMAS ===

class InboxMessageResponse(BaseModel):
    """Resposta com dados de uma mensagem do inbox.

    - id: UUID do registro InboxRecipient (controla leitura por usuário)
    - message_id: UUID da InboxMessage (a mensagem em si, compartilhada entre destinatários)
    """
    id: UUID          # InboxRecipient.id — usar para PATCH /{id}/read
    message_id: UUID  # InboxMessage.id — usar para identificar a mensagem
    title: str
    message: str
    type: str
    read: bool
    read_at: datetime | None
    created_at: datetime
    expires_at: datetime
    attachments: list[dict[str, Any]] | None = None
    sender_name: str | None = None

    class Config:
        from_attributes = True


class InboxSentMessageResponse(BaseModel):
    """Mensagem enviada (visão do remetente)."""
    id: UUID
    title: str
    message: str
    type: str
    created_at: datetime
    expires_at: datetime
    recipient_count: int
    read_count: int
    filters: dict[str, Any] | None = None

    class Config:
        from_attributes = True


class InboxSentResponse(BaseModel):
    """Lista de mensagens enviadas."""
    messages: list[InboxSentMessageResponse]


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
    """Opções disponíveis para filtros de perfil."""
    vocational_realities: list[dict[str, str]]
    life_states: list[dict[str, str]]
    marital_statuses: list[dict[str, str]]
    states: list[str]
    cities: list[str]


class OrgScopeResponse(BaseModel):
    """Unidade organizacional para a qual o usuário pode enviar avisos."""
    id: UUID
    name: str
    type: str          # ex: SETOR, MINISTERIO, GRUPO
    member_count: int

    class Config:
        from_attributes = True


class SendScopesResponse(BaseModel):
    """Escopos disponíveis para envio de aviso."""
    can_send_to_all: bool          # True se tem CAN_SEND_INBOX
    scopes: list[OrgScopeResponse]  # OrgUnits onde é coordenador (ou todas, se admin)


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
