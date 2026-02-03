"""
Lumen+ API
==========
Backend refatorado com:
- Sistema de convites (não solicitações)
- Hierarquia: Conselho Geral → Executivo → Setor → Ministério → Grupo
- Perfil completo com foto, consagração, acompanhamento vocacional
"""

import uuid
from contextlib import asynccontextmanager
from typing import AsyncIterator

import structlog
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.core.settings import settings

# Configura logging
structlog.configure(
    processors=[
        structlog.contextvars.merge_contextvars,
        structlog.processors.add_log_level,
        structlog.processors.TimeStamper(fmt="iso"),
        structlog.processors.JSONRenderer(),
    ],
    wrapper_class=structlog.make_filtering_bound_logger(20),
    context_class=dict,
    logger_factory=structlog.PrintLoggerFactory(),
    cache_logger_on_first_use=True,
)

logger = structlog.get_logger()


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    logger.info("application_startup", environment=settings.environment, version=settings.app_version)
    
    # Valida configurações em produção
    errors = settings.validate_production_settings()
    if errors:
        for err in errors:
            logger.error("config_error", message=err)
        if settings.is_production:
            raise RuntimeError(f"Configuração inválida: {errors}")
    
    yield
    logger.info("application_shutdown")


app = FastAPI(
    title="Lumen+ API",
    version=settings.app_version,
    description="Backend do Lumen+ - Plataforma para comunidades católicas",
    lifespan=lifespan,
    docs_url="/docs" if settings.is_dev else None,
    redoc_url="/redoc" if settings.is_dev else None,
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Request ID middleware
@app.middleware("http")
async def add_request_id(request: Request, call_next):
    request_id = request.headers.get("X-Request-ID", str(uuid.uuid4()))
    structlog.contextvars.clear_contextvars()
    structlog.contextvars.bind_contextvars(request_id=request_id)
    response = await call_next(request)
    response.headers["X-Request-ID"] = request_id
    return response


# Exception handler
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    logger.error("unhandled_exception", error=str(exc), path=request.url.path)
    return JSONResponse(
        status_code=500,
        content={"detail": {"error": "internal_error", "message": "Erro interno do servidor"}}
    )


# Health check
@app.get("/health")
async def health():
    from datetime import datetime, timezone
    return {
        "status": "healthy",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "version": settings.app_version,
    }


# Rotas
from app.api.routes.auth import router as auth_router
from app.api.routes.profile import router as profile_router
from app.api.routes.organization import router as org_router
from app.api.inbox_routes import router as inbox_router

app.include_router(auth_router)
app.include_router(profile_router)
app.include_router(org_router)
app.include_router(inbox_router)

# Dev endpoints
if settings.enable_dev_endpoints:
    from app.api.routes.dev import router as dev_router
    app.include_router(dev_router)
    logger.warning("dev_endpoints_enabled", message="Endpoints /dev/* estão habilitados!")
