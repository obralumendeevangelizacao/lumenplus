/**
 * Life Plan API Service
 * ======================
 * Cliente para o módulo Projeto de Vida.
 * Dados sensíveis — não logar conteúdo de respostas.
 */

import api from '@/services/api';

// ── Types ──────────────────────────────────────────────────────────────────

export interface ActionOut {
  id: string;
  goal_id: string;
  action: string;
  frequency: string | null;
  context: string | null;
}

export interface GoalOut {
  id: string;
  cycle_id: string;
  is_primary: boolean;
  title: string;
  description: string | null;
  display_order: number;
  actions: ActionOut[];
}

export interface DiagnosisOut {
  id: string;
  cycle_id: string;
  dimension: string;
  abandonar: string | null;
  melhorar: string | null;
  deus_pede: string | null;
}

export interface CoreOut {
  id: string;
  cycle_id: string;
  dominant_defect: string | null;
  virtudes: string | null;
  spiritual_director_name: string | null;
  other_devotions: string | null;
}

export interface SpiritualRoutineOut {
  id: string;
  cycle_id: string;
  prayer_type: string | null;
  prayer_duration: string | null;
  mass_frequency: string | null;
  confession_frequency: string | null;
  exam_of_conscience: boolean | null;
  exam_time: string | null;
  spiritual_reading: string | null;
  spiritual_direction_frequency: string | null;
  other_practices: string | null;
}

export interface MonthlyReviewOut {
  id: string;
  cycle_id: string;
  review_date: string;
  progress_reflection: string | null;
  difficulties: string | null;
  constancy_reflection: string | null;
  decision: string;
  notes: string | null;
  created_at: string;
}

export interface CycleOut {
  id: string;
  status: string;
  realidade_vocacional: string | null;
  wizard_progress: Record<string, unknown> | null;
  started_at: string | null;
  ended_at: string | null;
  created_at: string;
  updated_at: string;
  diagnoses: DiagnosisOut[];
  core: CoreOut | null;
  goals: GoalOut[];
  routine: SpiritualRoutineOut | null;
  monthly_reviews: MonthlyReviewOut[];
}

export interface CycleSummaryOut {
  id: string;
  status: string;
  realidade_vocacional: string | null;
  started_at: string | null;
  ended_at: string | null;
  primary_goal_title: string | null;
  dominant_defect: string | null;
  review_count: number;
  created_at: string;
}

// ── Input types ────────────────────────────────────────────────────────────

export interface DiagnosisUpsert {
  dimension: string;
  abandonar?: string | null;
  melhorar?: string | null;
  deus_pede?: string | null;
}

export interface CoreUpsert {
  dominant_defect?: string | null;
  virtudes?: string | null;
  spiritual_director_name?: string | null;
  other_devotions?: string | null;
}

export interface GoalCreate {
  is_primary: boolean;
  title: string;
  description?: string | null;
  display_order?: number;
  actions?: ActionCreate[];
}

export interface GoalUpdate {
  title?: string;
  description?: string | null;
  display_order?: number;
  is_primary?: boolean;
}

export interface ActionCreate {
  action: string;
  frequency?: string | null;
  context?: string | null;
}

export interface ActionUpdate {
  action?: string;
  frequency?: string | null;
  context?: string | null;
}

export interface SpiritualRoutineUpsert {
  prayer_type?: string | null;
  prayer_duration?: string | null;
  mass_frequency?: string | null;
  confession_frequency?: string | null;
  exam_of_conscience?: boolean | null;
  exam_time?: string | null;
  spiritual_reading?: string | null;
  spiritual_direction_frequency?: string | null;
  other_practices?: string | null;
}

export interface MonthlyReviewCreate {
  review_date: string;
  progress_reflection?: string | null;
  difficulties?: string | null;
  constancy_reflection?: string | null;
  decision: string;
  notes?: string | null;
  updated_goal_id?: string | null;
  updated_goal_title?: string | null;
  updated_goal_description?: string | null;
}

// ── API functions ──────────────────────────────────────────────────────────

export const lifePlanApi = {
  // Cycles
  getActiveCycle: () =>
    api.get<CycleOut | null>('/life-plan/me/active'),

  createCycle: (data: { realidade_vocacional?: string | null }) =>
    api.post<CycleOut>('/life-plan/cycles', data as Record<string, unknown>),

  getCycle: (cycleId: string) =>
    api.get<CycleOut>(`/life-plan/cycles/${cycleId}`),

  updateWizardProgress: (cycleId: string, wizardProgress: Record<string, unknown>) =>
    api.patch<CycleOut>(`/life-plan/cycles/${cycleId}/wizard-progress`, {
      wizard_progress: wizardProgress,
    }),

  activateCycle: (cycleId: string) =>
    api.post<CycleOut>(`/life-plan/cycles/${cycleId}/activate`),

  getHistory: () =>
    api.get<CycleSummaryOut[]>('/life-plan/history'),

  // Diagnoses
  upsertDiagnosis: (cycleId: string, data: DiagnosisUpsert) =>
    api.post<DiagnosisOut>(`/life-plan/cycles/${cycleId}/diagnoses`, data as Record<string, unknown>),

  // Core
  upsertCore: (cycleId: string, data: CoreUpsert) =>
    api.post<CoreOut>(`/life-plan/cycles/${cycleId}/core`, data as Record<string, unknown>),

  // Goals
  createGoal: (cycleId: string, data: GoalCreate) =>
    api.post<GoalOut>(`/life-plan/cycles/${cycleId}/goals`, data as Record<string, unknown>),

  updateGoal: (goalId: string, data: GoalUpdate) =>
    api.patch<GoalOut>(`/life-plan/goals/${goalId}`, data as Record<string, unknown>),

  deleteGoal: (goalId: string) =>
    api.delete<void>(`/life-plan/goals/${goalId}`),

  // Actions
  createAction: (goalId: string, data: ActionCreate) =>
    api.post<ActionOut>(`/life-plan/goals/${goalId}/actions`, data as Record<string, unknown>),

  updateAction: (actionId: string, data: ActionUpdate) =>
    api.patch<ActionOut>(`/life-plan/actions/${actionId}`, data as Record<string, unknown>),

  deleteAction: (actionId: string) =>
    api.delete<void>(`/life-plan/actions/${actionId}`),

  // Routine
  upsertRoutine: (cycleId: string, data: SpiritualRoutineUpsert) =>
    api.post<SpiritualRoutineOut>(`/life-plan/cycles/${cycleId}/routine`, data as Record<string, unknown>),

  // Reviews
  createReview: (cycleId: string, data: MonthlyReviewCreate) =>
    api.post<MonthlyReviewOut>(`/life-plan/cycles/${cycleId}/reviews`, data as Record<string, unknown>),

  getReviews: (cycleId: string) =>
    api.get<MonthlyReviewOut[]>(`/life-plan/cycles/${cycleId}/reviews`),
};

export default lifePlanApi;
