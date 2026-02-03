from typing import Any
from uuid import UUID

from sqlalchemy.orm import Session

from app.db.models import AuditLog


def create_audit_log(
    db: Session,
    action: str,
    actor_user_id: UUID | None = None,
    entity_type: str | None = None,
    entity_id: str | None = None,
    ip: str | None = None,
    user_agent: str | None = None,
    metadata: dict[str, Any] | None = None,
) -> AuditLog:
    log_entry = AuditLog(
        actor_user_id=actor_user_id,
        action=action,
        entity_type=entity_type,
        entity_id=entity_id,
        ip=ip,
        user_agent=user_agent,
        extra_data=metadata,  # Mapeia o parâmetro 'metadata' para a coluna 'extra_data'
    )
    db.add(log_entry)
    return log_entry