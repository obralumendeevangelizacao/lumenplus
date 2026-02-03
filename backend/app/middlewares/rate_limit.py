"""
Rate Limiting Middleware
========================
Controle de taxa de requisições.
"""

import time
from typing import Callable

import structlog
from fastapi import Request, Response, status
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware

from app.core.settings import settings

logger = structlog.get_logger()

# Cache simples em memória (em produção, usar Redis)
_rate_limit_cache: dict[str, list[float]] = {}


class RateLimitMiddleware(BaseHTTPMiddleware):
    """Middleware de rate limiting."""
    
    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        if not settings.rate_limit_enabled:
            return await call_next(request)
        
        # Identifica cliente
        client_id = self._get_client_id(request)
        
        # Verifica limite
        if self._is_rate_limited(client_id):
            logger.warning(
                "rate_limit_exceeded",
                client_id=client_id,
                path=request.url.path,
            )
            return JSONResponse(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                content={
                    "detail": {
                        "error": "rate_limit_exceeded",
                        "message": "Muitas requisições. Tente novamente em alguns minutos.",
                    }
                },
            )
        
        # Registra requisição
        self._record_request(client_id)
        
        return await call_next(request)
    
    def _get_client_id(self, request: Request) -> str:
        """Identifica cliente para rate limiting."""
        # Usa header de auth se disponível
        auth = request.headers.get("authorization", "")
        if auth.startswith("Bearer "):
            # Usa parte do token como ID (não o token completo por segurança)
            token_part = auth[7:27] if len(auth) > 27 else auth[7:]
            return f"token:{hash(token_part)}"
        
        # Fallback para IP
        forwarded = request.headers.get("x-forwarded-for")
        if forwarded:
            return f"ip:{forwarded.split(',')[0].strip()}"
        
        if request.client:
            return f"ip:{request.client.host}"
        
        return "ip:unknown"
    
    def _is_rate_limited(self, client_id: str) -> bool:
        """Verifica se cliente excedeu limite."""
        now = time.time()
        window_start = now - 60  # Janela de 1 minuto
        
        if client_id not in _rate_limit_cache:
            return False
        
        # Filtra requisições dentro da janela
        recent = [t for t in _rate_limit_cache[client_id] if t > window_start]
        _rate_limit_cache[client_id] = recent
        
        return len(recent) >= settings.rate_limit_requests_per_minute
    
    def _record_request(self, client_id: str) -> None:
        """Registra requisição para rate limiting."""
        now = time.time()
        
        if client_id not in _rate_limit_cache:
            _rate_limit_cache[client_id] = []
        
        _rate_limit_cache[client_id].append(now)
        
        # Limpa cache antigo periodicamente
        self._cleanup_cache()
    
    def _cleanup_cache(self) -> None:
        """Remove entradas antigas do cache."""
        now = time.time()
        window_start = now - 120  # Mantém 2 minutos
        
        for client_id in list(_rate_limit_cache.keys()):
            _rate_limit_cache[client_id] = [
                t for t in _rate_limit_cache[client_id] if t > window_start
            ]
            if not _rate_limit_cache[client_id]:
                del _rate_limit_cache[client_id]
