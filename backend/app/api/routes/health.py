"""
Health Routes
=============
Endpoints de health check.
"""

from datetime import datetime, timezone

from fastapi import APIRouter

from app.core.settings import settings
from app.schemas import HealthResponse

router = APIRouter(tags=["Health"])


@router.get("/health", response_model=HealthResponse)
async def health_check() -> HealthResponse:
    """
    Verifica saúde da aplicação.
    
    Retorna:
        - status: "healthy" se tudo OK
        - timestamp: horário atual
        - version: versão da API
    """
    return HealthResponse(
        status="healthy",
        timestamp=datetime.now(timezone.utc),
        version=settings.app_version,
    )
