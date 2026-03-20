/**
 * Admin Dashboard Screen
 * ======================
 * Métricas de governança — usuários, perfis, memberships, convites.
 * Acesso: ADMIN, DEV, ANALISTA.
 */

import { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import { router, Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import api from '@/services/api';
import { useAuthStore } from '@/stores';

// -------------------------------------------------------------------------
// Colors
// -------------------------------------------------------------------------
const colors = {
  admin: '#7c3aed',
  primary: '#1A859B',
  white: '#ffffff',
  gray: '#6b7280',
  lightGray: '#E8E8E8',
  background: '#f3f4f6',
  border: '#e5e7eb',
  success: '#22c55e',
  warning: '#f59e0b',
  error: '#ef4444',
  text: '#171717',
  textMuted: '#6b7280',
  barBg: '#e5e7eb',
};

// -------------------------------------------------------------------------
// Types
// -------------------------------------------------------------------------
interface AgeRange {
  range: string;
  count: number;
}

interface LabelCount {
  label: string;
  count: number;
}

interface GeoItem {
  city?: string;
  state?: string;
  count: number;
}

interface UnitTypeCount {
  type: string;
  label: string;
  count: number;
}

interface TopMinistry {
  name: string;
  member_count: number;
}

interface DashboardData {
  users: {
    total: number;
    complete_profiles: number;
    incomplete_profiles: number;
    new_last_7d: number;
    new_last_30d: number;
  };
  age_ranges: AgeRange[];
  geography: {
    by_city: GeoItem[];
    by_state: GeoItem[];
  };
  profile_breakdown: {
    by_life_state: LabelCount[];
    by_marital_status: LabelCount[];
    by_vocational_reality: LabelCount[];
    with_vocational_accompaniment: number;
    without_vocational_accompaniment: number;
    interested_in_ministry: number;
    from_mission: number;
  };
  memberships: {
    total_active: number;
    by_unit_type: UnitTypeCount[];
  };
  invites: {
    total: number;
    accepted: number;
    pending: number;
    declined: number;
    acceptance_rate: number;
  };
  top_ministries: TopMinistry[];
}

// -------------------------------------------------------------------------
// Helper components
// -------------------------------------------------------------------------

function SectionHeader({ title }: { title: string }) {
  return <Text style={styles.sectionTitle}>{title}</Text>;
}

function MetricCard({
  label,
  value,
  color,
}: {
  label: string;
  value: number | string;
  color?: string;
}) {
  return (
    <View style={styles.metricCard}>
      <Text style={[styles.metricValue, color ? { color } : {}]}>{value}</Text>
      <Text style={styles.metricLabel}>{label}</Text>
    </View>
  );
}

function BarRow({
  label,
  count,
  total,
}: {
  label: string;
  count: number;
  total: number;
}) {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0;
  return (
    <View style={styles.barRow}>
      <Text style={styles.barLabel}>{label}</Text>
      <View style={styles.barTrack}>
        <View style={[styles.barFill, { width: `${pct}%` }]} />
      </View>
      <Text style={styles.barCount}>
        {count} ({pct}%)
      </Text>
    </View>
  );
}

function RankedRow({
  rank,
  label,
  count,
}: {
  rank: number;
  label: string;
  count: number;
}) {
  return (
    <View style={styles.rankedRow}>
      <Text style={styles.rankedIndex}>{rank}</Text>
      <Text style={styles.rankedLabel}>{label}</Text>
      <Text style={styles.rankedCount}>{count}</Text>
    </View>
  );
}

// -------------------------------------------------------------------------
// Main screen
// -------------------------------------------------------------------------

export default function DashboardScreen() {
  const { user, isLoading: authLoading } = useAuthStore();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const allowedRoles = ['ADMIN', 'DEV', 'ANALISTA'];
  const hasAccess =
    user?.global_roles?.some((r) => allowedRoles.includes(r)) ?? false;

  const fetchData = async () => {
    try {
      setError(null);
      const response = await api.get('/admin/dashboard');
      setData(response.data);
    } catch (err: any) {
      const msg =
        err.response?.data?.detail?.message ||
        'Erro ao carregar dados do dashboard';
      setError(msg);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    if (authLoading) return;   // aguarda auth inicializar
    if (hasAccess) {
      fetchData();
    } else {
      setLoading(false);       // sem permissão → para o spinner
    }
  }, [authLoading, hasAccess]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchData();
  };

  // --- Auth ou dados carregando ---
  if (authLoading || loading) {
    return (
      <>
        <Stack.Screen
          options={{
            title: 'Dashboard',
            headerStyle: { backgroundColor: colors.admin },
            headerTintColor: colors.white,
          }}
        />
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.admin} />
          <Text style={styles.loadingText}>Carregando...</Text>
        </View>
      </>
    );
  }

  // --- No permission ---
  if (!hasAccess) {
    return (
      <>
        <Stack.Screen
          options={{
            title: 'Dashboard',
            headerStyle: { backgroundColor: colors.admin },
            headerTintColor: colors.white,
          }}
        />
        <View style={styles.centered}>
          <Ionicons name="lock-closed-outline" size={48} color={colors.gray} />
          <Text style={styles.errorTitle}>Acesso Negado</Text>
          <Text style={styles.errorText}>
            Esta área é restrita a administradores e analistas.
          </Text>
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
            <Text style={styles.backBtnText}>Voltar</Text>
          </TouchableOpacity>
        </View>
      </>
    );
  }

  // --- Error ---
  if (error || !data) {
    return (
      <>
        <Stack.Screen
          options={{
            title: 'Dashboard',
            headerStyle: { backgroundColor: colors.admin },
            headerTintColor: colors.white,
          }}
        />
        <View style={styles.centered}>
          <Ionicons name="alert-circle-outline" size={48} color={colors.error} />
          <Text style={styles.errorTitle}>Erro ao carregar</Text>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity
            style={styles.backBtn}
            onPress={() => {
              setLoading(true);
              fetchData();
            }}
          >
            <Text style={styles.backBtnText}>Tentar novamente</Text>
          </TouchableOpacity>
        </View>
      </>
    );
  }

  const totalUsers = data.users.total || 1; // avoid div/0 in bars
  const totalAgeCount =
    data.age_ranges.reduce((s, r) => s + r.count, 0) || 1;

  return (
    <>
      <Stack.Screen
        options={{
          title: 'Dashboard',
          headerStyle: { backgroundColor: colors.admin },
          headerTintColor: colors.white,
        }}
      />
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[colors.admin]}
            tintColor={colors.admin}
          />
        }
      >
        {/* Header */}
        <View style={styles.header}>
          <Ionicons name="bar-chart" size={32} color={colors.white} />
          <Text style={styles.headerTitle}>Dashboard</Text>
          <Text style={styles.headerSubtitle}>Visão geral do aplicativo</Text>
        </View>

        {/* ---- Usuários ---- */}
        <SectionHeader title="Usuários" />
        <View style={styles.grid2}>
          <MetricCard label="Total" value={data.users.total} color={colors.admin} />
          <MetricCard
            label="Perfis Completos"
            value={data.users.complete_profiles}
            color={colors.success}
          />
          <MetricCard label="Novos (7d)" value={data.users.new_last_7d} />
          <MetricCard label="Novos (30d)" value={data.users.new_last_30d} />
        </View>

        {/* ---- Faixas Etárias ---- */}
        <SectionHeader title="Faixas Etárias" />
        <View style={styles.card}>
          {data.age_ranges.map((r) => (
            <BarRow
              key={r.range}
              label={r.range}
              count={r.count}
              total={totalAgeCount}
            />
          ))}
        </View>

        {/* ---- Geografia ---- */}
        <SectionHeader title="Geografia" />
        <View style={styles.card}>
          <Text style={styles.subSectionTitle}>Por Cidade</Text>
          {data.geography.by_city.length === 0 ? (
            <Text style={styles.emptyText}>Sem dados</Text>
          ) : (
            data.geography.by_city.map((item, i) => (
              <RankedRow
                key={item.city}
                rank={i + 1}
                label={item.city ?? '-'}
                count={item.count}
              />
            ))
          )}
        </View>
        <View style={[styles.card, { marginTop: 8 }]}>
          <Text style={styles.subSectionTitle}>Por Estado</Text>
          {data.geography.by_state.length === 0 ? (
            <Text style={styles.emptyText}>Sem dados</Text>
          ) : (
            data.geography.by_state.map((item, i) => (
              <RankedRow
                key={item.state}
                rank={i + 1}
                label={item.state ?? '-'}
                count={item.count}
              />
            ))
          )}
        </View>

        {/* ---- Perfil Vocacional ---- */}
        <SectionHeader title="Perfil Vocacional" />
        <View style={styles.card}>
          <Text style={styles.subSectionTitle}>Estado de Vida</Text>
          {data.profile_breakdown.by_life_state.length === 0 ? (
            <Text style={styles.emptyText}>Sem dados</Text>
          ) : (
            data.profile_breakdown.by_life_state.map((item) => {
              const total = data.profile_breakdown.by_life_state.reduce(
                (s, r) => s + r.count,
                0
              ) || 1;
              const pct = Math.round((item.count / total) * 100);
              return (
                <View key={item.label} style={styles.labelRow}>
                  <Text style={styles.labelText}>{item.label}</Text>
                  <Text style={styles.labelCount}>
                    {item.count} ({pct}%)
                  </Text>
                </View>
              );
            })
          )}
        </View>
        <View style={[styles.card, { marginTop: 8 }]}>
          <Text style={styles.subSectionTitle}>Realidade Vocacional</Text>
          {data.profile_breakdown.by_vocational_reality.length === 0 ? (
            <Text style={styles.emptyText}>Sem dados</Text>
          ) : (
            data.profile_breakdown.by_vocational_reality.map((item) => {
              const total = data.profile_breakdown.by_vocational_reality.reduce(
                (s, r) => s + r.count,
                0
              ) || 1;
              const pct = Math.round((item.count / total) * 100);
              return (
                <View key={item.label} style={styles.labelRow}>
                  <Text style={styles.labelText}>{item.label}</Text>
                  <Text style={styles.labelCount}>
                    {item.count} ({pct}%)
                  </Text>
                </View>
              );
            })
          )}
        </View>
        <View style={[styles.card, { marginTop: 8 }]}>
          <Text style={styles.subSectionTitle}>Estado Civil</Text>
          {data.profile_breakdown.by_marital_status.length === 0 ? (
            <Text style={styles.emptyText}>Sem dados</Text>
          ) : (
            data.profile_breakdown.by_marital_status.map((item) => {
              const total = data.profile_breakdown.by_marital_status.reduce(
                (s, r) => s + r.count,
                0
              ) || 1;
              const pct = Math.round((item.count / total) * 100);
              return (
                <View key={item.label} style={styles.labelRow}>
                  <Text style={styles.labelText}>{item.label}</Text>
                  <Text style={styles.labelCount}>
                    {item.count} ({pct}%)
                  </Text>
                </View>
              );
            })
          )}
        </View>

        {/* ---- Engajamento ---- */}
        <SectionHeader title="Engajamento" />
        <View style={styles.grid3}>
          <View style={styles.engCard}>
            <Ionicons name="person-outline" size={22} color={colors.primary} />
            <Text style={styles.engValue}>
              {data.profile_breakdown.with_vocational_accompaniment}
            </Text>
            <Text style={styles.engLabel}>Com Acomp. Vocacional</Text>
          </View>
          <View style={styles.engCard}>
            <Ionicons name="star-outline" size={22} color={colors.warning} />
            <Text style={styles.engValue}>
              {data.profile_breakdown.interested_in_ministry}
            </Text>
            <Text style={styles.engLabel}>Interesse em Ministério</Text>
          </View>
          <View style={styles.engCard}>
            <Ionicons name="globe-outline" size={22} color={colors.success} />
            <Text style={styles.engValue}>
              {data.profile_breakdown.from_mission}
            </Text>
            <Text style={styles.engLabel}>De Missão</Text>
          </View>
        </View>

        {/* ---- Memberships ---- */}
        <SectionHeader title="Memberships" />
        <View style={styles.card}>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Total Ativos</Text>
            <Text style={styles.totalValue}>{data.memberships.total_active}</Text>
          </View>
          {data.memberships.by_unit_type.map((item) => (
            <BarRow
              key={item.type}
              label={item.label}
              count={item.count}
              total={data.memberships.total_active || 1}
            />
          ))}
        </View>

        {/* ---- Convites ---- */}
        <SectionHeader title="Convites" />
        <View style={styles.card}>
          <View style={styles.inviteGrid}>
            <View style={styles.inviteItem}>
              <Text style={styles.inviteValue}>{data.invites.total}</Text>
              <Text style={styles.inviteLabel}>Total</Text>
            </View>
            <View style={styles.inviteItem}>
              <Text style={[styles.inviteValue, { color: colors.success }]}>
                {data.invites.accepted}
              </Text>
              <Text style={styles.inviteLabel}>Aceitos</Text>
            </View>
            <View style={styles.inviteItem}>
              <Text style={[styles.inviteValue, { color: colors.warning }]}>
                {data.invites.pending}
              </Text>
              <Text style={styles.inviteLabel}>Pendentes</Text>
            </View>
            <View style={styles.inviteItem}>
              <Text style={[styles.inviteValue, { color: colors.error }]}>
                {data.invites.declined}
              </Text>
              <Text style={styles.inviteLabel}>Recusados</Text>
            </View>
          </View>
          <View style={styles.acceptanceRow}>
            <Text style={styles.acceptanceLabel}>
              Taxa de aceitação: {data.invites.acceptance_rate}%
            </Text>
            <View style={styles.barTrack}>
              <View
                style={[
                  styles.barFill,
                  {
                    width: `${Math.min(data.invites.acceptance_rate, 100)}%`,
                    backgroundColor: colors.success,
                  },
                ]}
              />
            </View>
          </View>
        </View>

        {/* ---- Top Ministérios ---- */}
        <SectionHeader title="Top Ministérios" />
        <View style={styles.card}>
          {data.top_ministries.length === 0 ? (
            <Text style={styles.emptyText}>Sem dados</Text>
          ) : (
            data.top_ministries.map((item, i) => (
              <RankedRow
                key={item.name}
                rank={i + 1}
                label={item.name}
                count={item.member_count}
              />
            ))
          )}
        </View>

        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <Text style={styles.backButtonText}>Voltar</Text>
        </TouchableOpacity>
      </ScrollView>
    </>
  );
}

