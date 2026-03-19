"""Adiciona campos extras ao perfil: instagram, restrição alimentar, plano de saúde,
preferência de acomodação, missão e encontro Despertar

Revision ID: 008_profile_extra_fields
Revises: 007_fix_org_units_type_column
Create Date: 2026-03-18
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "008_profile_extra_fields"
down_revision: Union[str, None] = "007_fix_org_units_type_column"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("user_profiles", sa.Column("instagram", sa.Text(), nullable=True))
    op.add_column("user_profiles", sa.Column("dietary_restriction", sa.Boolean(), nullable=True))
    op.add_column("user_profiles", sa.Column("dietary_restriction_notes", sa.Text(), nullable=True))
    op.add_column("user_profiles", sa.Column("health_insurance", sa.Boolean(), nullable=True))
    op.add_column("user_profiles", sa.Column("health_insurance_name", sa.Text(), nullable=True))
    op.add_column(
        "user_profiles", sa.Column("accommodation_preference", sa.String(20), nullable=True)
    )
    op.add_column("user_profiles", sa.Column("is_from_mission", sa.Boolean(), nullable=True))
    op.add_column("user_profiles", sa.Column("mission_name", sa.Text(), nullable=True))
    op.add_column("user_profiles", sa.Column("despertar_encounter", sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column("user_profiles", "despertar_encounter")
    op.drop_column("user_profiles", "mission_name")
    op.drop_column("user_profiles", "is_from_mission")
    op.drop_column("user_profiles", "accommodation_preference")
    op.drop_column("user_profiles", "health_insurance_name")
    op.drop_column("user_profiles", "health_insurance")
    op.drop_column("user_profiles", "dietary_restriction_notes")
    op.drop_column("user_profiles", "dietary_restriction")
    op.drop_column("user_profiles", "instagram")
