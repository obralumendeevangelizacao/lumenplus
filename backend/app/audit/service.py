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
    # AuditLog não tem colunas ip/user_agent — mesclamos em extra_data
    extra: dict[str, Any] = dict(metadata) if metadata else {}
    if ip:
        extra["ip"] = ip
    if user_agent:
        extra["user_agent"] = user_agent

    log_entry = AuditLog(
        actor_user_id=actor_user_id,
        action=action,
        entity_type=entity_type,
        entity_id=entity_id,
        extra_data=extra or None,
    )
    db.add(log_entry)
    return log_entry