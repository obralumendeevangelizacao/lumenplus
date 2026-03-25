"""
Projeto de Vida — API Routes
==============================
Dados extremamente sensíveis.
- Acesso restrito ao próprio usuário
- Conteúdo textual NUNCA entra em audit logs
- Admin NÃO acessa conteúdo destes endpoints
"""

from datetime import date
from uuid import UUID

from fastapi import APIRouter, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.api.deps import CurrentUser, DBSession
from app.db.models import (
    LifePlanAction,
    LifePlanCore,
    LifePlanCycle,
    LifePlanDiagnosis,
    LifePlanGoal,
    LifePlanMonthlyReview,
    LifePlanSpiritualRoutine,
)
from app.schemas.life_plan import (
    ActionCreate,
    ActionOut,
    ActionUpdate,
    CoreOut,
    CoreUpsert,
    CycleCreate,
    CycleOut,
    CycleSummaryOut,
    DiagnosisOut,
    DiagnosisUpsert,
    GoalCreate,
    GoalOut,
    GoalUpdate,
    MonthlyReviewCreate,
    MonthlyReviewOut,
    SpiritualRoutineOut,
    SpiritualRoutineUpsert,
    WizardProgressUpdate,
)

router = APIRouter(prefix="/life-plan", tags=["Life Plan"])


def _load_cycle_full(db: DBSession, cycle_id: UUID, user_id: UUID) -> LifePlanCycle:
    """Carrega ciclo com todos os relacionamentos, verificando ownership."""
    result = db.execute(
        select(LifePlanCycle)
        .where(LifePlanCycle.id == cycle_id, LifePlanCycle.user_id == user_id)
        .options(
            selectinload(LifePlanCycle.diagnoses),
            selectinload(LifePlanCycle.core),
            selectinload(LifePlanCycle.goals).selectinload(LifePlanGoal.actions),
            selectinload(LifePlanCycle.routine),
            selectinload(LifePlanCycle.monthly_reviews),
        )
    )
    cycle = result.scalar_one_or_none()
    if not cycle:
        raise HTTPException(status_code=404, detail={"error": "not_found", "message": "Ciclo não encontrado"})
    return cycle


# ── Cycle endpoints ────────────────────────────────────────────────────────


@router.get("/me/active", response_model=CycleOut | None)
def get_active_cycle(user: CurrentUser, db: DBSession):
    """Retorna o ciclo ACTIVE ou DRAFT do usuário, com todos os dados."""
    result = db.execute(
        select(LifePlanCycle)
        .where(
            LifePlanCycle.user_id == user.id,
            LifePlanCycle.status.in_(["ACTIVE", "DRAFT"]),
        )
        .options(
            selectinload(LifePlanCycle.diagnoses),
            selectinload(LifePlanCycle.core),
            selectinload(LifePlanCycle.goals).selectinload(LifePlanGoal.actions),
            selectinload(LifePlanCycle.routine),
            selectinload(LifePlanCycle.monthly_reviews),
        )
        .order_by(LifePlanCycle.created_at.desc())
        .limit(1)
    )
    cycle = result.scalar_one_or_none()
    return cycle


@router.post("/cycles", response_model=CycleOut, status_code=201)
def create_cycle(body: CycleCreate, user: CurrentUser, db: DBSession):
    """
    Cria um novo ciclo em status DRAFT.
    Falha se já existir um ciclo ACTIVE (partial unique index).
    """
    # Verifica se já existe ciclo ACTIVE
    existing = db.execute(
        select(LifePlanCycle).where(
            LifePlanCycle.user_id == user.id,
            LifePlanCycle.status == "ACTIVE",
        )
    ).scalar_one_or_none()
    if existing:
        raise HTTPException(
            status_code=409,
            detail={"error": "conflict", "message": "Já existe um ciclo ativo. Encerre-o antes de iniciar um novo."},
        )

    cycle = LifePlanCycle(
        user_id=user.id,
        status="DRAFT",
        realidade_vocacional=body.realidade_vocacional,
    )
    db.add(cycle)
    db.commit()
    db.refresh(cycle)
    return cycle


@router.patch("/cycles/{cycle_id}/wizard-progress", response_model=CycleOut)
def update_wizard_progress(cycle_id: UUID, body: WizardProgressUpdate, user: CurrentUser, db: DBSession):
    """Salva progresso parcial do wizard sem avançar o status."""
    cycle = _load_cycle_full(db, cycle_id, user.id)
    cycle.wizard_progress = body.wizard_progress
    db.commit()
    db.refresh(cycle)
    return cycle


