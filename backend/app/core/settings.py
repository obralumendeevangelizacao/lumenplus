"""
Re-export shim — a fonte canônica de configurações é app.settings.

Este módulo existe apenas para compatibilidade com imports legados:
    from app.core.settings import settings
"""

from app.settings import Settings, get_settings, settings  # noqa: F401

__all__ = ["Settings", "get_settings", "settings"]
