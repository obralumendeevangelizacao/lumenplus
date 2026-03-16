"""Create user_permissions table

Revision ID: 005_user_permissions
Revises: 004_inbox_org_scope
Create Date: 2026-03-16

Cria a tabela de permissões individuais de usuário.
Exemplo: CAN_SEND_INBOX permite enviar avisos para outros usuários.
"""

from typing import Sequence, Union
import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "005_user_permissions"
down_revision: Union[str, None] = "004_inbox_org_scope"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "user_permissions",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            nullable=False,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column(
            "user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("permission_code", sa.Text(), nullable=False),
        sa.Column(
            "granted_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
        ),
        sa.Column(
            "granted_by_user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("user_id", "permission_code", name="uq_user_permission"),
    )
    op.create_index(
        "ix_user_permission_code",
        "user_permissions",
        ["permission_code"],
    )
    op.create_index(
        "ix_user_permission_user_id",
        "user_permissions",
        ["user_id"],
    )


def downgrade() -> None:
    op.drop_index("ix_user_permission_user_id", table_name="user_permissions")
    op.drop_index("ix_user_permission_code", table_name="user_permissions")
    op.drop_table("user_permissions")
