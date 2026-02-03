"""
Logging Middleware
==================
Log de requisições com proteção de dados sensíveis.

IMPORTANTE: Este middleware NUNCA loga:
- CPF, RG ou outros documentos
- Telefones
- Senhas ou tokens
- Corpo de requisições com dados sensíveis
"""

import time
from typing import Callable

import structlog
from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware

from app.services.audit_service import sanitize_sensitive_data

logger = structlog.get_logger()

# Paths que podem conter dados sensíveis no body (não logar body)
SENSITIVE_PATHS = [
    "/profile",
    "/verify/phone",
    "/admin/users",
    "/legal/accept",
]

# Headers sensíveis que não devem ser logados
SENSITIVE_HEADERS = ["authorization", "cookie", "x-api-key"]


class LoggingMiddleware(BaseHTTPMiddleware):
    """Middleware de logging com proteção de dados sensíveis."""
    
    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        start_time = time.perf_counter()
        
        # Log de entrada (sem dados sensíveis)
        safe_headers = self._get_safe_headers(request)
        
        logger.info(
            "request_started",
            path=request.url.path,
            method=request.method,
            client_ip=self._get_client_ip(request),
            headers=safe_headers,
        )
        
        # Processa requisição
        response = await call_next(request)
        
        # Calcula duração
        duration_ms = (time.perf_counter() - start_time) * 1000
        
        # Log de saída
        logger.info(
            "request_completed",
            path=request.url.path,
            method=request.method,
            status_code=response.status_code,
            duration_ms=round(duration_ms, 2),
        )
        
        return response
    
    def _get_safe_headers(self, request: Request) -> dict:
        """Retorna headers seguros para logging (sem dados sensíveis)."""
        safe = {}
        for key, value in request.headers.items():
            if key.lower() in SENSITIVE_HEADERS:
                safe[key] = "[REDACTED]"
            else:
                safe[key] = value
        return safe
    
    def _get_client_ip(self, request: Request) -> str:
        """Obtém IP do cliente considerando proxies."""
        forwarded = request.headers.get("x-forwarded-for")
        if forwarded:
            return forwarded.split(",")[0].strip()
        
        if request.client:
            return request.client.host
        
        return "unknown"
    
    def _is_sensitive_path(self, path: str) -> bool:
        """Verifica se path pode conter dados sensíveis."""
        return any(path.startswith(sensitive) for sensitive in SENSITIVE_PATHS)
