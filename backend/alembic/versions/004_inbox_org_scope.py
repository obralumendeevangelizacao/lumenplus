"""Create inbox_messages and inbox_recipients tables

Revision ID: 004_inbox_org_scope
Revises: 003_fix_catalogs_profile
Create Date: 2026-03-16

Cria as tabelas de inbox (avisos) que estavam faltando nas migrations anteriores:
- inbox_messages: mensagens/avisos enviados por administradores
- inbox_recipients: relação mensagem <-> destinatário (controle de leitura)

Inclui coluna target_org_unit_id para registrar o escopo organizacional do aviso.
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
    # Cria o tipo enum para inbox_message_type
    inbox_message_type = postgresql.ENUM(
        "info", "warning", "success", "urgent",
        name="inbox_message_type",
        create_type=False,
    )
    inbox_message_type.create(op.get_bind(), checkfirst=True)

    # Cria tabela inbox_messages
    op.create_table(
        "inbox_messages",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            nullable=False,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column("title", sa.Text(), nullable=False),
        sa.Column("message", sa.Text(), nullable=False),
        sa.Column(
            "type",
            sa.Enum(
                "info", "warning", "success", "urgent",
                name="inbox_message_type",
                create_constraint=False,
                native_enum=False,
            ),
            nullable=False,
            server_default="INFO",
        ),
        sa.Column("attachments", postgresql.JSONB(), nullable=True),
        sa.Column("filters", postgresql.JSONB(), nullable=True),
        sa.Column(
            "target_org_unit_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("org_units.id", ondelete="SET NULL"),
            nullable=True,
            comment="OrgUnit alvo (preenchido quando enviado por coordenador de setor/grupo)",
        ),
        sa.Column(
            "created_by_user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
        ),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_inbox_messages_target_org_unit_id",
        "inbox_messages",
        ["target_org_unit_id"],
    )
    op.create_index(
        "ix_inbox_messages_created_by_user_id",
        "inbox_messages",
        ["created_by_user_id"],
    )
    op.create_index(
        "ix_inbox_messages_expires_at",
        "inbox_messages",
        ["expires_at"],
    )

    # Cria tabela inbox_recipients
    op.create_table(
        "inbox_recipients",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            nullable=False,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column(
            "message_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("inbox_messages.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "read",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("false"),
        ),
        sa.Column("read_at", sa.DateTime(timezone=True), nullable=True),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("message_id", "user_id", name="uq_inbox_recipient"),
    )
    op.create_index(
        "ix_inbox_recipient_user_read",
        "inbox_recipients",
        ["user_id", "read"],
    )


def downgrade() -> None:
    op.drop_index("ix_inbox_recipient_user_read", table_name="inbox_recipients")
    op.drop_table("inbox_recipients")
    op.drop_index("ix_inbox_messages_expires_at", table_name="inbox_messages")
    op.drop_index("ix_inbox_messages_created_by_user_id", table_name="inbox_messages")
    op.drop_index("ix_inbox_messages_target_org_unit_id", table_name="inbox_messages")
    op.drop_table("inbox_messages")
    op.execute("DROP TYPE IF EXISTS inbox_message_type")