@router.post("/cycles/{cycle_id}/activate", response_model=CycleOut)
def activate_cycle(cycle_id: UUID, user: CurrentUser, db: DBSession):
    """Ativa o ciclo (DRAFT → ACTIVE) e registra a data de início."""
    cycle = _load_cycle_full(db, cycle_id, user.id)
    if cycle.status != "DRAFT":
        raise HTTPException(
            status_code=400,
            detail={"error": "invalid_state", "message": "Apenas ciclos em DRAFT podem ser ativados"},
        )
    cycle.status = "ACTIVE"
    cycle.started_at = date.today()
    db.commit()
    db.refresh(cycle)
    return cycle


@router.get("/history", response_model=list[CycleSummaryOut])
def get_history(user: CurrentUser, db: DBSession):
    """Lista todos os ciclos do usuário (ARCHIVED + ACTIVE), ordenados por data."""
    result = db.execute(
        select(LifePlanCycle)
        .where(LifePlanCycle.user_id == user.id)
        .options(
            selectinload(LifePlanCycle.core),
            selectinload(LifePlanCycle.goals),
            selectinload(LifePlanCycle.monthly_reviews),
        )
        .order_by(LifePlanCycle.created_at.desc())
    )
    cycles = result.scalars().all()

    summaries = []
    for c in cycles:
        primary = next((g for g in c.goals if g.is_primary), None)
        summaries.append(
            CycleSummaryOut(
                id=c.id,
                status=c.status,
                realidade_vocacional=c.realidade_vocacional,
                started_at=c.started_at,
                ended_at=c.ended_at,
                primary_goal_title=primary.title if primary else None,
                dominant_defect=c.core.dominant_defect if c.core else None,
                review_count=len(c.monthly_reviews),
                created_at=c.created_at,
            )
        )
    return summaries


@router.get("/cycles/{cycle_id}", response_model=CycleOut)
def get_cycle(cycle_id: UUID, user: CurrentUser, db: DBSession):
    """Retorna um ciclo específico (inclusive ARCHIVED) com todos os dados."""
    return _load_cycle_full(db, cycle_id, user.id)


# ── Diagnosis endpoints ────────────────────────────────────────────────────


@router.post("/cycles/{cycle_id}/diagnoses", response_model=DiagnosisOut)
def upsert_diagnosis(cycle_id: UUID, body: DiagnosisUpsert, user: CurrentUser, db: DBSession):
    """Cria ou atualiza o diagnóstico de uma dimensão do ciclo."""
    # Verificar ownership sem carregar tudo
    cycle = db.execute(
        select(LifePlanCycle).where(LifePlanCycle.id == cycle_id, LifePlanCycle.user_id == user.id)
    ).scalar_one_or_none()
    if not cycle:
        raise HTTPException(status_code=404, detail={"error": "not_found", "message": "Ciclo não encontrado"})

    existing = db.execute(
        select(LifePlanDiagnosis).where(
            LifePlanDiagnosis.cycle_id == cycle_id,
            LifePlanDiagnosis.dimension == body.dimension,
        )
    ).scalar_one_or_none()

    if existing:
        existing.abandonar = body.abandonar
        existing.melhorar = body.melhorar
        existing.deus_pede = body.deus_pede
        db.commit()
        db.refresh(existing)
        return existing

    diagnosis = LifePlanDiagnosis(
        cycle_id=cycle_id,
        dimension=body.dimension,
        abandonar=body.abandonar,
        melhorar=body.melhorar,
        deus_pede=body.deus_pede,
    )
    db.add(diagnosis)
    db.commit()
    db.refresh(diagnosis)
    return diagnosis


# ── Core endpoints ─────────────────────────────────────────────────────────


@router.post("/cycles/{cycle_id}/core", response_model=CoreOut)
def upsert_core(cycle_id: UUID, body: CoreUpsert, user: CurrentUser, db: DBSession):
    """Cria ou atualiza o núcleo do plano (defeito dominante, virtudes, etc.)."""
    cycle = db.execute(
        select(LifePlanCycle).where(LifePlanCycle.id == cycle_id, LifePlanCycle.user_id == user.id)
    ).scalar_one_or_none()
    if not cycle:
        raise HTTPException(status_code=404, detail={"error": "not_found", "message": "Ciclo não encontrado"})

    existing = db.execute(
        select(LifePlanCore).where(LifePlanCore.cycle_id == cycle_id)
    ).scalar_one_or_none()

    if existing:
        for field, value in body.model_dump(exclude_unset=True).items():
            setattr(existing, field, value)
        db.commit()
        db.refresh(existing)
        return existing

    core = LifePlanCore(cycle_id=cycle_id, **body.model_dump())
    db.add(core)
    db.commit()
    db.refresh(core)
    return core


# ── Goal endpoints ─────────────────────────────────────────────────────────


