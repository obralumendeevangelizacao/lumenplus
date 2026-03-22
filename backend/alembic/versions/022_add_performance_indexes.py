"""Adiciona índices de performance nas FKs mais consultadas

Revision ID: 022_add_performance_indexes
Revises: 021_profile_music_fields
Create Date: 2026-03-21
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "022_add_performance_indexes"
down_revision: Union[str, None] = "021_profile_music_fields"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # org_memberships — consultas por usuário e por unidade
    op.create_index("idx_org_memberships_user_id", "org_memberships", ["user_id"])
    op.create_index("idx_org_memberships_org_unit_id", "org_memberships", ["org_unit_id"])

    # org_units — navegação da árvore via parent_id
    op.create_index("idx_org_units_parent_id", "org_units", ["parent_id"])

    # org_invites — convites pendentes por usuário e filtro por status
    op.create_index("idx_org_invites_invited_user_id", "org_invites", ["invited_user_id"])
    op.create_index("idx_org_invites_status", "org_invites", ["status"])

    # user_global_roles — verificação de papéis globais (chamada em quase todo endpoint)
    op.create_index("idx_user_global_roles_user_id", "user_global_roles", ["user_id"])


def downgrade() -> None:
    op.drop_index("idx_user_global_roles_user_id", table_name="user_global_roles")
    op.drop_index("idx_org_invites_status", table_name="org_invites")
    op.drop_index("idx_org_invites_invited_user_id", table_name="org_invites")
    op.drop_index("idx_org_units_parent_id", table_name="org_units")
    op.drop_index("idx_org_memberships_org_unit_id", table_name="org_memberships")
    op.drop_index("idx_org_memberships_user_id", table_name="org_memberships")
