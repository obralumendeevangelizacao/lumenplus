"""Adiciona retreat_scope à tabela org_units

Revision ID: 020_org_unit_retreat_scope
Revises: 019_retreat_coordinators
Create Date: 2026-03-21
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "020_org_unit_retreat_scope"
down_revision: Union[str, None] = "019_retreat_coordinators"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "org_units",
        sa.Column(
            "retreat_scope",
            sa.Boolean(),
            nullable=False,
            server_default="false",
        ),
    )


def downgrade() -> None:
    op.drop_column("org_units", "retreat_scope")
