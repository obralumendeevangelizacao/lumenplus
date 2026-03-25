"""Add ANALISTA global role

Revision ID: 012_add_analista_role
Revises: 011_legal_documents_v1_2
Create Date: 2026-03-19
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "012_add_analista_role"
down_revision: Union[str, None] = "011_legal_documents_v1_2"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute(
        sa.text(
            "INSERT INTO global_roles (id, code, name) "
            "VALUES (gen_random_uuid(), 'ANALISTA', 'Analista') "
            "ON CONFLICT (code) DO NOTHING"
        )
    )


def downgrade() -> None:
    op.execute(sa.text("DELETE FROM global_roles WHERE code = 'ANALISTA'"))
