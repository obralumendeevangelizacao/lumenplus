import re
from typing import Any
from uuid import UUID

import structlog
from sqlalchemy.orm import Session

from app.db.models import AuditLog
from app.settings import settings

logger = structlog.get_logger()

# Padrões para sanitização de dados sensíveis nos logs/auditoria
_SENSITIVE_PATTERNS = [
    (r"\d{3}\.\d{3}\.\d{3}-\d{2}", "[CPF_REDACTED]"),   # CPF formatado
    (r"\d{11}", "[CPF_REDACTED]"),                         # CPF sem formatação
    (r"\+\d{10,15}", "[PHONE_REDACTED]"),                  # Telefone E.164
    (r"\d{2}\.\d{3}\.\d{3}-[\dXx]", "[RG_REDACTED]"),    # RG formatado
]


def sanitize_sensitive_data(data: Any) -> Any:
    """Remove dados sensíveis (CPF, RG, telefone) de qualquer estrutura de dados."""
    if data is None:
        return None
    if isinstance(data, str):
        result = data
        for pattern, replacement in _SENSITIVE_PATTERNS:
            result = re.sub(pattern, replacement, result)
        return result
    if isinstance(data, dict):
        return {
            k: "[REDACTED]" if k.lower() in ("cpf", "rg", "phone", "phone_e164", "telefone", "documento") else sanitize_sensitive_data(v)
            for k, v in data.items()
        }
    if isinstance(data, list):
        return [sanitize_sensitive_data(item) for item in data]
    return data


def create_audit_log(
    db: Session,
    action: str,
    actor_user_id: UUID | None = None,
    entity_type: str | None = None,
    entity_id: str | None = None,
    ip: str | None = None,
    user_agent: str | None = None,
    metadata: dict[str, Any] | None = None,
) -> AuditLog | None:
    """Cria registro de auditoria. Retorna None se auditoria estiver desabilitada."""
    if not settings.enable_audit:
        return None

    # Sanitiza metadata antes de persistir
    safe_metadata: dict[str, Any] = sanitize_sensitive_data(metadata) if metadata else {}
    if ip:
        safe_metadata["ip"] = ip
    if user_agent:
        safe_metadata["user_agent"] = user_agent

    log_entry = AuditLog(
        actor_user_id=actor_user_id,
        action=action,
        entity_type=entity_type,
        entity_id=entity_id,
        extra_data=safe_metadata or None,
    )
    db.add(log_entry)

    logger.info(
        "audit_log_created",
        action=action,
        actor_user_id=str(actor_user_id) if actor_user_id else None,
        entity_type=entity_type,
        entity_id=entity_id,
    )

    return log_entry