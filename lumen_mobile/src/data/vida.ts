/**
 * Dados do Módulo Projeto de Vida
 * =================================
 * Perguntas por dimensão e por realidade vocacional.
 * Baseado no método de formação espiritual da comunidade.
 */

export const DIMENSIONS = [
  { key: 'HUMANA', label: 'Dimensão Humana', icon: 'person-outline' },
  { key: 'ESPIRITUAL', label: 'Dimensão Espiritual', icon: 'flame-outline' },
  { key: 'COMUNITARIA', label: 'Dimensão Comunitária', icon: 'people-outline' },
  { key: 'INTELECTUAL', label: 'Dimensão Intelectual', icon: 'book-outline' },
  { key: 'APOSTOLICA', label: 'Dimensão Apostólica', icon: 'globe-outline' },
] as const;

export type DimensionKey = (typeof DIMENSIONS)[number]['key'];

export interface DiagnosisQuestions {
  abandonar: string;
  melhorar: string;
  deus_pede: string;
}

export const DIAGNOSIS_QUESTIONS: Record<DimensionKey, DiagnosisQuestions> = {
  HUMANA: {
    abandonar: 'O que devo abandonar na minha dimensão humana (vícios, atitudes, comportamentos)?',
    melhorar: 'O que devo melhorar na minha dimensão humana (virtudes, relacionamentos, saúde)?',
    deus_pede: 'O que Deus me pede na dimensão humana neste ciclo?',
  },
  ESPIRITUAL: {
    abandonar: 'O que devo abandonar na minha vida espiritual (tibieza, omissões, apegos)?',
    melhorar: 'O que devo melhorar na minha vida espiritual (oração, sacramentos, leitura)?',
    deus_pede: 'O que Deus me pede na dimensão espiritual neste ciclo?',
  },
  COMUNITARIA: {
    abandonar: 'O que devo abandonar na minha vida comunitária (individualismo, ausências, conflitos)?',
    melhorar: 'O que devo melhorar na minha vida comunitária (presença, serviço, relações)?',
    deus_pede: 'O que Deus me pede na dimensão comunitária neste ciclo?',
  },
  INTELECTUAL: {
    abandonar: 'O que devo abandonar na dimensão intelectual (preguiça, conteúdos nocivos)?',
    melhorar: 'O que devo melhorar na dimensão intelectual (estudo, formação, aprendizado)?',
    deus_pede: 'O que Deus me pede na dimensão intelectual neste ciclo?',
  },
  APOSTOLICA: {
    abandonar: 'O que devo abandonar na minha dimensão apostólica (omissão, comodismo)?',
    melhorar: 'O que devo melhorar na minha dimensão apostólica (evangelização, serviço, missão)?',
    deus_pede: 'O que Deus me pede na dimensão apostólica neste ciclo?',
  },
};

export const VOCATIONAL_REALITIES = [
  { key: 'SOLTEIRO', label: 'Solteiro(a)' },
  { key: 'NOIVO', label: 'Noivo(a)' },
  { key: 'CASADO', label: 'Casado(a)' },
  { key: 'CONSAGRADO', label: 'Consagrado(a) Filho(a) da Luz' },
  { key: 'SEMINARISTA', label: 'Seminarista' },
  { key: 'SACERDOTE', label: 'Sacerdote' },
  { key: 'RELIGIOSO', label: 'Religioso(a)' },
] as const;

export type VocationalRealityKey = (typeof VOCATIONAL_REALITIES)[number]['key'];

export const MASS_FREQUENCY_OPTIONS = [
  { key: 'DAILY', label: 'Diariamente' },
  { key: 'WEEKLY_MANY', label: 'Várias vezes por semana' },
  { key: 'WEEKLY', label: 'Semanalmente (domingo)' },
  { key: 'BI_WEEKLY', label: 'Quinzenalmente' },
  { key: 'MONTHLY', label: 'Mensalmente' },
] as const;

export const CONFESSION_FREQUENCY_OPTIONS = [
  { key: 'WEEKLY', label: 'Semanalmente' },
  { key: 'BI_WEEKLY', label: 'Quinzenalmente' },
  { key: 'MONTHLY', label: 'Mensalmente' },
  { key: 'OTHER', label: 'Outro' },
] as const;

export const REVIEW_DECISION_OPTIONS = [
  {
    key: 'CONTINUE',
    label: 'Continuar',
    description: 'Manter o plano atual sem alterações',
    color: '#059669',
  },
  {
    key: 'ADJUST_GOAL',
    label: 'Ajustar objetivo',
    description: 'Refinar um objetivo secundário',
    color: '#2563eb',
  },
  {
    key: 'CHANGE_PRIMARY_GOAL',
    label: 'Mudar objetivo principal',
    description: 'Substituir o objetivo principal',
    color: '#d97706',
  },
  {
    key: 'NEW_CYCLE',
    label: 'Novo ciclo',
    description: 'Encerrar este ciclo e iniciar um novo',
    color: '#7c3aed',
  },
] as const;

export type ReviewDecisionKey = (typeof REVIEW_DECISION_OPTIONS)[number]['key'];

export const STATUS_LABEL: Record<string, string> = {
  DRAFT: 'Rascunho',
  ACTIVE: 'Ativo',
  ARCHIVED: 'Arquivado',
};

export const STATUS_COLOR: Record<string, string> = {
  DRAFT: '#d97706',
  ACTIVE: '#059669',
  ARCHIVED: '#6b7280',
};

export const WIZARD_STEPS = [
  { key: 'vocacional', label: 'Realidade Vocacional', icon: 'person-circle-outline' },
  { key: 'diagnostico', label: 'Diagnóstico', icon: 'pulse-outline' },
  { key: 'sintese', label: 'Síntese & Defeito', icon: 'eye-outline' },
  { key: 'objetivo', label: 'Objetivo Principal', icon: 'flag-outline' },
  { key: 'meios', label: 'Meios', icon: 'build-outline' },
  { key: 'rotina', label: 'Rotina Espiritual', icon: 'calendar-outline' },
  { key: 'diretor', label: 'Diretor Espiritual', icon: 'person-outline' },
  { key: 'revisao', label: 'Confirmar', icon: 'checkmark-circle-outline' },
] as const;
