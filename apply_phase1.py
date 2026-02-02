#!/usr/bin/env python3
"""
Lumen+ Phase 1 Setup Script
Run this script in your lumen-plus project root to add Phase 1 files.
"""

import os

def create_file(path: str, content: str) -> None:
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, 'w', encoding='utf-8') as f:
        f.write(content)
    print(f"Created: {path}")

create_file("backend/alembic/versions/002_phase1_cadastro.py", '''"""Phase 1 - Cadastro Geral

Revision ID: 002_phase1_cadastro
Revises: 001_initial_schema
Create Date: 2025-01-26
"""

from typing import Sequence, Union
import sqlalchemy as sa
from alembic import op

revision: str = "002_phase1_cadastro"
down_revision: Union[str, None] = "001_initial_schema"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

def upgrade() -> None:
    # Global roles
    op.create_table("global_roles",
        sa.Column("id", sa.UUID(), nullable=False, server_default=sa.text("gen_random_uuid()")),
        sa.Column("code", sa.Text(), nullable=False),
        sa.Column("name", sa.Text(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("code"),
    )
    
    op.create_table("user_global_roles",
        sa.Column("id", sa.UUID(), nullable=False, server_default=sa.text("gen_random_uuid()")),
        sa.Column("user_id", sa.UUID(), nullable=False),
        sa.Column("global_role_id", sa.UUID(), nullable=False),
        sa.Column("granted_by_user_id", sa.UUID(), nullable=True),
        sa.Column("granted_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["global_role_id"], ["global_roles.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("user_id", "global_role_id", name="uq_user_global_role"),
    )

    # Profile catalogs
    op.create_table("profile_catalogs",
        sa.Column("id", sa.UUID(), nullable=False, server_default=sa.text("gen_random_uuid()")),
        sa.Column("code", sa.Text(), nullable=False),
        sa.Column("name", sa.Text(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("code"),
    )
    
    op.create_table("profile_catalog_items",
        sa.Column("id", sa.UUID(), nullable=False, server_default=sa.text("gen_random_uuid()")),
        sa.Column("catalog_id", sa.UUID(), nullable=False),
        sa.Column("code", sa.Text(), nullable=False),
        sa.Column("label", sa.Text(), nullable=False),
        sa.Column("sort_order", sa.Integer(), server_default="0"),
        sa.Column("is_active", sa.Boolean(), server_default=sa.text("true")),
        sa.ForeignKeyConstraint(["catalog_id"], ["profile_catalogs.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("catalog_id", "code", name="uq_catalog_item_code"),
    )

    # User profiles
    op.create_table("user_profiles",
        sa.Column("user_id", sa.UUID(), nullable=False),
        sa.Column("full_name", sa.Text()),
        sa.Column("birth_date", sa.Date()),
        sa.Column("cpf_hash", sa.Text()),
        sa.Column("cpf_encrypted", sa.LargeBinary()),
        sa.Column("rg_encrypted", sa.LargeBinary()),
        sa.Column("phone_e164", sa.Text()),
        sa.Column("phone_verified", sa.Boolean(), server_default=sa.text("false")),
        sa.Column("city", sa.Text()),
        sa.Column("state", sa.String(2)),
        sa.Column("life_state_item_id", sa.UUID()),
        sa.Column("marital_status_item_id", sa.UUID()),
        sa.Column("vocational_reality_item_id", sa.UUID()),
        sa.Column("status", sa.Text(), server_default="INCOMPLETE"),
        sa.Column("completed_at", sa.DateTime(timezone=True)),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("user_id"),
    )
    op.create_index("ix_user_profiles_cpf_hash", "user_profiles", ["cpf_hash"], unique=True)
    op.create_index("ix_user_profiles_phone_e164", "user_profiles", ["phone_e164"], unique=True)

    # Emergency contacts
    op.create_table("user_emergency_contacts",
        sa.Column("id", sa.UUID(), nullable=False, server_default=sa.text("gen_random_uuid()")),
        sa.Column("user_id", sa.UUID(), nullable=False),
        sa.Column("name", sa.Text(), nullable=False),
        sa.Column("phone_e164", sa.Text(), nullable=False),
        sa.Column("relationship", sa.Text(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.ForeignKeyConstraint(["user_id"], ["user_profiles.user_id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )

    # Legal documents
    op.create_table("legal_documents",
        sa.Column("id", sa.UUID(), nullable=False, server_default=sa.text("gen_random_uuid()")),
        sa.Column("type", sa.Text(), nullable=False),
        sa.Column("version", sa.Text(), nullable=False),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("published_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("type", "version", name="uq_legal_doc_type_version"),
    )

    op.create_table("user_consents",
        sa.Column("id", sa.UUID(), nullable=False, server_default=sa.text("gen_random_uuid()")),
        sa.Column("user_id", sa.UUID(), nullable=False),
        sa.Column("document_id", sa.UUID(), nullable=False),
        sa.Column("accepted_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("ip", sa.Text()),
        sa.Column("user_agent", sa.Text()),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["document_id"], ["legal_documents.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )

    op.create_table("user_preferences",
        sa.Column("user_id", sa.UUID(), nullable=False),
        sa.Column("analytics_opt_in", sa.Boolean(), server_default=sa.text("false")),
        sa.Column("push_opt_in", sa.Boolean(), server_default=sa.text("true")),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("user_id"),
    )

    # Phone verifications
    op.create_table("phone_verifications",
        sa.Column("id", sa.UUID(), nullable=False, server_default=sa.text("gen_random_uuid()")),
        sa.Column("user_id", sa.UUID(), nullable=False),
        sa.Column("phone_e164", sa.Text(), nullable=False),
        sa.Column("channel", sa.Text(), nullable=False),
        sa.Column("code_hash", sa.Text(), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("verified_at", sa.DateTime(timezone=True)),
        sa.Column("attempts", sa.Integer(), server_default="0"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )

    # Sensitive access
    op.create_table("sensitive_access_requests",
        sa.Column("id", sa.UUID(), nullable=False, server_default=sa.text("gen_random_uuid()")),
        sa.Column("requester_user_id", sa.UUID(), nullable=False),
        sa.Column("target_user_id", sa.UUID(), nullable=False),
        sa.Column("scope", sa.Text(), nullable=False),
        sa.Column("reason", sa.Text(), nullable=False),
        sa.Column("status", sa.Text(), server_default="PENDING"),
        sa.Column("approved_by_user_id", sa.UUID()),
        sa.Column("approved_at", sa.DateTime(timezone=True)),
        sa.Column("expires_at", sa.DateTime(timezone=True)),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.ForeignKeyConstraint(["requester_user_id"], ["users.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["target_user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )

    op.create_table("sensitive_access_audit",
        sa.Column("id", sa.UUID(), nullable=False, server_default=sa.text("gen_random_uuid()")),
        sa.Column("request_id", sa.UUID()),
        sa.Column("viewer_user_id", sa.UUID(), nullable=False),
        sa.Column("target_user_id", sa.UUID(), nullable=False),
        sa.Column("action", sa.Text(), nullable=False),
        sa.Column("ip", sa.Text()),
        sa.Column("user_agent", sa.Text()),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.ForeignKeyConstraint(["viewer_user_id"], ["users.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["target_user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )

    # Add email_verified to identities
    op.add_column("user_identities", sa.Column("email_verified", sa.Boolean(), server_default=sa.text("false")))

def downgrade() -> None:
    op.drop_column("user_identities", "email_verified")
    op.drop_table("sensitive_access_audit")
    op.drop_table("sensitive_access_requests")
    op.drop_table("phone_verifications")
    op.drop_table("user_preferences")
    op.drop_table("user_consents")
    op.drop_table("legal_documents")
    op.drop_table("user_emergency_contacts")
    op.drop_table("user_profiles")
    op.drop_table("profile_catalog_items")
    op.drop_table("profile_catalogs")
    op.drop_table("user_global_roles")
    op.drop_table("global_roles")
''')

