"""Initial schema for Lumen+ Phase 0

Revision ID: 001_initial_schema
Revises:
Create Date: 2025-01-22

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "001_initial_schema"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Create enum types FIRST, before any tables
    org_unit_type = postgresql.ENUM("SECTOR", "MINISTRY", "GROUP", name="org_unit_type", create_type=False)
    org_unit_type.create(op.get_bind(), checkfirst=True)

    membership_status = postgresql.ENUM("PENDING", "ACTIVE", "REJECTED", "REMOVED", name="membership_status", create_type=False)
    membership_status.create(op.get_bind(), checkfirst=True)

    # users table
    op.create_table(
        "users",
        sa.Column("id", sa.UUID(), nullable=False, server_default=sa.text("gen_random_uuid()")),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_users_is_active", "users", ["is_active"])

    # user_identities table
    op.create_table(
        "user_identities",
        sa.Column("id", sa.UUID(), nullable=False, server_default=sa.text("gen_random_uuid()")),
        sa.Column("user_id", sa.UUID(), nullable=False),
        sa.Column("provider", sa.Text(), nullable=False),
        sa.Column("provider_uid", sa.Text(), nullable=False),
        sa.Column("email", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("provider", "provider_uid", name="uq_identity_provider_uid"),
    )
    op.create_index("ix_user_identities_user_id", "user_identities", ["user_id"])
    op.create_index("ix_user_identities_email", "user_identities", ["email"])

    # audit_log table
    op.create_table(
        "audit_log",
        sa.Column("id", sa.UUID(), nullable=False, server_default=sa.text("gen_random_uuid()")),
        sa.Column("actor_user_id", sa.UUID(), nullable=True),
        sa.Column("action", sa.Text(), nullable=False),
        sa.Column("entity_type", sa.Text(), nullable=True),
        sa.Column("entity_id", sa.Text(), nullable=True),
        sa.Column("ip", sa.Text(), nullable=True),
        sa.Column("user_agent", sa.Text(), nullable=True),
        sa.Column("extra_data", postgresql.JSONB(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.ForeignKeyConstraint(["actor_user_id"], ["users.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_audit_log_actor_user_id", "audit_log", ["actor_user_id"])
    op.create_index("ix_audit_log_action", "audit_log", ["action"])
    op.create_index("ix_audit_log_created_at", "audit_log", ["created_at"])

    # org_units table - use sa.Enum with create_constraint=False to avoid duplicate creation
    op.create_table(
        "org_units",
        sa.Column("id", sa.UUID(), nullable=False, server_default=sa.text("gen_random_uuid()")),
        sa.Column("type", sa.Enum("SECTOR", "MINISTRY", "GROUP", name="org_unit_type", create_constraint=False, native_enum=False), nullable=False),
        sa.Column("name", sa.Text(), nullable=False),
        sa.Column("slug", sa.Text(), nullable=False),
        sa.Column("parent_id", sa.UUID(), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("created_by_user_id", sa.UUID(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.ForeignKeyConstraint(["parent_id"], ["org_units.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["created_by_user_id"], ["users.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("slug"),
    )
    op.create_index("ix_org_units_type", "org_units", ["type"])
    op.create_index("ix_org_units_parent_id", "org_units", ["parent_id"])
    op.create_index("ix_org_units_is_active", "org_units", ["is_active"])

    # org_roles table
    op.create_table(
        "org_roles",
        sa.Column("id", sa.UUID(), nullable=False, server_default=sa.text("gen_random_uuid()")),
        sa.Column("code", sa.Text(), nullable=False),
        sa.Column("name", sa.Text(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("code"),
    )

    # org_memberships table
    op.create_table(
        "org_memberships",
        sa.Column("id", sa.UUID(), nullable=False, server_default=sa.text("gen_random_uuid()")),
        sa.Column("user_id", sa.UUID(), nullable=False),
        sa.Column("org_unit_id", sa.UUID(), nullable=False),
        sa.Column("org_role_id", sa.UUID(), nullable=False),
        sa.Column("status", sa.Enum("PENDING", "ACTIVE", "REJECTED", "REMOVED", name="membership_status", create_constraint=False, native_enum=False), nullable=False, server_default="PENDING"),
        sa.Column("approved_by_user_id", sa.UUID(), nullable=True),
        sa.Column("approved_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["org_unit_id"], ["org_units.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["org_role_id"], ["org_roles.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["approved_by_user_id"], ["users.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("user_id", "org_unit_id", name="uq_membership_user_org"),
    )
    op.create_index("ix_org_memberships_user_id", "org_memberships", ["user_id"])
    op.create_index("ix_org_memberships_org_unit_id", "org_memberships", ["org_unit_id"])
    op.create_index("ix_org_memberships_status", "org_memberships", ["status"])


def downgrade() -> None:
    op.drop_table("org_memberships")
    op.drop_table("org_roles")
    op.drop_table("org_units")
    op.drop_table("audit_log")
    op.drop_table("user_identities")
    op.drop_table("users")

    op.execute("DROP TYPE IF EXISTS membership_status")
    op.execute("DROP TYPE IF EXISTS org_unit_type")