/**
 * Projeto de Vida — Tela Principal
 * ==================================
 * Exibe o ciclo ativo (ACTIVE/DRAFT) ou convida a criar um novo.
 */

import { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Alert,
} from 'react-native';
import { router, useFocusEffect, type Href } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import type { IoniconsName } from '@/types/icons';
import lifePlanApi, { type CycleOut } from '@/services/lifePlan';
import { DIMENSIONS, STATUS_COLOR, STATUS_LABEL } from '@/data/vida';

const colors = {
  primary: '#1A859B',
  primaryLight: '#E8F4F7',
  white: '#ffffff',
  gray: '#6b7280',
  lightGray: '#f3f4f6',
  dark: '#171717',
  success: '#059669',
  warning: '#d97706',
  border: '#e5e7eb',
};

export default function VidaScreen() {
  const [cycle, setCycle] = useState<CycleOut | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activating, setActivating] = useState(false);
  const [showActivateConfirm, setShowActivateConfirm] = useState(false);

  const fetchCycle = async () => {
    try {
      const result = await lifePlanApi.getActiveCycle();
      setCycle(result);
    } catch {
      setCycle(null);
    }
  };

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      fetchCycle().finally(() => setLoading(false));
    }, [])
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchCycle();
    setRefreshing(false);
  }, []);

  const handleNewCycle = async () => {
    try {
      const newCycle = await lifePlanApi.createCycle({});
      router.push(`/vida/wizard?cycleId=${newCycle.id}` as Href);
    } catch (err: any) {
      const msg = err?.response?.data?.detail?.message || 'Erro ao criar ciclo';
      Alert.alert('Erro', msg);
    }
  };

  const handleActivate = () => {
    if (!cycle) return;
    setShowActivateConfirm(true);
  };

  const confirmActivate = async () => {
    if (!cycle) return;
    setActivating(true);
    setShowActivateConfirm(false);
    try {
      const updated = await lifePlanApi.activateCycle(cycle.id);
      setCycle(updated);
    } catch (err: any) {
      const msg = err?.response?.data?.detail?.message || 'Erro ao ativar ciclo';
      Alert.alert('Erro', msg);
    } finally {
      setActivating(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (!cycle) {
    return (
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.emptyContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.primary]} />}
      >
        <View style={styles.emptyCard}>
          <View style={styles.emptyIconContainer}>
            <Ionicons name="compass-outline" size={64} color={colors.primary} />
          </View>
          <Text style={styles.emptyTitle}>Seu Projeto de Vida</Text>
          <Text style={styles.emptySubtitle}>
            O Projeto de Vida é um plano espiritual personalizado que orienta seu crescimento como pessoa e discípulo.
          </Text>
          <TouchableOpacity style={styles.primaryButton} onPress={handleNewCycle}>
            <Ionicons name="add-circle-outline" size={20} color={colors.white} />
            <Text style={styles.primaryButtonText}>Iniciar meu Projeto de Vida</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.secondaryButton} onPress={() => router.push('/vida/historico' as Href)}>
            <Ionicons name="time-outline" size={20} color={colors.primary} />
            <Text style={styles.secondaryButtonText}>Ver histórico</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    );
  }

  const primaryGoal = cycle.goals.find((g) => g.is_primary);
  const secondaryGoals = cycle.goals.filter((g) => !g.is_primary);
  const statusColor = STATUS_COLOR[cycle.status] || colors.gray;
  const statusLabel = STATUS_LABEL[cycle.status] || cycle.status;
  const diagnosedDimensions = cycle.diagnoses.length;
  const isComplete =
    cycle.diagnoses.length >= 5 &&
    cycle.core !== null &&
    primaryGoal !== undefined &&
    cycle.routine !== null;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.primary]} />}
    >
      {/* Status Header */}
      <View style={styles.statusHeader}>
        <View style={[styles.statusBadge, { backgroundColor: `${statusColor}20` }]}>
          <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
          <Text style={[styles.statusText, { color: statusColor }]}>{statusLabel}</Text>
        </View>
        {cycle.started_at && (
          <Text style={styles.startedAt}>
            Iniciado em {new Date(cycle.started_at).toLocaleDateString('pt-BR')}
          </Text>
        )}
      </View>

      {/* Wizard Continue Banner (DRAFT) */}
      {cycle.status === 'DRAFT' && (
        <TouchableOpacity
          style={styles.draftBanner}
          onPress={() => router.push(`/vida/wizard?cycleId=${cycle.id}` as Href)}
        >
          <View style={styles.draftBannerLeft}>
            <Ionicons name="create-outline" size={24} color={colors.warning} />
            <View style={styles.draftBannerText}>
              <Text style={styles.draftBannerTitle}>Plano em construção</Text>
              <Text style={styles.draftBannerSubtitle}>Toque para continuar o wizard</Text>
            </View>
          </View>
          <Ionicons name="chevron-forward" size={20} color={colors.warning} />
        </TouchableOpacity>
      )}

      {/* Activate Button */}
      {cycle.status === 'DRAFT' && isComplete && !showActivateConfirm && (
        <TouchableOpacity
          style={[styles.activateButton, activating && styles.buttonDisabled]}
          onPress={handleActivate}
          disabled={activating}
        >
          {activating ? (
            <ActivityIndicator size="small" color={colors.white} />
          ) : (
            <>
              <Ionicons name="rocket-outline" size={20} color={colors.white} />
              <Text style={styles.activateButtonText}>Ativar Projeto de Vida</Text>
            </>
          )}
        </TouchableOpacity>
      )}

      {/* Confirmação inline de ativação */}
      {showActivateConfirm && (
        <View style={styles.confirmCard}>
          <Ionicons name="rocket-outline" size={24} color={colors.success} />
          <Text style={styles.confirmTitle}>Ativar Projeto de Vida?</Text>
          <Text style={styles.confirmText}>
            Ao ativar, seu plano entra em vigor e você poderá fazer revisões mensais.
          </Text>
          <View style={styles.confirmButtons}>
            <TouchableOpacity
              style={styles.confirmCancelButton}
              onPress={() => setShowActivateConfirm(false)}
            >
              <Text style={styles.confirmCancelText}>Cancelar</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.confirmActivateButton} onPress={confirmActivate}>
              <Text style={styles.confirmActivateText}>Sim, ativar</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Vocational Reality */}
      {cycle.realidade_vocacional && (
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Ionicons name="person-circle-outline" size={20} color={colors.primary} />
            <Text style={styles.cardTitle}>Realidade Vocacional</Text>
          </View>
          <Text style={styles.cardValue}>{cycle.realidade_vocacional}</Text>
        </View>
      )}

      {/* Dominant Defect & Core */}
      {cycle.core && (
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Ionicons name="eye-outline" size={20} color={colors.primary} />
            <Text style={styles.cardTitle}>Núcleo do Plano</Text>
          </View>
          {cycle.core.dominant_defect && (
            <View style={styles.cardRow}>
              <Text style={styles.cardLabel}>Defeito dominante</Text>
              <Text style={styles.cardValue}>{cycle.core.dominant_defect}</Text>
            </View>
          )}
          {cycle.core.virtudes && (
            <View style={styles.cardRow}>
              <Text style={styles.cardLabel}>Virtudes a cultivar</Text>
              <Text style={styles.cardValue}>{cycle.core.virtudes}</Text>
            </View>
          )}
          {cycle.core.spiritual_director_name && (
            <View style={styles.cardRow}>
              <Text style={styles.cardLabel}>Diretor espiritual</Text>
              <Text style={styles.cardValue}>{cycle.core.spiritual_director_name}</Text>
            </View>
          )}
        </View>
      )}

      {/* Primary Goal */}
      {primaryGoal && (
        <View style={[styles.card, styles.primaryGoalCard]}>
          <View style={styles.cardHeader}>
            <Ionicons name="flag" size={20} color={colors.primary} />
            <Text style={styles.cardTitle}>Objetivo Principal</Text>
          </View>
          <Text style={styles.goalTitle}>{primaryGoal.title}</Text>
          {primaryGoal.description && (
            <Text style={styles.goalDescription}>{primaryGoal.description}</Text>
          )}
          {primaryGoal.actions.length > 0 && (
            <View style={styles.actionsList}>
              <Text style={styles.actionsLabel}>Meios:</Text>
              {primaryGoal.actions.map((action) => (
                <View key={action.id} style={styles.actionItem}>
                  <View style={styles.actionDot} />
                  <Text style={styles.actionText}>{action.action}</Text>
                </View>
              ))}
            </View>
          )}
        </View>
      )}

      {/* Secondary Goals */}
      {secondaryGoals.length > 0 && (
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Ionicons name="list-outline" size={20} color={colors.primary} />
            <Text style={styles.cardTitle}>Objetivos Secundários</Text>
          </View>
          {secondaryGoals.map((goal, idx) => (
            <View key={goal.id} style={[styles.secondaryGoal, idx < secondaryGoals.length - 1 && styles.goalDivider]}>
              <Text style={styles.goalTitle}>{goal.title}</Text>
              {goal.description && <Text style={styles.goalDescription}>{goal.description}</Text>}
            </View>
          ))}
        </View>
      )}

      {/* Diagnoses Progress */}
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Ionicons name="pulse-outline" size={20} color={colors.primary} />
          <Text style={styles.cardTitle}>Diagnóstico por Dimensão</Text>
        </View>
        {DIMENSIONS.map((dim) => {
          const diagnosed = cycle.diagnoses.find((d) => d.dimension === dim.key);
          return (
            <View key={dim.key} style={styles.dimensionRow}>
              <Ionicons
                name={dim.icon as IoniconsName}
                size={16}
                color={diagnosed ? colors.success : colors.gray}
              />
              <Text style={[styles.dimensionLabel, diagnosed && styles.dimensionDone]}>
                {dim.label}
              </Text>
              {diagnosed ? (
                <Ionicons name="checkmark-circle" size={16} color={colors.success} />
              ) : (
                <View style={styles.dimensionPending} />
              )}
            </View>
          );
        })}
        <Text style={styles.progressText}>{diagnosedDimensions}/5 dimensões</Text>
      </View>

      {/* Spiritual Routine */}
      {cycle.routine && (
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Ionicons name="calendar-outline" size={20} color={colors.primary} />
            <Text style={styles.cardTitle}>Rotina Espiritual</Text>
          </View>
          {cycle.routine.prayer_type && (
            <View style={styles.cardRow}>
              <Text style={styles.cardLabel}>Tipos de oração</Text>
              <Text style={styles.cardValue}>{cycle.routine.prayer_type}</Text>
            </View>
          )}
          {cycle.routine.mass_frequency && (
            <View style={styles.cardRow}>
              <Text style={styles.cardLabel}>Missa</Text>
              <Text style={styles.cardValue}>{cycle.routine.mass_frequency}</Text>
            </View>
          )}
          {cycle.routine.confession_frequency && (
            <View style={styles.cardRow}>
              <Text style={styles.cardLabel}>Confissão</Text>
              <Text style={styles.cardValue}>{cycle.routine.confession_frequency}</Text>
            </View>
          )}
        </View>
      )}

      {/* Monthly Reviews */}
      {cycle.status === 'ACTIVE' && (
        <TouchableOpacity
          style={styles.reviewButton}
          onPress={() => router.push(`/vida/revisao?cycleId=${cycle.id}` as Href)}
        >
          <Ionicons name="clipboard-outline" size={20} color={colors.white} />
          <Text style={styles.reviewButtonText}>Fazer Revisão Mensal</Text>
        </TouchableOpacity>
      )}

      {cycle.monthly_reviews.length > 0 && (
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Ionicons name="bar-chart-outline" size={20} color={colors.primary} />
            <Text style={styles.cardTitle}>
              Revisões ({cycle.monthly_reviews.length})
            </Text>
          </View>
          {cycle.monthly_reviews.slice(0, 3).map((review) => (
            <View key={review.id} style={styles.reviewItem}>
              <Text style={styles.reviewDate}>
                {new Date(review.review_date).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}
              </Text>
              <View style={[styles.decisionBadge, { backgroundColor: '#e0f2fe' }]}>
                <Text style={[styles.decisionText, { color: '#0369a1' }]}>{review.decision}</Text>
              </View>
            </View>
          ))}
        </View>
      )}

      {/* History Link */}
      <TouchableOpacity
        style={styles.historyLink}
        onPress={() => router.push('/vida/historico' as Href)}
      >
        <Ionicons name="time-outline" size={16} color={colors.primary} />
        <Text style={styles.historyLinkText}>Ver histórico de ciclos</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.lightGray },
  content: { padding: 16, paddingBottom: 40 },
  emptyContent: { flex: 1, padding: 16, justifyContent: 'center' },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  emptyCard: {
    backgroundColor: colors.white,
    borderRadius: 16,
    padding: 32,
    alignItems: 'center',
  },
  emptyIconContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  emptyTitle: { fontSize: 22, fontWeight: '700', color: colors.dark, marginBottom: 12, textAlign: 'center' },
  emptySubtitle: { fontSize: 15, color: colors.gray, textAlign: 'center', lineHeight: 22, marginBottom: 28 },

  primaryButton: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 24,
    gap: 8,
    marginBottom: 12,
    width: '100%',
    justifyContent: 'center',
  },
  primaryButtonText: { color: colors.white, fontSize: 16, fontWeight: '600' },

  secondaryButton: {
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 24,
    gap: 8,
    width: '100%',
    justifyContent: 'center',
  },
  secondaryButtonText: { color: colors.primary, fontSize: 15, fontWeight: '500' },

  statusHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  statusText: { fontSize: 13, fontWeight: '600' },
  startedAt: { fontSize: 12, color: colors.gray },

  draftBanner: {
    backgroundColor: '#fffbeb',
    borderRadius: 12,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#fde68a',
  },
  draftBannerLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  draftBannerText: { flex: 1 },
  draftBannerTitle: { fontSize: 14, fontWeight: '600', color: colors.warning },
  draftBannerSubtitle: { fontSize: 12, color: colors.gray, marginTop: 2 },

  activateButton: {
    backgroundColor: colors.success,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    gap: 8,
    marginBottom: 16,
  },
  activateButtonText: { color: colors.white, fontSize: 16, fontWeight: '600' },
  buttonDisabled: { opacity: 0.6 },

  confirmCard: {
    backgroundColor: colors.white,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#a7f3d0',
    padding: 20,
    marginBottom: 16,
    alignItems: 'center',
    gap: 8,
  },
  confirmTitle: { fontSize: 17, fontWeight: '700', color: colors.dark, marginTop: 4 },
  confirmText: { fontSize: 14, color: colors.gray, textAlign: 'center', lineHeight: 20 },
  confirmButtons: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 8,
    width: '100%',
  },
  confirmCancelButton: {
    flex: 1,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: colors.border,
    paddingVertical: 12,
    alignItems: 'center',
  },
  confirmCancelText: { fontSize: 15, color: colors.gray, fontWeight: '500' },
  confirmActivateButton: {
    flex: 1,
    borderRadius: 10,
    backgroundColor: colors.success,
    paddingVertical: 12,
    alignItems: 'center',
  },
  confirmActivateText: { fontSize: 15, color: colors.white, fontWeight: '600' },

  card: {
    backgroundColor: colors.white,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  cardTitle: { fontSize: 15, fontWeight: '600', color: colors.dark },
  cardRow: { marginBottom: 8 },
  cardLabel: { fontSize: 12, color: colors.gray, marginBottom: 2 },
  cardValue: { fontSize: 14, color: colors.dark },

  primaryGoalCard: { borderLeftWidth: 4, borderLeftColor: colors.primary },
  goalTitle: { fontSize: 16, fontWeight: '600', color: colors.dark, marginBottom: 4 },
  goalDescription: { fontSize: 14, color: colors.gray, lineHeight: 20 },

  actionsList: { marginTop: 10 },
  actionsLabel: { fontSize: 12, fontWeight: '600', color: colors.gray, marginBottom: 6, textTransform: 'uppercase' },
  actionItem: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginBottom: 4 },
  actionDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.primary, marginTop: 6 },
  actionText: { fontSize: 14, color: colors.dark, flex: 1 },

  secondaryGoal: { paddingVertical: 8 },
  goalDivider: { borderBottomWidth: 1, borderBottomColor: colors.border },

  dimensionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: colors.lightGray,
  },
  dimensionLabel: { flex: 1, fontSize: 14, color: colors.gray },
  dimensionDone: { color: colors.dark },
  dimensionPending: { width: 16, height: 16, borderRadius: 8, borderWidth: 1.5, borderColor: colors.gray },
  progressText: { fontSize: 12, color: colors.gray, marginTop: 8, textAlign: 'right' },

  reviewButton: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    gap: 8,
    marginBottom: 12,
  },
  reviewButtonText: { color: colors.white, fontSize: 16, fontWeight: '600' },

  reviewItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.lightGray,
  },
  reviewDate: { fontSize: 14, color: colors.dark, textTransform: 'capitalize' },
  decisionBadge: { borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 },
  decisionText: { fontSize: 12, fontWeight: '600' },

  historyLink: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 16,
  },
  historyLinkText: { color: colors.primary, fontSize: 14, fontWeight: '500' },
});
