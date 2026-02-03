"""
Admin Schemas
=============
Schemas para endpoints administrativos e acesso a dados sensíveis.

ATENÇÃO: Os schemas aqui lidam com dados ALTAMENTE SENSÍVEIS (CPF/RG).
Toda visualização é auditada obrigatoriamente.
"""

from datetime import datetime
from uuid import UUID

from pydantic import Field

from app.schemas.base import BaseSchema


class SensitiveAccessRequestBody(BaseSchema):
    """Request para solicitar acesso a dados sensíveis."""
    
    target_user_id: UUID = Field(..., description="ID do usuário alvo")
    reason: str = Field(
        ..., 
        min_length=10, 
        max_length=500,
        description="Justificativa para o acesso (será auditada)"
    )


class SensitiveAccessResponse(BaseSchema):
    """Response de solicitação de acesso sensível."""
    
    id: UUID
    requester_user_id: UUID
    target_user_id: UUID
    scope: str
    reason: str
    status: str
    expires_at: datetime | None
    created_at: datetime


class DocumentsResponse(BaseSchema):
    """
    Response com documentos sensíveis (CPF/RG).
    
    ATENÇÃO: Este endpoint SEMPRE gera registro de auditoria.
    Acesso permitido apenas para:
    - DEV (bypass, mas auditado)
    - SECRETARY com aprovação ativa de COUNCIL_GENERAL ou DEV
    """
    
    cpf: str = Field(..., description="CPF descriptografado")
    rg: str = Field(..., description="RG descriptografado")


class AssignGlobalRoleRequest(BaseSchema):
    """Request para atribuir role global (dev only)."""
    
    user_id: UUID
    role_code: str = Field(..., pattern="^(DEV|COUNCIL_GENERAL|SECRETARY|COMMS)$")


class AssignGlobalRoleResponse(BaseSchema):
    """Response após atribuir role."""
    
    message: str
    user_id: UUID
    role_code: str


class SeedResponse(BaseSchema):
    """Response do seed de dados."""
    
    message: str
    org_roles_created: int
    org_units_created: int
    global_roles_created: int
    catalogs_created: int
    catalog_items_created: int
    legal_docs_created: int
