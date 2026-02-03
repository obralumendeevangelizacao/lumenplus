"""
Audit Service
=============
Serviço de auditoria para registro de ações.

IMPORTANTE: Dados sensíveis (CPF, RG, telefone) NUNCA devem aparecer
em logs ou registros de auditoria.
"""

import re
from typing import Any
from uuid import UUID

import structlog
from sqlalchemy.orm import Session

from app.db.models import AuditLog
from app.core.settings import settings

logger = structlog.get_logger()

# Padrões para sanitização de dados sensíveis
SENSITIVE_PATTERNS = [
    (r"\d{3}\.\d{3}\.\d{3}-\d{2}", "[CPF_REDACTED]"),  # CPF formatado
    (r"\d{11}", "[CPF_REDACTED]"),  # CPF sem formatação
    (r"\+\d{10,15}", "[PHONE_REDACTED]"),  # Telefone E.164
    (r"\d{2}\.\d{3}\.\d{3}-[\dXx]", "[RG_REDACTED]"),  # RG formatado
]


def sanitize_sensitive_data(data: Any) -> Any:
    """
    Remove dados sensíveis de qualquer estrutura de dados.
    
    NUNCA loga ou armazena CPF, RG ou telefone em texto claro.
    """
    if data is None:
        return None
    
    if isinstance(data, str):
        result = data
        for pattern, replacement in SENSITIVE_PATTERNS:
            result = re.sub(pattern, replacement, result)
        return result
    
    if isinstance(data, dict):
        sanitized = {}
        for key, value in data.items():
            # Chaves que indicam dados sensíveis
            if key.lower() in ("cpf", "rg", "phone", "phone_e164", "telefone", "documento"):
                sanitized[key] = "[REDACTED]"
            else:
                sanitized[key] = sanitize_sensitive_data(value)
        return sanitized
    
    if isinstance(data, list):
        return [sanitize_sensitive_data(item) for item in data]
    
    return data


def create_audit_log(
    db: Session,
    actor_user_id: UUID | None,
    action: str,
    entity_type: str | None = None,
    entity_id: str | None = None,
    ip: str | None = None,
    user_agent: str | None = None,
    metadata: dict[str, Any] | None = None,
) -> AuditLog | None:
    """
    Cria registro de auditoria.
    
    Args:
        db: Sessão do banco de dados
        actor_user_id: ID do usuário que executou a ação
        action: Ação executada (ex: "profile_created", "sensitive_documents_viewed")
        entity_type: Tipo da entidade afetada
        entity_id: ID da entidade afetada
        ip: IP do cliente
        user_agent: User-Agent do cliente
        metadata: Dados adicionais (serão sanitizados)
    
    Returns:
        AuditLog criado ou None se auditoria estiver desabilitada
    """
    if not settings.enable_audit:
        return None
    
    # Sanitiza metadata para remover dados sensíveis
    safe_metadata = sanitize_sensitive_data(metadata) if metadata else None
    
    audit_log = AuditLog(
        actor_user_id=actor_user_id,
        action=action,
        entity_type=entity_type,
        entity_id=entity_id,
        ip=ip,
        user_agent=user_agent,
        extra_data=safe_metadata,
    )
    
    db.add(audit_log)
    
    # Log estruturado (também sanitizado)
    logger.info(
        "audit_log_created",
        action=action,
        actor_user_id=str(actor_user_id) if actor_user_id else None,
        entity_type=entity_type,
        entity_id=entity_id,
    )
    
    return audit_log


def audit_sensitive_access(
    db: Session,
    viewer_user_id: UUID,
    target_user_id: UUID,
    action: str,
    request_id: UUID | None,
    ip: str | None,
    user_agent: str | None,
    access_type: str,
) -> None:
    """
    Auditoria específica para acesso a dados sensíveis.
    
    Esta função SEMPRE cria registro, independente de settings.enable_audit.
    Acesso a CPF/RG DEVE ser auditado por compliance.
    """
    from app.db.models import SensitiveAccessAudit
    
    audit_entry = SensitiveAccessAudit(
        request_id=request_id,
        viewer_user_id=viewer_user_id,
        target_user_id=target_user_id,
        action=action,
        ip=ip,
        user_agent=user_agent,
    )
    db.add(audit_entry)
    
    # Também cria audit_log normal
    create_audit_log(
        db=db,
        actor_user_id=viewer_user_id,
        action="sensitive_documents_viewed",
        entity_type="user_profile",
        entity_id=str(target_user_id),
        ip=ip,
        user_agent=user_agent,
        metadata={
            "access_type": access_type,
            "request_id": str(request_id) if request_id else None,
        },
    )
    
    logger.warning(
        "sensitive_data_accessed",
        viewer_user_id=str(viewer_user_id),
        target_user_id=str(target_user_id),
        access_type=access_type,
    )
