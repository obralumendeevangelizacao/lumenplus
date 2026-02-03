"""
Request ID Middleware
=====================
Adiciona request_id único a cada requisição para rastreabilidade.
"""

import uuid
from typing import Callable

import structlog
from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware

logger = structlog.get_logger()


class RequestIDMiddleware(BaseHTTPMiddleware):
    """Middleware que adiciona request_id único a cada requisição."""
    
    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        # Usa header existente ou gera novo
        request_id = request.headers.get("X-Request-ID", str(uuid.uuid4()))
        
        # Limpa e configura contexto do structlog
        structlog.contextvars.clear_contextvars()
        structlog.contextvars.bind_contextvars(
            request_id=request_id,
            path=request.url.path,
            method=request.method,
        )
        
        # Armazena no state para acesso em outras partes
        request.state.request_id = request_id
        
        response = await call_next(request)
        
        # Adiciona header na resposta
        response.headers["X-Request-ID"] = request_id
        
        return response
