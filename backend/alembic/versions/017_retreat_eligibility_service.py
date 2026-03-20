"""Grupos de elegibilidade no retiro (PARTICIPANT vs SERVICE)

Revision ID: 017_retreat_eligibility_service
Revises: 016_retreat_houses_fees
Create Date: 2026-03-20
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "017_retreat_eligibility_service"
down_revision: Union[str, None] = "016_retreat_houses_fees"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "retreat_eligibility_rules",
        sa.Column("rule_group", sa.Text(), nullable=False, server_default="PARTICIPANT"),
    )


def downgrade() -> None:
    op.drop_column("retreat_eligibility_rules", "rule_group")