// -------------------------------------------------------------------------
// Styles
// -------------------------------------------------------------------------
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: 16,
    paddingBottom: 40,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    backgroundColor: colors.background,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: colors.gray,
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
    marginTop: 16,
    marginBottom: 8,
  },
  errorText: {
    fontSize: 14,
    color: colors.textMuted,
    textAlign: 'center',
    marginBottom: 24,
  },
  backBtn: {
    paddingVertical: 12,
    paddingHorizontal: 32,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: colors.admin,
  },
  backBtnText: {
    color: colors.admin,
    fontSize: 15,
    fontWeight: '600',
  },
  // Header
  header: {
    backgroundColor: colors.admin,
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    marginBottom: 20,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.white,
    marginTop: 10,
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
  },
  // Sections
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
    marginTop: 16,
    marginBottom: 8,
  },
  subSectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textMuted,
    marginBottom: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  // Cards
  card: {
    backgroundColor: colors.white,
    borderRadius: 12,
    padding: 16,
  },
  // 2-column grid for metric cards
  grid2: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  metricCard: {
    backgroundColor: colors.white,
    borderRadius: 12,
    padding: 16,
    width: '48%',
    alignItems: 'center',
  },
  metricValue: {
    fontSize: 28,
    fontWeight: '800',
    color: colors.text,
    marginBottom: 4,
  },
  metricLabel: {
    fontSize: 12,
    color: colors.textMuted,
    textAlign: 'center',
  },
  // Bar rows
  barRow: {
    marginBottom: 10,
  },
  barLabel: {
    fontSize: 13,
    color: colors.text,
    marginBottom: 4,
  },
  barTrack: {
    height: 8,
    backgroundColor: colors.barBg,
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 2,
  },
  barFill: {
    height: 8,
    backgroundColor: colors.admin,
    borderRadius: 4,
  },
  barCount: {
    fontSize: 11,
    color: colors.textMuted,
  },
  // Ranked list rows
  rankedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 7,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  rankedIndex: {
    width: 24,
    fontSize: 13,
    fontWeight: '700',
    color: colors.admin,
  },
  rankedLabel: {
    flex: 1,
    fontSize: 13,
    color: colors.text,
  },
  rankedCount: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textMuted,
  },
  // Label + count rows (catalog breakdown)
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  labelText: {
    flex: 1,
    fontSize: 13,
    color: colors.text,
  },
  labelCount: {
    fontSize: 13,
    color: colors.textMuted,
    fontWeight: '500',
  },
  // Engagement 3-column grid
  grid3: {
    flexDirection: 'row',
    gap: 8,
  },
  engCard: {
    flex: 1,
    backgroundColor: colors.white,
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
  },
  engValue: {
    fontSize: 22,
    fontWeight: '800',
    color: colors.text,
    marginVertical: 6,
  },
  engLabel: {
    fontSize: 11,
    color: colors.textMuted,
    textAlign: 'center',
  },
  // Totals
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  totalLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },
  totalValue: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.admin,
  },
  // Invites
  inviteGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  inviteItem: {
    alignItems: 'center',
  },
  inviteValue: {
    fontSize: 22,
    fontWeight: '800',
    color: colors.text,
    marginBottom: 2,
  },
  inviteLabel: {
    fontSize: 11,
    color: colors.textMuted,
  },
  acceptanceRow: {
    gap: 6,
  },
  acceptanceLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 4,
  },
  emptyText: {
    fontSize: 13,
    color: colors.textMuted,
    fontStyle: 'italic',
    textAlign: 'center',
    paddingVertical: 8,
  },
  // Back button
  backButton: {
    marginTop: 24,
    padding: 16,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: colors.admin,
    alignItems: 'center',
  },
  backButtonText: {
    color: colors.admin,
    fontSize: 16,
    fontWeight: '600',
  },
});
