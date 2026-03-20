"""
Re-export shim — a fonte canônica de auditoria é app.audit.service.

Este módulo existe apenas para compatibilidade com imports legados:
    from app.services.audit_service import sanitize_sensitive_data
    from app.services.audit_service import create_audit_log
"""

from app.audit.service import create_audit_log, sanitize_sensitive_data  # noqa: F401

__all__ = ["create_audit_log", "sanitize_sensitive_data"]
