"""Casas e taxas por retiro; campos adicionais em retreat_registrations

Revision ID: 016_retreat_houses_fees
Revises: 015_retreat_permission
Create Date: 2026-03-20
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "016_retreat_houses_fees"
down_revision: Union[str, None] = "015_retreat_permission"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # --- retreat_houses ---
    op.create_table(
        "retreat_houses",
        sa.Column(
            "id",
            sa.dialects.postgresql.UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column(
            "retreat_id",
            sa.dialects.postgresql.UUID(as_uuid=True),
            sa.ForeignKey("retreats.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("name", sa.Text(), nullable=False),
        sa.Column("modality", sa.Text(), nullable=False),  # PRESENCIAL | HIBRIDO
        sa.Column("max_participants", sa.Integer(), nullable=True),
    )
    op.create_index("ix_retreat_house_retreat", "retreat_houses", ["retreat_id"])

    # --- retreat_fee_types ---
    op.create_table(
        "retreat_fee_types",
        sa.Column(
            "id",
            sa.dialects.postgresql.UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column(
            "retreat_id",
            sa.dialects.postgresql.UUID(as_uuid=True),
            sa.ForeignKey("retreats.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("fee_category", sa.Text(), nullable=False),
        sa.Column("amount_brl", sa.String(20), nullable=False),
        sa.UniqueConstraint("retreat_id", "fee_category", name="uq_retreat_fee_category"),
    )
    op.create_index("ix_retreat_fee_retreat", "retreat_fee_types", ["retreat_id"])

    # --- alter retreat_registrations ---
    op.add_column(
        "retreat_registrations", sa.Column("modality_preference", sa.Text(), nullable=True)
    )
    op.add_column(
        "retreat_registrations",
        sa.Column("retreat_role", sa.Text(), nullable=False, server_default="PARTICIPANTE"),
    )
    op.add_column("retreat_registrations", sa.Column("fee_category", sa.Text(), nullable=True))
    op.add_column(
        "retreat_registrations",
        sa.Column(
            "assigned_house_id",
            sa.dialects.postgresql.UUID(as_uuid=True),
            sa.ForeignKey("retreat_houses.id", ondelete="SET NULL"),
            nullable=True,
        ),
    )


def downgrade() -> None:
    op.drop_column("retreat_registrations", "assigned_house_id")
    op.drop_column("retreat_registrations", "fee_category")
    op.drop_column("retreat_registrations", "retreat_role")
    op.drop_column("retreat_registrations", "modality_preference")
    op.drop_table("retreat_fee_types")
    op.drop_table("retreat_houses")
