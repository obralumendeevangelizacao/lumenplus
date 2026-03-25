"""Adiciona permissão PERMISSION_MANAGE_RETREATS

Revision ID: 015_retreat_permission
Revises: 014_retreat_module
Create Date: 2026-03-20
"""

from typing import Sequence, Union

revision: str = "015_retreat_permission"
down_revision: Union[str, None] = "014_retreat_module"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

PERMISSION_CODE = "PERMISSION_MANAGE_RETREATS"


def upgrade() -> None:
    # Apenas documenta que esta permissão existe no sistema.
    # Ela é verificada no código via UserPermission.permission_code.
    # ADMINs e DEVs têm acesso automático via código; outros usuários
    # (Conselho Geral, Conselho Executivo, Eventos e Retiros) recebem
    # individualmente pela tela de Gestão de Usuários.
    pass


def downgrade() -> None:
    pass
