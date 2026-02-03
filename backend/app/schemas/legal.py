"""Schemas de documentos legais."""

from datetime import datetime
from uuid import UUID

from app.schemas.auth import BaseSchema


class LegalDocumentOut(BaseSchema):
    """Documento legal."""
    id: UUID
    type: str
    version: str
    content: str
    published_at: datetime


class LatestLegalResponse(BaseSchema):
    """Últimos documentos legais."""
    terms: LegalDocumentOut | None
    privacy: LegalDocumentOut | None


class AcceptLegalRequest(BaseSchema):
    """Aceitar termos."""
    terms_version: str
    privacy_version: str
    analytics_opt_in: bool = False
    push_opt_in: bool = True


class AcceptLegalResponse(BaseSchema):
    """Resposta de aceite."""
    message: str
    terms_accepted: bool
    privacy_accepted: bool