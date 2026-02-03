"""
Lumen+ Backend Settings
=======================
Configurações organizadas por blocos lógicos.
"""

from functools import lru_cache
from typing import Literal

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
        case_sensitive=False,
    )

    # =========================================================================
    # APP
    # =========================================================================
    environment: Literal["dev", "staging", "production", "test"] = Field(default="dev")
    app_name: str = Field(default="Lumen+ API")
    app_version: str = Field(default="0.3.0")
    log_level: Literal["DEBUG", "INFO", "WARNING", "ERROR"] = Field(default="INFO")
    debug: bool = Field(default=False)

    # =========================================================================
    # SECURITY
    # =========================================================================
    secret_key: str = Field(default="change-me-in-production")
    auth_mode: Literal["DEV", "PROD"] = Field(default="DEV")
    cors_origins: str = Field(default="http://localhost:3000,http://localhost:8080,http://localhost:8081")
    
    # Criptografia (CPF/RG)
    encryption_key: str = Field(default="")
    hmac_pepper: str = Field(default="")

    # =========================================================================
    # DATABASE
    # =========================================================================
    database_url: str = Field(default="postgresql://lumen:lumen_secret@localhost:5432/lumen_db")
    database_pool_size: int = Field(default=5)
    database_max_overflow: int = Field(default=10)
    redis_url: str = Field(default="redis://localhost:6379/0")

    # =========================================================================
    # INTEGRATIONS
    # =========================================================================
    firebase_project_id: str = Field(default="")

    # =========================================================================
    # FEATURE FLAGS
    # =========================================================================
    enable_dev_endpoints: bool = Field(default=True)
    enable_audit: bool = Field(default=True)
    enable_phone_verification: bool = Field(default=True)
    enable_email_verification: bool = Field(default=True)
    enable_sensitive_access: bool = Field(default=True)
    debug_verification_code: bool = Field(default=True)  # Retorna código na resposta (só dev)

    # =========================================================================
    # RATE LIMITING
    # =========================================================================
    rate_limit_enabled: bool = Field(default=True)
    rate_limit_requests_per_minute: int = Field(default=60)
    rate_limit_verification_per_hour: int = Field(default=5)

    # =========================================================================
    # INVITES
    # =========================================================================
    invite_expiration_days: int = Field(default=7)

    # =========================================================================
    # COMPUTED
    # =========================================================================
    @property
    def cors_origins_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]

    @property
    def is_dev(self) -> bool:
        return self.environment in ("dev", "test")

    @property
    def is_production(self) -> bool:
        return self.environment == "production"

    def validate_production_settings(self) -> list[str]:
        errors = []
        if self.is_production:
            if "change-me" in self.secret_key:
                errors.append("SECRET_KEY deve ser alterado")
            if self.auth_mode == "DEV":
                errors.append("AUTH_MODE deve ser PROD")
            if self.enable_dev_endpoints:
                errors.append("ENABLE_DEV_ENDPOINTS deve ser False")
            if self.debug_verification_code:
                errors.append("DEBUG_VERIFICATION_CODE deve ser False")
            if not self.encryption_key:
                errors.append("ENCRYPTION_KEY é obrigatório")
        return errors


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
