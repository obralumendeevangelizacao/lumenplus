/**
 * Projeto de Vida — Histórico
 * ============================
 * Lista todos os ciclos do usuário (DRAFT, ACTIVE, ARCHIVED).
 */

import { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { router, useFocusEffect, type Href } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import lifePlanApi, { type CycleSummaryOut } from '@/services/lifePlan';
import { STATUS_COLOR, STATUS_LABEL } from '@/data/vida';

const colors = {
  primary: '#1A859B',
  primaryLight: '#E8F4F7',
  white: '#ffffff',
  gray: '#6b7280',
  lightGray: '#f3f4f6',
  dark: '#171717',
  border: '#e5e7eb',
};

export default function HistoricoScreen() {
  const [cycles, setCycles] = useState<CycleSummaryOut[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchHistory = async () => {
    try {
      const result = await lifePlanApi.getHistory();
      setCycles(result);
    } catch {
      setCycles([]);
    }
  };

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      fetchHistory().finally(() => setLoading(false));
    }, [])
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchHistory();
    setRefreshing(false);
  }, []);

  const formatDateRange = (cycle: CycleSummaryOut) => {
    const start = cycle.started_at
      ? new Date(cycle.started_at).toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' })
      : 'Não iniciado';
    const end = cycle.ended_at
      ? new Date(cycle.ended_at).toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' })
      : cycle.status === 'ACTIVE'
      ? 'Em andamento'
      : '—';
    return `${start} → ${end}`;
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (cycles.length === 0) {
    return (
      <View style={styles.centered}>
        <Ionicons name="time-outline" size={48} color={colors.gray} />
        <Text style={styles.emptyTitle}>Nenhum ciclo encontrado</Text>
        <Text style={styles.emptySubtitle}>Comece seu primeiro Projeto de Vida</Text>
        <TouchableOpacity style={styles.startButton} onPress={() => router.replace('/vida' as Href)}>
          <Text style={styles.startButtonText}>Ir para Projeto de Vida</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <FlatList
      style={styles.container}
      contentContainerStyle={styles.content}
      data={cycles}
      keyExtractor={(item) => item.id}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.primary]} />}
      ListHeaderComponent={
        <Text style={styles.headerTitle}>
          {cycles.length} ciclo{cycles.length !== 1 ? 's' : ''} registrado{cycles.length !== 1 ? 's' : ''}
        </Text>
      }
      renderItem={({ item }) => {
        const statusColor = STATUS_COLOR[item.status] || colors.gray;
        const statusLabel = STATUS_LABEL[item.status] || item.status;

        return (
          <TouchableOpacity
            style={styles.cycleCard}
            onPress={() => router.push(`/vida/index?cycleId=${item.id}` as Href)}
            activeOpacity={0.8}
          >
            {/* Status badge */}
            <View style={styles.cardTop}>
              <View style={[styles.statusBadge, { backgroundColor: `${statusColor}20` }]}>
                <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
                <Text style={[styles.statusText, { color: statusColor }]}>{statusLabel}</Text>
              </View>
              <Text style={styles.dateRange}>{formatDateRange(item)}</Text>
            </View>

            {/* Primary Goal */}
            {item.primary_goal_title ? (
              <View style={styles.goalSection}>
                <Ionicons name="flag" size={14} color={colors.primary} />
                <Text style={styles.goalTitle} numberOfLines={2}>
                  {item.primary_goal_title}
                </Text>
              </View>
            ) : (
              <Text style={styles.noGoal}>Objetivo principal não definido</Text>
            )}

            {/* Dominant Defect */}
            {item.dominant_defect && (
              <View style={styles.defectSection}>
                <Ionicons name="eye-outline" size={14} color={colors.gray} />
                <Text style={styles.defectText} numberOfLines={1}>
                  {item.dominant_defect}
                </Text>
              </View>
            )}

            {/* Stats */}
            <View style={styles.statsRow}>
              {item.realidade_vocacional && (
                <View style={styles.statChip}>
                  <Ionicons name="person-outline" size={12} color={colors.gray} />
                  <Text style={styles.statText}>{item.realidade_vocacional}</Text>
                </View>
              )}
              <View style={styles.statChip}>
                <Ionicons name="clipboard-outline" size={12} color={colors.gray} />
                <Text style={styles.statText}>{item.review_count} revisão{item.review_count !== 1 ? 'ões' : ''}</Text>
              </View>
            </View>

            <Ionicons name="chevron-forward" size={16} color={colors.gray} style={styles.chevron} />
          </TouchableOpacity>
        );
      }}
    />
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.lightGray },
  content: { padding: 16, paddingBottom: 32 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },

  headerTitle: { fontSize: 13, color: colors.gray, marginBottom: 12 },

  emptyTitle: { fontSize: 18, fontWeight: '600', color: colors.dark, marginTop: 12 },
  emptySubtitle: { fontSize: 14, color: colors.gray, marginTop: 4, marginBottom: 20 },
  startButton: {
    backgroundColor: colors.primary,
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 24,
  },
  startButtonText: { color: colors.white, fontSize: 15, fontWeight: '600' },

  cycleCard: {
    backgroundColor: colors.white,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusDot: { width: 7, height: 7, borderRadius: 3.5 },
  statusText: { fontSize: 12, fontWeight: '600' },
  dateRange: { fontSize: 12, color: colors.gray },

  goalSection: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    marginBottom: 6,
  },
  goalTitle: { flex: 1, fontSize: 15, fontWeight: '600', color: colors.dark, lineHeight: 20 },
  noGoal: { fontSize: 14, color: colors.gray, fontStyle: 'italic', marginBottom: 6 },

  defectSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 10,
  },
  defectText: { fontSize: 13, color: colors.gray, flex: 1 },

  statsRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  statChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.lightGray,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  statText: { fontSize: 12, color: colors.gray },

  chevron: { position: 'absolute', right: 14, top: '50%' },
});
