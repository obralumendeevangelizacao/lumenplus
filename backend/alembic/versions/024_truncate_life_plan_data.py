"""Limpa todos os dados do módulo Projeto de Vida

Todos os usuários recomeçarão do zero com o wizard com validação obrigatória.

Revision ID: 024_truncate_life_plan_data
Revises: 023_life_plan_module
Create Date: 2026-03-24
"""

from typing import Sequence, Union

from alembic import op

revision: str = "024_truncate_life_plan_data"
down_revision: Union[str, None] = "023_life_plan_module"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Ordem importa: remover filhos antes dos pais (ou usar CASCADE)
    op.execute(
        """
        TRUNCATE TABLE
            life_plan_monthly_reviews,
            life_plan_actions,
            life_plan_goals,
            life_plan_spiritual_routines,
            life_plan_cores,
            life_plan_diagnoses,
            life_plan_cycles
        RESTART IDENTITY CASCADE
        """
    )


def downgrade() -> None:
    # Dados não podem ser restaurados após truncate
    pass
