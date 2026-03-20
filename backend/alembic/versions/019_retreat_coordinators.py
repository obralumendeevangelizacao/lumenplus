"""Coordenadores de retiro (cargo escopo-retiro)

Revision ID: 019_retreat_coordinators
Revises: 018_retreat_service_teams
Create Date: 2026-03-20
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "019_retreat_coordinators"
down_revision: Union[str, None] = "018_retreat_service_teams"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "retreat_coordinators",
        sa.Column("id", sa.UUID(as_uuid=True), primary_key=True,
                  server_default=sa.text("gen_random_uuid()")),
        sa.Column("retreat_id", sa.UUID(as_uuid=True), nullable=False),
        sa.Column("user_id", sa.UUID(as_uuid=True), nullable=False),
        sa.Column("granted_by_user_id", sa.UUID(as_uuid=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True),
                  server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["retreat_id"], ["retreats.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["granted_by_user_id"], ["users.id"], ondelete="SET NULL"),
        sa.UniqueConstraint("retreat_id", "user_id", name="uq_retreat_coordinator"),
    )
    op.create_index("ix_rc_retreat_id", "retreat_coordinators", ["retreat_id"])
    op.create_index("ix_rc_user_id", "retreat_coordinators", ["user_id"])


def downgrade() -> None:
    op.drop_table("retreat_coordinators")
