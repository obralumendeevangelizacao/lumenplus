"""Fix org_units.type column from VARCHAR(8) to TEXT

Revision ID: 007_fix_org_units_type_column
Revises: 006_fix_org_unit_type_enum
Create Date: 2026-03-16

A migration 001 criou org_units.type como VARCHAR(8) porque o valor mais longo
dos enums originais era "MINISTRY" (8 chars). Com os novos valores do enum
(ex: "CONSELHO_GERAL" = 13 chars), a coluna truncava com erro:
  psycopg.errors.StringDataRightTruncation: value too long for type character varying(8)

Solução: alterar a coluna para TEXT (sem limite de tamanho).
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "007_fix_org_units_type_column"
down_revision: Union[str, None] = "006_fix_org_unit_type_enum"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Altera a coluna type de VARCHAR(8) para TEXT
    # Necessário porque "CONSELHO_GERAL" (13 chars) excede VARCHAR(8)
    op.alter_column(
        "org_units",
        "type",
        type_=sa.Text(),
        existing_nullable=False,
        existing_server_default=None,
    )


def downgrade() -> None:
    # Reverte para VARCHAR(8) — atenção: dados com valores > 8 chars serão truncados
    op.alter_column(
        "org_units",
        "type",
        type_=sa.String(8),
        existing_nullable=False,
        existing_server_default=None,
    )
