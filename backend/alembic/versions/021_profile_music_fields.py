"""Adiciona campos de música/instrumentos ao perfil do usuário

Revision ID: 021_profile_music_fields
Revises: 020_org_unit_retreat_scope
Create Date: 2026-03-21
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "021_profile_music_fields"
down_revision: Union[str, None] = "020_org_unit_retreat_scope"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "user_profiles",
        sa.Column("plays_instrument", sa.Boolean(), nullable=True),
    )
    op.add_column(
        "user_profiles",
        sa.Column("instrument_names", sa.Text(), nullable=True),
    )
    op.add_column(
        "user_profiles",
        sa.Column("available_for_group", sa.Boolean(), nullable=True),
    )
    op.add_column(
        "user_profiles",
        sa.Column("music_availability", sa.Text(), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("user_profiles", "music_availability")
    op.drop_column("user_profiles", "available_for_group")
    op.drop_column("user_profiles", "instrument_names")
    op.drop_column("user_profiles", "plays_instrument")
