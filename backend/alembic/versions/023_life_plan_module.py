"""Módulo Projeto de Vida — tabelas de ciclo, diagnóstico, plano e revisão

Revision ID: 023_life_plan_module
Revises: 022_add_performance_indexes
Create Date: 2026-03-24
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "023_life_plan_module"
down_revision: Union[str, None] = "022_add_performance_indexes"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Enums
    op.execute("CREATE TYPE lifecyclestatus AS ENUM ('DRAFT', 'ACTIVE', 'ARCHIVED')")
    op.execute("CREATE TYPE lifedimension AS ENUM ('HUMANA', 'ESPIRITUAL', 'COMUNITARIA', 'INTELECTUAL', 'APOSTOLICA')")
    op.execute("CREATE TYPE lifemassfrequency AS ENUM ('DAILY', 'WEEKLY_MANY', 'WEEKLY', 'BI_WEEKLY', 'MONTHLY')")
    op.execute("CREATE TYPE lifeconfessionfrequency AS ENUM ('WEEKLY', 'BI_WEEKLY', 'MONTHLY', 'OTHER')")
    op.execute("CREATE TYPE lifereviewdecision AS ENUM ('CONTINUE', 'ADJUST_GOAL', 'CHANGE_PRIMARY_GOAL', 'NEW_CYCLE')")

    # life_plan_cycles
    op.create_table(
        "life_plan_cycles",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("status", sa.Text(), nullable=False, server_default="DRAFT"),
        sa.Column("realidade_vocacional", sa.String(50), nullable=True),
        sa.Column("wizard_progress", postgresql.JSONB(), nullable=True),
        sa.Column("started_at", sa.Date(), nullable=True),
        sa.Column("ended_at", sa.Date(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("idx_life_plan_cycles_user_id", "life_plan_cycles", ["user_id"])
    op.create_index("idx_life_plan_cycles_status", "life_plan_cycles", ["status"])
    op.execute(
        "CREATE UNIQUE INDEX idx_life_plan_cycles_active_user ON life_plan_cycles (user_id) WHERE status = 'ACTIVE'"
    )

    # life_plan_diagnoses
    op.create_table(
        "life_plan_diagnoses",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("cycle_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("life_plan_cycles.id", ondelete="CASCADE"), nullable=False),
        sa.Column("dimension", sa.Text(), nullable=False),
        sa.Column("abandonar", sa.Text(), nullable=True),
        sa.Column("melhorar", sa.Text(), nullable=True),
        sa.Column("deus_pede", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.UniqueConstraint("cycle_id", "dimension", name="uq_diagnosis_cycle_dimension"),
    )
    op.create_index("idx_life_plan_diagnoses_cycle_id", "life_plan_diagnoses", ["cycle_id"])

    # life_plan_cores (1:1 with cycle)
    op.create_table(
        "life_plan_cores",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("cycle_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("life_plan_cycles.id", ondelete="CASCADE"), nullable=False, unique=True),
        sa.Column("dominant_defect", sa.Text(), nullable=True),
        sa.Column("virtudes", sa.Text(), nullable=True),
        sa.Column("spiritual_director_name", sa.String(200), nullable=True),
        sa.Column("other_devotions", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )

    # life_plan_goals
    op.create_table(
        "life_plan_goals",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("cycle_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("life_plan_cycles.id", ondelete="CASCADE"), nullable=False),
        sa.Column("is_primary", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("title", sa.String(80), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("display_order", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("idx_life_plan_goals_cycle_id", "life_plan_goals", ["cycle_id"])

    # life_plan_actions
    op.create_table(
        "life_plan_actions",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("goal_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("life_plan_goals.id", ondelete="CASCADE"), nullable=False),
        sa.Column("action", sa.Text(), nullable=False),
        sa.Column("frequency", sa.String(100), nullable=True),
        sa.Column("context", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("idx_life_plan_actions_goal_id", "life_plan_actions", ["goal_id"])

    # life_plan_spiritual_routines (1:1 with cycle)
    op.create_table(
        "life_plan_spiritual_routines",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("cycle_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("life_plan_cycles.id", ondelete="CASCADE"), nullable=False, unique=True),
        sa.Column("prayer_type", sa.String(200), nullable=True),
        sa.Column("prayer_duration", sa.String(100), nullable=True),
        sa.Column("mass_frequency", sa.String(20), nullable=True),
        sa.Column("confession_frequency", sa.String(20), nullable=True),
        sa.Column("exam_of_conscience", sa.Boolean(), nullable=True),
        sa.Column("exam_time", sa.String(100), nullable=True),
        sa.Column("spiritual_reading", sa.String(200), nullable=True),
        sa.Column("spiritual_direction_frequency", sa.String(100), nullable=True),
        sa.Column("other_practices", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )

    # life_plan_monthly_reviews
    op.create_table(
        "life_plan_monthly_reviews",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("cycle_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("life_plan_cycles.id", ondelete="CASCADE"), nullable=False),
        sa.Column("review_date", sa.Date(), nullable=False),
        sa.Column("progress_reflection", sa.Text(), nullable=True),
        sa.Column("difficulties", sa.Text(), nullable=True),
        sa.Column("constancy_reflection", sa.Text(), nullable=True),
        sa.Column("decision", sa.Text(), nullable=False),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("idx_life_plan_monthly_reviews_cycle_id", "life_plan_monthly_reviews", ["cycle_id"])


def downgrade() -> None:
    op.drop_table("life_plan_monthly_reviews")
    op.drop_table("life_plan_spiritual_routines")
    op.drop_table("life_plan_actions")
    op.drop_table("life_plan_goals")
    op.drop_table("life_plan_cores")
    op.drop_table("life_plan_diagnoses")
    op.drop_table("life_plan_cycles")
    op.execute("DROP TYPE IF EXISTS lifereviewdecision")
    op.execute("DROP TYPE IF EXISTS lifeconfessionfrequency")
    op.execute("DROP TYPE IF EXISTS lifemassfrequency")
    op.execute("DROP TYPE IF EXISTS lifedimension")
    op.execute("DROP TYPE IF EXISTS lifecyclestatus")