@router.post("/cycles/{cycle_id}/goals", response_model=GoalOut, status_code=201)
def create_goal(cycle_id: UUID, body: GoalCreate, user: CurrentUser, db: DBSession):
    """
    Cria um objetivo no ciclo.
    Restrições: 1 primário, máx 3 secundários.
    """
    cycle = db.execute(
        select(LifePlanCycle).where(LifePlanCycle.id == cycle_id, LifePlanCycle.user_id == user.id)
    ).scalar_one_or_none()
    if not cycle:
        raise HTTPException(status_code=404, detail={"error": "not_found", "message": "Ciclo não encontrado"})

    existing_goals = db.execute(
        select(LifePlanGoal).where(LifePlanGoal.cycle_id == cycle_id)
    ).scalars().all()

    if body.is_primary:
        if any(g.is_primary for g in existing_goals):
            raise HTTPException(
                status_code=409,
                detail={"error": "conflict", "message": "Já existe um objetivo principal neste ciclo"},
            )
    else:
        secondary_count = sum(1 for g in existing_goals if not g.is_primary)
        if secondary_count >= 3:
            raise HTTPException(
                status_code=422,
                detail={"error": "limit_exceeded", "message": "Máximo de 3 objetivos secundários atingido"},
            )

    goal = LifePlanGoal(
        cycle_id=cycle_id,
        is_primary=body.is_primary,
        title=body.title,
        description=body.description,
        display_order=body.display_order,
    )
    db.add(goal)
    db.flush()

    for action_data in body.actions:
        action = LifePlanAction(goal_id=goal.id, **action_data.model_dump())
        db.add(action)

    db.commit()
    db.refresh(goal)

    result = db.execute(
        select(LifePlanGoal).where(LifePlanGoal.id == goal.id).options(selectinload(LifePlanGoal.actions))
    )
    return result.scalar_one()


@router.patch("/goals/{goal_id}", response_model=GoalOut)
def update_goal(goal_id: UUID, body: GoalUpdate, user: CurrentUser, db: DBSession):
    """Atualiza um objetivo."""
    goal = db.execute(
        select(LifePlanGoal)
        .join(LifePlanCycle)
        .where(LifePlanGoal.id == goal_id, LifePlanCycle.user_id == user.id)
        .options(selectinload(LifePlanGoal.actions))
    ).scalar_one_or_none()
    if not goal:
        raise HTTPException(status_code=404, detail={"error": "not_found", "message": "Objetivo não encontrado"})

    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(goal, field, value)
    db.commit()
    db.refresh(goal)
    return goal


@router.delete("/goals/{goal_id}", status_code=204)
def delete_goal(goal_id: UUID, user: CurrentUser, db: DBSession):
    """Remove um objetivo e suas ações."""
    goal = db.execute(
        select(LifePlanGoal)
        .join(LifePlanCycle)
        .where(LifePlanGoal.id == goal_id, LifePlanCycle.user_id == user.id)
    ).scalar_one_or_none()
    if not goal:
        raise HTTPException(status_code=404, detail={"error": "not_found", "message": "Objetivo não encontrado"})
    db.delete(goal)
    db.commit()


# ── Action endpoints ───────────────────────────────────────────────────────


@router.post("/goals/{goal_id}/actions", response_model=ActionOut, status_code=201)
def create_action(goal_id: UUID, body: ActionCreate, user: CurrentUser, db: DBSession):
    """Adiciona um meio concreto a um objetivo."""
    goal = db.execute(
        select(LifePlanGoal)
        .join(LifePlanCycle)
        .where(LifePlanGoal.id == goal_id, LifePlanCycle.user_id == user.id)
    ).scalar_one_or_none()
    if not goal:
        raise HTTPException(status_code=404, detail={"error": "not_found", "message": "Objetivo não encontrado"})

    action = LifePlanAction(goal_id=goal_id, **body.model_dump())
    db.add(action)
    db.commit()
    db.refresh(action)
    return action


@router.patch("/actions/{action_id}", response_model=ActionOut)
def update_action(action_id: UUID, body: ActionUpdate, user: CurrentUser, db: DBSession):
    """Atualiza um meio concreto."""
    action = db.execute(
        select(LifePlanAction)
        .join(LifePlanGoal)
        .join(LifePlanCycle)
        .where(LifePlanAction.id == action_id, LifePlanCycle.user_id == user.id)
    ).scalar_one_or_none()
    if not action:
        raise HTTPException(status_code=404, detail={"error": "not_found", "message": "Ação não encontrada"})

    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(action, field, value)
    db.commit()
    db.refresh(action)
    return action


