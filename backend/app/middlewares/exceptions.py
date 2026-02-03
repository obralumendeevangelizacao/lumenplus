"""
Exception Handlers
==================
Tratamento centralizado de exceções.

IMPORTANTE: Mensagens de erro NUNCA expõem dados sensíveis ou detalhes internos.
"""

import structlog
from fastapi import FastAPI, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from pydantic import ValidationError

from app.services.audit_service import sanitize_sensitive_data

logger = structlog.get_logger()


def register_exception_handlers(app: FastAPI) -> None:
    """Registra todos os exception handlers."""
    
    @app.exception_handler(RequestValidationError)
    async def validation_exception_handler(
        request: Request, exc: RequestValidationError
    ) -> JSONResponse:
        """Trata erros de validação de request."""
        # Sanitiza erros para não expor dados sensíveis
        errors = []
        for error in exc.errors():
            field = ".".join(str(loc) for loc in error.get("loc", []))
            errors.append({
                "field": field,
                "message": error.get("msg", "Erro de validação"),
            })
        
        logger.warning(
            "validation_error",
            path=request.url.path,
            errors=errors,
        )
        
        return JSONResponse(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            content={
                "detail": {
                    "error": "validation_error",
                    "message": "Dados inválidos na requisição",
                    "errors": errors,
                }
            },
        )
    
    @app.exception_handler(ValueError)
    async def value_error_handler(request: Request, exc: ValueError) -> JSONResponse:
        """Trata ValueErrors (ex: CPF inválido)."""
        # Sanitiza mensagem
        safe_message = sanitize_sensitive_data(str(exc))
        
        logger.warning(
            "value_error",
            path=request.url.path,
            error=safe_message,
        )
        
        return JSONResponse(
            status_code=status.HTTP_400_BAD_REQUEST,
            content={
                "detail": {
                    "error": "bad_request",
                    "message": safe_message,
                }
            },
        )
    
    @app.exception_handler(PermissionError)
    async def permission_error_handler(request: Request, exc: PermissionError) -> JSONResponse:
        """Trata erros de permissão."""
        logger.warning(
            "permission_denied",
            path=request.url.path,
        )
        
        return JSONResponse(
            status_code=status.HTTP_403_FORBIDDEN,
            content={
                "detail": {
                    "error": "forbidden",
                    "message": "Permissão negada",
                }
            },
        )
    
    @app.exception_handler(Exception)
    async def global_exception_handler(request: Request, exc: Exception) -> JSONResponse:
        """
        Handler global para exceções não tratadas.
        
        IMPORTANTE: NUNCA expõe detalhes internos ou stack traces.
        """
        # Log completo para debugging (interno)
        logger.error(
            "unhandled_exception",
            path=request.url.path,
            method=request.method,
            error_type=type(exc).__name__,
            # Sanitiza mensagem de erro
            error=sanitize_sensitive_data(str(exc)),
        )
        
        # Resposta genérica para o cliente (sem detalhes internos)
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content={
                "detail": {
                    "error": "internal_server_error",
                    "message": "Ocorreu um erro inesperado. Tente novamente.",
                }
            },
        )