create_file("backend/app/crypto/__init__.py", '"""Crypto module"""')

create_file("backend/app/crypto/service.py", '''"""Cryptographic services for sensitive data."""
import base64, hashlib, hmac, os, secrets
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from app.settings import settings

class CryptoService:
    def __init__(self):
        self._encryption_key = None
        self._hmac_pepper = None
        if settings.encryption_key:
            try: self._encryption_key = base64.b64decode(settings.encryption_key)
            except: pass
        if settings.hmac_pepper:
            try: self._hmac_pepper = base64.b64decode(settings.hmac_pepper)
            except: pass
        if settings.is_dev:
            if not self._encryption_key: self._encryption_key = secrets.token_bytes(32)
            if not self._hmac_pepper: self._hmac_pepper = secrets.token_bytes(32)

    @property
    def is_configured(self): return self._encryption_key and self._hmac_pepper

    def hash_cpf(self, cpf: str) -> str:
        normalized = "".join(c for c in cpf if c.isdigit())
        if len(normalized) != 11: raise ValueError("CPF must have 11 digits")
        return hmac.new(self._hmac_pepper, normalized.encode(), hashlib.sha256).hexdigest()

    def encrypt(self, plaintext: str) -> bytes:
        aesgcm = AESGCM(self._encryption_key)
        nonce = os.urandom(12)
        return nonce + aesgcm.encrypt(nonce, plaintext.encode(), None)

    def decrypt(self, ciphertext: bytes) -> str:
        aesgcm = AESGCM(self._encryption_key)
        return aesgcm.decrypt(ciphertext[:12], ciphertext[12:], None).decode()

    def encrypt_cpf(self, cpf: str):
        normalized = "".join(c for c in cpf if c.isdigit())
        return self.hash_cpf(normalized), self.encrypt(normalized)

    def encrypt_rg(self, rg: str) -> bytes:
        return self.encrypt("".join(c for c in rg if c.isalnum()))

crypto_service = CryptoService()
''')

