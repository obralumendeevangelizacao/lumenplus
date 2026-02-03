"""
Schemas Base
============
Schemas compartilhados para respostas padronizadas.
"""

from datetime import datetime
from typing import Any, Generic, TypeVar
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

T = TypeVar("T")


class BaseSchema(BaseModel):
    """Schema base com configurações comuns."""
    
    model_config = ConfigDict(
        from_attributes=True,
        populate_by_name=True,
        str_strip_whitespace=True,
    )


class ErrorDetail(BaseSchema):
    """Detalhe de erro padronizado."""
    
    error: str = Field(..., description="Código do erro")
    message: str = Field(..., description="Mensagem legível")
    field: str | None = Field(None, description="Campo relacionado ao erro")


class ErrorResponse(BaseSchema):
    """Resposta de erro padronizada."""
    
    detail: ErrorDetail


class SuccessResponse(BaseSchema, Generic[T]):
    """Resposta de sucesso genérica."""
    
    data: T
    message: str | None = None


class PaginatedResponse(BaseSchema, Generic[T]):
    """Resposta paginada."""
    
    items: list[T]
    total: int
    page: int
    page_size: int
    pages: int


class HealthResponse(BaseSchema):
    """Resposta do health check."""
    
    status: str
    timestamp: datetime
    version: str


class AuditInfo(BaseSchema):
    """Informações de auditoria."""
    
    created_at: datetime
    updated_at: datetime | None = None
    created_by: UUID | None = None