@router.delete("/actions/{action_id}", status_code=204)
def delete_action(action_id: UUID, user: CurrentUser, db: DBSession):
    """Remove um meio concreto."""
    action = db.execute(
        select(LifePlanAction)
        .join(LifePlanGoal)
        .join(LifePlanCycle)
        .where(LifePlanAction.id == action_id, LifePlanCycle.user_id == user.id)
    ).scalar_one_or_none()
    if not action:
        raise HTTPException(status_code=404, detail={"error": "not_found", "message": "Ação não encontrada"})
    db.delete(action)
    db.commit()


# ── Routine endpoints ──────────────────────────────────────────────────────


@router.post("/cycles/{cycle_id}/routine", response_model=SpiritualRoutineOut)
def upsert_routine(cycle_id: UUID, body: SpiritualRoutineUpsert, user: CurrentUser, db: DBSession):
    """Cria ou atualiza a rotina espiritual do ciclo."""
    cycle = db.execute(
        select(LifePlanCycle).where(LifePlanCycle.id == cycle_id, LifePlanCycle.user_id == user.id)
    ).scalar_one_or_none()
    if not cycle:
        raise HTTPException(status_code=404, detail={"error": "not_found", "message": "Ciclo não encontrado"})

    existing = db.execute(
        select(LifePlanSpiritualRoutine).where(LifePlanSpiritualRoutine.cycle_id == cycle_id)
    ).scalar_one_or_none()

    if existing:
        for field, value in body.model_dump(exclude_unset=True).items():
            setattr(existing, field, value)
        db.commit()
        db.refresh(existing)
        return existing

    routine = LifePlanSpiritualRoutine(cycle_id=cycle_id, **body.model_dump())
    db.add(routine)
    db.commit()
    db.refresh(routine)
    return routine


# ── Review endpoints ───────────────────────────────────────────────────────


@router.post("/cycles/{cycle_id}/reviews", response_model=MonthlyReviewOut, status_code=201)
def create_monthly_review(cycle_id: UUID, body: MonthlyReviewCreate, user: CurrentUser, db: DBSession):
    """
    Registra revisão mensal.
    Se decision = NEW_CYCLE: arquiva ciclo atual e cria novo DRAFT.
    Se decision = ADJUST_GOAL / CHANGE_PRIMARY_GOAL: atualiza objetivo indicado.
    """
    cycle = db.execute(
        select(LifePlanCycle)
        .where(LifePlanCycle.id == cycle_id, LifePlanCycle.user_id == user.id)
        .options(selectinload(LifePlanCycle.goals))
    ).scalar_one_or_none()
    if not cycle:
        raise HTTPException(status_code=404, detail={"error": "not_found", "message": "Ciclo não encontrado"})
    if cycle.status != "ACTIVE":
        raise HTTPException(
            status_code=400,
            detail={"error": "invalid_state", "message": "Revisão só pode ser criada em ciclos ACTIVE"},
        )

    review = LifePlanMonthlyReview(
        cycle_id=cycle_id,
        review_date=body.review_date,
        progress_reflection=body.progress_reflection,
        difficulties=body.difficulties,
        constancy_reflection=body.constancy_reflection,
        decision=body.decision,
        notes=body.notes,
    )
    db.add(review)

    if body.decision == "NEW_CYCLE":
        cycle.status = "ARCHIVED"
        cycle.ended_at = date.today()

    elif body.decision in ("ADJUST_GOAL", "CHANGE_PRIMARY_GOAL") and body.updated_goal_id:
        goal = db.execute(
            select(LifePlanGoal).where(
                LifePlanGoal.id == body.updated_goal_id,
                LifePlanGoal.cycle_id == cycle_id,
            )
        ).scalar_one_or_none()
        if goal:
            if body.updated_goal_title:
                goal.title = body.updated_goal_title
            if body.updated_goal_description is not None:
                goal.description = body.updated_goal_description

    db.commit()
    db.refresh(review)
    return review


@router.get("/cycles/{cycle_id}/reviews", response_model=list[MonthlyReviewOut])
def get_reviews(cycle_id: UUID, user: CurrentUser, db: DBSession):
    """Lista as revisões mensais de um ciclo."""
    cycle = db.execute(
        select(LifePlanCycle).where(LifePlanCycle.id == cycle_id, LifePlanCycle.user_id == user.id)
    ).scalar_one_or_none()
    if not cycle:
        raise HTTPException(status_code=404, detail={"error": "not_found", "message": "Ciclo não encontrado"})

    result = db.execute(
        select(LifePlanMonthlyReview)
        .where(LifePlanMonthlyReview.cycle_id == cycle_id)
        .order_by(LifePlanMonthlyReview.review_date.desc())
    )
    return result.scalars().all()
