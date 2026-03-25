"""Equipes de Serviço por retiro

Revision ID: 018_retreat_service_teams
Revises: 017_retreat_eligibility_service
Create Date: 2026-03-20
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "018_retreat_service_teams"
down_revision: Union[str, None] = "017_retreat_eligibility_service"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Equipes de serviço do retiro
    op.create_table(
        "retreat_service_teams",
        sa.Column(
            "id",
            sa.UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column("retreat_id", sa.UUID(as_uuid=True), nullable=False),
        sa.Column("name", sa.Text(), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["retreat_id"], ["retreats.id"], ondelete="CASCADE"),
    )
    op.create_index("ix_rst_retreat_id", "retreat_service_teams", ["retreat_id"])

    # Membros atribuídos a equipes (por admin)
    op.create_table(
        "retreat_service_team_members",
        sa.Column(
            "id",
            sa.UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column("team_id", sa.UUID(as_uuid=True), nullable=False),
        sa.Column("registration_id", sa.UUID(as_uuid=True), nullable=False),
        sa.Column("house_id", sa.UUID(as_uuid=True), nullable=True),
        sa.Column("role", sa.Text(), nullable=False, server_default="MEMBRO"),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["team_id"], ["retreat_service_teams.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(
            ["registration_id"], ["retreat_registrations.id"], ondelete="CASCADE"
        ),
        sa.ForeignKeyConstraint(["house_id"], ["retreat_houses.id"], ondelete="SET NULL"),
        sa.UniqueConstraint("team_id", "registration_id", name="uq_team_member_registration"),
    )
    op.create_index("ix_rstm_team_id", "retreat_service_team_members", ["team_id"])
    op.create_index("ix_rstm_registration_id", "retreat_service_team_members", ["registration_id"])

    # Preferências de equipe declaradas pelo inscrito (no momento do cadastro)
    op.create_table(
        "retreat_team_preferences",
        sa.Column(
            "id",
            sa.UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column("registration_id", sa.UUID(as_uuid=True), nullable=False),
        sa.Column("team_id", sa.UUID(as_uuid=True), nullable=False),
        sa.Column("preference_order", sa.Integer(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(
            ["registration_id"], ["retreat_registrations.id"], ondelete="CASCADE"
        ),
        sa.ForeignKeyConstraint(["team_id"], ["retreat_service_teams.id"], ondelete="CASCADE"),
        sa.UniqueConstraint("registration_id", "team_id", name="uq_team_preference_reg_team"),
        sa.UniqueConstraint(
            "registration_id", "preference_order", name="uq_team_preference_reg_order"
        ),
    )
    op.create_index("ix_rtp_registration_id", "retreat_team_preferences", ["registration_id"])


def downgrade() -> None:
    op.drop_table("retreat_team_preferences")
    op.drop_table("retreat_service_team_members")
    op.drop_table("retreat_service_teams")
