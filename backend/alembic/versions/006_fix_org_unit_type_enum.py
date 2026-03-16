"""Fix org schema: add missing columns, recreate memberships, create invites

Revision ID: 006_fix_org_unit_type_enum
Revises: 005_user_permissions
Create Date: 2026-03-16

Corrige divergências entre as migrations 001/002 e o modelo atual:

1. org_unit_type PostgreSQL enum: adiciona os valores corretos
   (CONSELHO_GERAL, CONSELHO_EXECUTIVO, SETOR, MINISTERIO, GRUPO)

2. org_units: adiciona colunas faltantes
   - visibility (TEXT NOT NULL DEFAULT 'PUBLIC')
   - group_type (TEXT NULL)
   - description (TEXT NULL)

3. org_memberships: recria a tabela com o schema correto
   A migration 001 usou org_role_id (FK para org_roles).
   O modelo atual usa role (enum inline) + invite_id + joined_at.

4. org_invites: cria a tabela (nunca foi criada antes)
"""

from typing import Sequence, Union
import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "006_fix_org_unit_type_enum"
down_revision: Union[str, None] = "005_user_permissions"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # =========================================================================
    # 1. Adiciona valores ao enum org_unit_type
    # =========================================================================
    op.execute("ALTER TYPE org_unit_type ADD VALUE IF NOT EXISTS 'CONSELHO_GERAL'")
    op.execute("ALTER TYPE org_unit_type ADD VALUE IF NOT EXISTS 'CONSELHO_EXECUTIVO'")
    op.execute("ALTER TYPE org_unit_type ADD VALUE IF NOT EXISTS 'SETOR'")
    op.execute("ALTER TYPE org_unit_type ADD VALUE IF NOT EXISTS 'MINISTERIO'")
    op.execute("ALTER TYPE org_unit_type ADD VALUE IF NOT EXISTS 'GRUPO'")

    # =========================================================================
    # 2. org_units — adiciona colunas faltantes
    # =========================================================================
    op.add_column(
        "org_units",
        sa.Column("visibility", sa.Text(), nullable=False, server_default="PUBLIC"),
    )
    op.add_column(
        "org_units",
        sa.Column("group_type", sa.Text(), nullable=True),
    )
    op.add_column(
        "org_units",
        sa.Column("description", sa.Text(), nullable=True),
    )

    # =========================================================================
    # 3. Cria org_invites ANTES de recriar org_memberships
    #    (memberships referencia invite_id → org_invites)
    # =========================================================================
    op.create_table(
        "org_invites",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            nullable=False,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column(
            "org_unit_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("org_units.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "invited_user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "invited_by_user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("role", sa.Text(), nullable=False, server_default="MEMBER"),
        sa.Column("status", sa.Text(), nullable=False, server_default="PENDING"),
        sa.Column("message", sa.Text(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
        ),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("responded_at", sa.DateTime(timezone=True), nullable=True),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_org_invites_org_unit_id", "org_invites", ["org_unit_id"])
    op.create_index("ix_org_invites_invited_user_id", "org_invites", ["invited_user_id"])
    op.create_index("ix_org_invites_status", "org_invites", ["status"])

    # =========================================================================
    # 4. Recria org_memberships com o schema correto
    #    A tabela antiga (org_role_id FK) é incompatível com o modelo atual.
    #    Não há dados nesta tabela em produção.
    # =========================================================================
    op.drop_table("org_memberships")

    op.create_table(
        "org_memberships",
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
        sa.Column(
            "org_unit_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("org_units.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("role", sa.Text(), nullable=False, server_default="MEMBER"),
        sa.Column("status", sa.Text(), nullable=False, server_default="ACTIVE"),
        sa.Column(
            "joined_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
        ),
        sa.Column(
            "invite_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("org_invites.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("user_id", "org_unit_id", name="uq_membership_user_org"),
    )
    op.create_index("ix_org_memberships_user_id", "org_memberships", ["user_id"])
    op.create_index("ix_org_memberships_org_unit_id", "org_memberships", ["org_unit_id"])
    op.create_index("ix_org_memberships_status", "org_memberships", ["status"])


def downgrade() -> None:
    op.drop_table("org_memberships")
    op.drop_table("org_invites")
    op.drop_column("org_units", "description")
    op.drop_column("org_units", "group_type")
    op.drop_column("org_units", "visibility")
    # Recria org_memberships original (migration 001)
    op.create_table(
        "org_memberships",
        sa.Column("id", sa.UUID(), nullable=False, server_default=sa.text("gen_random_uuid()")),
        sa.Column("user_id", sa.UUID(), nullable=False),
        sa.Column("org_unit_id", sa.UUID(), nullable=False),
        sa.Column("org_role_id", sa.UUID(), nullable=False),
        sa.Column("status", sa.Text(), nullable=False, server_default="PENDING"),
        sa.Column("approved_by_user_id", sa.UUID(), nullable=True),
        sa.Column("approved_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["org_unit_id"], ["org_units.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["approved_by_user_id"], ["users.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("user_id", "org_unit_id", name="uq_membership_user_org"),
    )
