"""
Schemas — Módulo Projeto de Vida
=================================
Dados sensíveis. Não expor em logs ou relatórios de admin.
"""

from __future__ import annotations

from datetime import date, datetime
from typing import Any, Optional
from uuid import UUID

from pydantic import BaseModel, Field


# ── Diagnosis ──────────────────────────────────────────────────────────────


class DiagnosisUpsert(BaseModel):
    dimension: str  # HUMANA | ESPIRITUAL | COMUNITARIA | INTELECTUAL | APOSTOLICA
    abandonar: Optional[str] = None
    melhorar: Optional[str] = None
    deus_pede: Optional[str] = None


class DiagnosisOut(BaseModel):
    id: UUID
    cycle_id: UUID
    dimension: str
    abandonar: Optional[str]
    melhorar: Optional[str]
    deus_pede: Optional[str]

    model_config = {"from_attributes": True}


# ── Core ───────────────────────────────────────────────────────────────────


class CoreUpsert(BaseModel):
    dominant_defect: Optional[str] = None
    virtudes: Optional[str] = None
    spiritual_director_name: Optional[str] = Field(None, max_length=200)
    other_devotions: Optional[str] = None


class CoreOut(CoreUpsert):
    id: UUID
    cycle_id: UUID

    model_config = {"from_attributes": True}


# ── Action ─────────────────────────────────────────────────────────────────


class ActionCreate(BaseModel):
    action: str
    frequency: Optional[str] = Field(None, max_length=100)
    context: Optional[str] = None


class ActionUpdate(BaseModel):
    action: Optional[str] = None
    frequency: Optional[str] = Field(None, max_length=100)
    context: Optional[str] = None


class ActionOut(BaseModel):
    id: UUID
    goal_id: UUID
    action: str
    frequency: Optional[str]
    context: Optional[str]

    model_config = {"from_attributes": True}


# ── Goal ───────────────────────────────────────────────────────────────────


class GoalCreate(BaseModel):
    is_primary: bool = False
    title: str = Field(..., max_length=80)
    description: Optional[str] = None
    display_order: int = 0
    actions: list[ActionCreate] = []


class GoalUpdate(BaseModel):
    title: Optional[str] = Field(None, max_length=80)
    description: Optional[str] = None
    display_order: Optional[int] = None
    is_primary: Optional[bool] = None


class GoalOut(BaseModel):
    id: UUID
    cycle_id: UUID
    is_primary: bool
    title: str
    description: Optional[str]
    display_order: int
    actions: list[ActionOut] = []

    model_config = {"from_attributes": True}


# ── Spiritual Routine ──────────────────────────────────────────────────────


class SpiritualRoutineUpsert(BaseModel):
    prayer_type: Optional[str] = Field(None, max_length=200)
    prayer_duration: Optional[str] = Field(None, max_length=100)
    mass_frequency: Optional[str] = Field(None, max_length=20)
    confession_frequency: Optional[str] = Field(None, max_length=20)
    exam_of_conscience: Optional[bool] = None
    exam_time: Optional[str] = Field(None, max_length=100)
    spiritual_reading: Optional[str] = Field(None, max_length=200)
    spiritual_direction_frequency: Optional[str] = Field(None, max_length=100)
    other_practices: Optional[str] = None


class SpiritualRoutineOut(SpiritualRoutineUpsert):
    id: UUID
    cycle_id: UUID

    model_config = {"from_attributes": True}


# ── Monthly Review ─────────────────────────────────────────────────────────


class MonthlyReviewCreate(BaseModel):
    review_date: date
    progress_reflection: Optional[str] = None
    difficulties: Optional[str] = None
    constancy_reflection: Optional[str] = None
    decision: str  # CONTINUE | ADJUST_GOAL | CHANGE_PRIMARY_GOAL | NEW_CYCLE
    notes: Optional[str] = None
    # For ADJUST_GOAL / CHANGE_PRIMARY_GOAL
    updated_goal_id: Optional[UUID] = None
    updated_goal_title: Optional[str] = Field(None, max_length=80)
    updated_goal_description: Optional[str] = None


class MonthlyReviewOut(BaseModel):
    id: UUID
    cycle_id: UUID
    review_date: date
    progress_reflection: Optional[str]
    difficulties: Optional[str]
    constancy_reflection: Optional[str]
    decision: str
    notes: Optional[str]
    created_at: datetime

    model_config = {"from_attributes": True}


# ── Cycle ──────────────────────────────────────────────────────────────────


class CycleCreate(BaseModel):
    realidade_vocacional: Optional[str] = None


class WizardProgressUpdate(BaseModel):
    wizard_progress: dict[str, Any]


class CycleOut(BaseModel):
    id: UUID
    status: str
    realidade_vocacional: Optional[str]
    wizard_progress: Optional[dict[str, Any]]
    started_at: Optional[date]
    ended_at: Optional[date]
    created_at: datetime
    updated_at: datetime
    diagnoses: list[DiagnosisOut] = []
    core: Optional[CoreOut] = None
    goals: list[GoalOut] = []
    routine: Optional[SpiritualRoutineOut] = None
    monthly_reviews: list[MonthlyReviewOut] = []

    model_config = {"from_attributes": True}


class CycleSummaryOut(BaseModel):
    id: UUID
    status: str
    realidade_vocacional: Optional[str]
    started_at: Optional[date]
    ended_at: Optional[date]
    primary_goal_title: Optional[str] = None
    dominant_defect: Optional[str] = None
    review_count: int = 0
    created_at: datetime

    model_config = {"from_attributes": True}
