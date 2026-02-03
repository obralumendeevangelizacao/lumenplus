"""Phase 1 - Cadastro Geral

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
    op.create_table(
        "global_roles",
        sa.Column("id", sa.UUID(), nullable=False, server_default=sa.text("gen_random_uuid()")),
        sa.Column("code", sa.Text(), nullable=False),
        sa.Column("name", sa.Text(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("code"),
    )

    op.create_table(
        "user_global_roles",
        sa.Column("id", sa.UUID(), nullable=False, server_default=sa.text("gen_random_uuid()")),
        sa.Column("user_id", sa.UUID(), nullable=False),
        sa.Column("global_role_id", sa.UUID(), nullable=False),
        sa.Column("granted_by_user_id", sa.UUID(), nullable=True),
        sa.Column("granted_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["global_role_id"], ["global_roles.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["granted_by_user_id"], ["users.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("user_id", "global_role_id", name="uq_user_global_role"),
    )

    # Profile catalogs
    op.create_table(
        "profile_catalogs",
        sa.Column("id", sa.UUID(), nullable=False, server_default=sa.text("gen_random_uuid()")),
        sa.Column("code", sa.Text(), nullable=False),
        sa.Column("name", sa.Text(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("code"),
    )

    op.create_table(
        "profile_catalog_items",
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
    op.create_table(
        "user_profiles",
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

    # Emergency contacts - com nomes de colunas corretos
    op.create_table(
        "user_emergency_contacts",
        sa.Column("id", sa.UUID(), nullable=False, server_default=sa.text("gen_random_uuid()")),
        sa.Column("user_id", sa.UUID(), nullable=False),
        sa.Column("contact_name", sa.Text(), nullable=False),
        sa.Column("contact_phone", sa.Text(), nullable=False),
        sa.Column("contact_relationship", sa.Text(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.ForeignKeyConstraint(["user_id"], ["user_profiles.user_id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )

    # Legal documents
    op.create_table(
        "legal_documents",
        sa.Column("id", sa.UUID(), nullable=False, server_default=sa.text("gen_random_uuid()")),
        sa.Column("type", sa.Text(), nullable=False),
        sa.Column("version", sa.Text(), nullable=False),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("published_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("type", "version", name="uq_legal_doc_type_version"),
    )

    op.create_table(
        "user_consents",
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

    op.create_table(
        "user_preferences",
        sa.Column("user_id", sa.UUID(), nullable=False),
        sa.Column("analytics_opt_in", sa.Boolean(), server_default=sa.text("false")),
        sa.Column("push_opt_in", sa.Boolean(), server_default=sa.text("true")),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("user_id"),
    )

    # Phone verifications
    op.create_table(
        "phone_verifications",
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
    op.create_table(
        "sensitive_access_requests",
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

    op.create_table(
        "sensitive_access_audit",
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