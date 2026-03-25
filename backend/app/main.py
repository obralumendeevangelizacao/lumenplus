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

import sentry_sdk
import structlog
from fastapi import Depends, FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.openapi.utils import get_openapi
from fastapi.responses import JSONResponse
from fastapi.security import HTTPBearer
from sentry_sdk.integrations.fastapi import FastApiIntegration
from sentry_sdk.integrations.sqlalchemy import SqlalchemyIntegration
from sentry_sdk.integrations.starlette import StarletteIntegration

# Fonte canônica de settings
from app.settings import settings

# Sentry — inicializa antes de tudo para capturar erros de startup
if settings.sentry_dsn:
    sentry_sdk.init(
        dsn=settings.sentry_dsn,
        environment=settings.environment,
        release=f"lumenplus-backend@{settings.app_version}",
        # LGPD: não enviar dados pessoais automaticamente
        send_default_pii=False,
        # Performance: 10% das requisições em produção
        traces_sample_rate=0.1 if settings.is_production else 0.0,
        integrations=[
            StarletteIntegration(transaction_style="endpoint"),
            FastApiIntegration(transaction_style="endpoint"),
            SqlalchemyIntegration(),
        ],
    )

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
    logger.info(
        "application_startup", environment=settings.environment, version=settings.app_version
    )

    # Valida configurações em produção
    errors = settings.validate_production_settings()
    if errors:
        for err in errors:
            logger.error("config_error", message=err)
        if settings.is_production:
            raise RuntimeError(f"Configuração inválida: {errors}")

    yield
    logger.info("application_shutdown")


# Dependência de segurança — só serve para o Swagger UI mostrar o cadeado 🔒
# A validação real do token é feita em app/api/deps.py (CurrentUser)
_bearer_scheme = HTTPBearer(auto_error=False)

app = FastAPI(
    title="Lumen+ API",
    version=settings.app_version,
    description="Backend do Lumen+ - Plataforma para comunidades católicas",
    lifespan=lifespan,
    docs_url="/docs" if settings.is_dev else None,
    redoc_url="/redoc" if settings.is_dev else None,
    dependencies=[Depends(_bearer_scheme)],
)


def custom_openapi():
    if app.openapi_schema:
        return app.openapi_schema
    schema = get_openapi(
        title=app.title,
        version=app.version,
        description=app.description,
        routes=app.routes,
    )
    # Adiciona Bearer token como scheme de segurança global
    schema.setdefault("components", {})
    schema["components"]["securitySchemes"] = {
        "BearerAuth": {
            "type": "http",
            "scheme": "bearer",
            "bearerFormat": "dev:<user_id>:<email>  (DEV) | JWT (PROD)",
        }
    }
    # Aplica a todos os endpoints
    for path in schema.get("paths", {}).values():
        for operation in path.values():
            operation.setdefault("security", [{"BearerAuth": []}])
    app.openapi_schema = schema
    return schema


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


# Validation error handler — 422 com formato limpo {field, message}
@app.exception_handler(RequestValidationError)
async def validation_exception_handler(
    request: Request, exc: RequestValidationError
) -> JSONResponse:
    errors = []
    for error in exc.errors():
        field = ".".join(str(loc) for loc in error["loc"] if loc != "body")
        errors.append({"field": field, "message": error["msg"]})
    return JSONResponse(status_code=422, content={"detail": errors})


# Exception handler
# SEGURANÇA: loga apenas o tipo da exceção, NUNCA o conteúdo da mensagem,
# pois ela pode conter CPF, RG, telefone ou outros dados sensíveis do request.
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    logger.error(
        "unhandled_exception",
        error_type=type(exc).__name__,  # apenas o tipo, nunca str(exc)
        path=request.url.path,
        method=request.method,
    )
    response = JSONResponse(
        status_code=500,
        content={"detail": {"error": "internal_error", "message": "Erro interno do servidor"}},
    )
    # Exception handlers podem bypassar o CORSMiddleware no Starlette/FastAPI.
    # Adicionamos os headers manualmente para origens permitidas.
    origin = request.headers.get("origin", "")
    if origin and (origin in settings.cors_origins_list or settings.cors_origins_list == ["*"]):
        response.headers["Access-Control-Allow-Origin"] = origin
        response.headers["Access-Control-Allow-Credentials"] = "true"
    return response


# Health check
@app.get("/health")
async def health():
    from datetime import datetime, timezone

    return {
        "status": "healthy",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "version": settings.app_version,
    }


# Rotas — imports após setup do app (necessário para que o lifespan e middlewares
# sejam registrados antes dos routers, comportamento esperado no FastAPI).  # noqa: E402
from app.api.admin_retreat_routes import router as admin_retreat_router  # noqa: E402
from app.api.admin_routes import router as admin_sensitive_router  # noqa: E402
from app.api.inbox_routes import router as inbox_router  # noqa: E402
from app.api.legal_routes import router as legal_router  # noqa: E402
from app.api.profile_routes import router as profile_router  # noqa: E402
from app.api.retreat_routes import router as retreat_router  # noqa: E402
from app.api.routes.admin import router as admin_router  # noqa: E402
from app.api.routes.auth import router as auth_router  # noqa: E402
from app.api.routes.organization import router as org_router  # noqa: E402
from app.api.verification_routes import router as verify_router  # noqa: E402
from app.api.life_plan_routes import router as life_plan_router  # noqa: E402

app.include_router(auth_router)
app.include_router(profile_router)
app.include_router(org_router)
app.include_router(admin_router)
app.include_router(admin_sensitive_router)
app.include_router(admin_retreat_router)
app.include_router(retreat_router)
app.include_router(inbox_router)
app.include_router(verify_router)
app.include_router(legal_router)
app.include_router(life_plan_router)

# Dev endpoints
if settings.enable_dev_endpoints:
    from app.api.routes.dev import router as dev_router

    app.include_router(dev_router)
    logger.warning("dev_endpoints_enabled", message="Endpoints /dev/* estão habilitados!")

# Sobrescreve o schema OpenAPI após todos os routers estarem registrados
app.openapi = custom_openapi  # type: ignore
