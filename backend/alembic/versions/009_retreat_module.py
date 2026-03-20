"""Módulo de retiros: tabelas retreats, retreat_eligibility_rules, retreat_registrations

Revision ID: 009_retreat_module
Revises: 008_profile_extra_fields
Create Date: 2026-03-20
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "009_retreat_module"
down_revision: Union[str, None] = "008_profile_extra_fields"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Enums
    op.execute("""
        DO $$ BEGIN
            CREATE TYPE retreat_type AS ENUM ('WEEKEND', 'DAY', 'FORMATION');
        EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    """)
    op.execute("""
        DO $$ BEGIN
            CREATE TYPE retreat_status AS ENUM ('DRAFT', 'PUBLISHED', 'CLOSED', 'CANCELLED');
        EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    """)
    op.execute("""
        DO $$ BEGIN
            CREATE TYPE retreat_visibility_type AS ENUM ('ALL', 'SPECIFIC');
        EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    """)
    op.execute("""
        DO $$ BEGIN
            CREATE TYPE retreat_eligibility_rule_type AS ENUM ('ORG_UNIT', 'VOCATIONAL_REALITY');
        EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    """)
    op.execute("""
        DO $$ BEGIN
            CREATE TYPE registration_status AS ENUM (
                'PENDING_PAYMENT', 'PAYMENT_SUBMITTED', 'CONFIRMED', 'CANCELLED', 'WAITLIST'
            );
        EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    """)

    # Tabela retreats
    op.create_table(
        "retreats",
        sa.Column("id", sa.dialects.postgresql.UUID(as_uuid=True), primary_key=True,
                  server_default=sa.text("gen_random_uuid()")),
        sa.Column("title", sa.Text(), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("retreat_type", sa.Text(), nullable=False),
        sa.Column("status", sa.Text(), nullable=False, server_default="DRAFT"),
        sa.Column("start_date", sa.DateTime(timezone=True), nullable=False),
        sa.Column("end_date", sa.DateTime(timezone=True), nullable=False),
        sa.Column("location", sa.Text(), nullable=True),
        sa.Column("address", sa.Text(), nullable=True),
        sa.Column("max_participants", sa.Integer(), nullable=True),
        sa.Column("price_brl", sa.String(20), nullable=True),
        sa.Column("visibility_type", sa.Text(), nullable=False, server_default="ALL"),
        sa.Column("created_by_user_id", sa.dialects.postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
    )

    # Tabela retreat_eligibility_rules
    op.create_table(
        "retreat_eligibility_rules",
        sa.Column("id", sa.dialects.postgresql.UUID(as_uuid=True), primary_key=True,
                  server_default=sa.text("gen_random_uuid()")),
        sa.Column("retreat_id", sa.dialects.postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("retreats.id", ondelete="CASCADE"), nullable=False),
        sa.Column("rule_type", sa.Text(), nullable=False),
        sa.Column("org_unit_id", sa.dialects.postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("org_units.id", ondelete="CASCADE"), nullable=True),
        sa.Column("vocational_reality_code", sa.Text(), nullable=True),
    )
    op.create_index("ix_eligibility_retreat", "retreat_eligibility_rules", ["retreat_id"])

    # Tabela retreat_registrations
    op.create_table(
        "retreat_registrations",
        sa.Column("id", sa.dialects.postgresql.UUID(as_uuid=True), primary_key=True,
                  server_default=sa.text("gen_random_uuid()")),
        sa.Column("retreat_id", sa.dialects.postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("retreats.id", ondelete="CASCADE"), nullable=False),
        sa.Column("user_id", sa.dialects.postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("status", sa.Text(), nullable=False, server_default="PENDING_PAYMENT"),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("payment_proof_url", sa.Text(), nullable=True),
        sa.Column("payment_submitted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("payment_confirmed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("payment_confirmed_by_user_id", sa.dialects.postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("payment_rejected_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("payment_rejected_by_user_id", sa.dialects.postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("payment_rejection_reason", sa.Text(), nullable=True),
        sa.Column("cancelled_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("cancelled_by_user_id", sa.dialects.postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
        sa.UniqueConstraint("retreat_id", "user_id", name="uq_retreat_registration"),
    )
    op.create_index("ix_registration_retreat", "retreat_registrations", ["retreat_id"])
    op.create_index("ix_registration_user", "retreat_registrations", ["user_id"])


def downgrade() -> None:
    op.drop_table("retreat_registrations")
    op.drop_table("retreat_eligibility_rules")
    op.drop_table("retreats")
    op.execute("DROP TYPE IF EXISTS registration_status")
    op.execute("DROP TYPE IF EXISTS retreat_eligibility_rule_type")
    op.execute("DROP TYPE IF EXISTS retreat_visibility_type")
    op.execute("DROP TYPE IF EXISTS retreat_status")
    op.execute("DROP TYPE IF EXISTS retreat_type")