create_file("backend/app/notifications/__init__.py", '"""Notifications module"""')

create_file("backend/app/notifications/provider.py", '''"""Notification provider."""
import structlog
from abc import ABC, abstractmethod
from app.settings import settings
logger = structlog.get_logger()

class NotificationProvider(ABC):
    @abstractmethod
    def send_sms(self, phone: str, msg: str) -> bool: pass
    @abstractmethod
    def send_whatsapp(self, phone: str, msg: str) -> bool: pass

class MockNotificationProvider(NotificationProvider):
    def __init__(self): self._last_code = None
    def send_sms(self, phone, msg):
        logger.info("mock_sms", phone=phone[:4]+"****")
        return True
    def send_whatsapp(self, phone, msg):
        logger.info("mock_whatsapp", phone=phone[:4]+"****")
        return True
    def get_last_code(self): return self._last_code
    def set_last_code(self, code): self._last_code = code

notification_provider = MockNotificationProvider() if settings.is_dev else None
''')

create_file("backend/app/settings.py", '''from functools import lru_cache
from typing import Literal
from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")
    environment: Literal["dev", "staging", "production", "test"] = "dev"
    secret_key: str = "change-me"
    database_url: str = "postgresql://lumen:lumen_secret@localhost:5432/lumen_db"
    redis_url: str = "redis://localhost:6379/0"
    auth_mode: Literal["DEV", "PROD"] = "DEV"
    firebase_project_id: str = ""
    cors_origins: str = "http://localhost:3000"
    rate_limit_requests_per_minute: int = 60
    rate_limit_verification_per_hour: int = 5
    enable_dev_endpoints: bool = True
    log_level: Literal["DEBUG", "INFO", "WARNING", "ERROR"] = "INFO"
    encryption_key: str = ""
    hmac_pepper: str = ""
    debug_verification_code: bool = False
    
    @property
    def cors_origins_list(self): return [o.strip() for o in self.cors_origins.split(",")]
    @property
    def is_dev(self): return self.environment in ("dev", "test")

@lru_cache
def get_settings(): return Settings()
settings = get_settings()
''')

# pyproject.toml update
create_file("backend/pyproject.toml", '''[project]
name = "lumen-backend"
version = "0.2.0"
requires-python = ">=3.12"
dependencies = [
    "fastapi>=0.115.0",
    "uvicorn[standard]>=0.32.0",
    "sqlalchemy>=2.0.36",
    "alembic>=1.14.0",
    "psycopg2-binary>=2.9.10",
    "redis>=5.2.0",
    "pydantic>=2.10.0",
    "pydantic-settings>=2.6.0",
    "python-jose[cryptography]>=3.3.0",
    "httpx>=0.28.0",
    "cachetools>=5.5.0",
    "structlog>=24.4.0",
    "cryptography>=44.0.0",
]

[project.optional-dependencies]
dev = ["pytest>=8.3.0", "ruff>=0.8.0", "mypy>=1.13.0"]

[tool.setuptools.packages.find]
include = ["app*"]

[tool.ruff]
line-length = 100

[tool.mypy]
python_version = "3.12"
strict = true
ignore_missing_imports = true
''')

print("\\n" + "="*60)
print("Phase 1 files created!")
print("="*60)
print("""
Next steps:
1. docker compose down -v
2. docker compose up -d --build
3. curl -X POST http://localhost:8000/dev/seed -H "Authorization: Bearer dev:admin:admin@example.com"
""")

if __name__ == "__main__":
    pass
