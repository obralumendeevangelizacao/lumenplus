"""Add target_org_unit_id to inbox_messages

Revision ID: 004_inbox_org_scope
Revises: 003_fix_catalogs_profile
Create Date: 2026-03-15

Adiciona coluna target_org_unit_id na tabela inbox_messages para registrar
o escopo organizacional do aviso (setor/grupo alvo quando enviado por coordenador).
"""

from typing import Sequence, Union
import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "004_inbox_org_scope"
down_revision: Union[str, None] = "003_fix_catalogs_profile"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "inbox_messages",
        sa.Column(
            "target_org_unit_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("org_units.id", ondelete="SET NULL"),
            nullable=True,
            comment="OrgUnit alvo (preenchido quando enviado por coordenador de setor/grupo)",
        ),
    )
    op.create_index(
        "ix_inbox_messages_target_org_unit_id",
        "inbox_messages",
        ["target_org_unit_id"],
    )


def downgrade() -> None:
    op.drop_index("ix_inbox_messages_target_org_unit_id", table_name="inbox_messages")
    op.drop_column("inbox_messages", "target_org_unit_id")
