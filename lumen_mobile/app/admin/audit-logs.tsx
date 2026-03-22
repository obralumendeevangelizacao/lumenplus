/**
 * Audit Logs Screen
 * =================
 * Lista todos os eventos de auditoria do sistema.
 * Acesso restrito a ADMIN e DEV (backend valida via require_admin_or_analista).
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
  TextInput,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import type { IoniconsName } from '@/types/icons';
import { api } from '@/services/api';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface AuditLogItem {
  id: string;
  action: string;
  actor_name: string | null;
  entity_type: string | null;
  entity_id: string | null;
  extra_data: Record<string, any> | null;
  created_at: string;
}

interface AuditLogsResponse {
  total: number;
  page: number;
  page_size: number;
  items: AuditLogItem[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const ACTION_META: Record<string, { label: string; color: string; icon: string }> = {
  member_removed:  { label: 'Membro removido',   color: '#dc2626', icon: 'person-remove-outline' },
  member_invited:  { label: 'Convite enviado',    color: '#059669', icon: 'person-add-outline'    },
  role_updated:    { label: 'Cargo alterado',     color: '#7c3aed', icon: 'swap-horizontal-outline'},
  invite_accepted: { label: 'Convite aceito',     color: '#0891b2', icon: 'checkmark-circle-outline'},
  invite_declined: { label: 'Convite recusado',   color: '#d97706', icon: 'close-circle-outline'  },
};

function getActionMeta(action: string) {
  return ACTION_META[action] ?? { label: action, color: '#6b7280', icon: 'document-text-outline' };
}

function formatDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function buildExtraSummary(extra: Record<string, any> | null): string {
  if (!extra) return '';
  const parts: string[] = [];
  if (extra.removed_role)          parts.push(`Cargo: ${extra.removed_role}`);
  if (extra.new_role)              parts.push(`Novo cargo: ${extra.new_role}`);
  if (extra.old_role)              parts.push(`Cargo anterior: ${extra.old_role}`);
  if (extra.is_self_removal)       parts.push('Auto-remoção');
  if (extra.removed_by_parent_coord) parts.push('Por coord. pai');
  return parts.join(' · ');
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const PAGE_SIZE = 25;

export default function AuditLogsScreen() {
  const [items, setItems]           = useState<AuditLogItem[]>([]);
  const [total, setTotal]           = useState(0);
  const [page, setPage]             = useState(1);
  const [loading, setLoading]       = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError]           = useState<string | null>(null);
  const [filterAction, setFilterAction] = useState('');

  const fetchPage = useCallback(async (p: number, replace: boolean) => {
    try {
      const params = new URLSearchParams({
        page: String(p),
        page_size: String(PAGE_SIZE),
      });
      if (filterAction.trim()) params.set('action', filterAction.trim());

      const result = await api.get<AuditLogsResponse>(`/admin/audit-logs?${params}`);
      setTotal(result.total);
      setPage(p);
      setItems(prev => replace ? result.items : [...prev, ...result.items]);
      setError(null);
    } catch (err: any) {
      const msg =
        err?.response?.data?.detail?.message ||
        err?.message ||
        'Erro ao carregar logs';
      setError(msg);
    }
  }, [filterAction]);

  // Reload whenever screen is focused
  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      fetchPage(1, true).finally(() => setLoading(false));
    }, [fetchPage])
  );

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchPage(1, true);
    setRefreshing(false);
  };

  const handleLoadMore = async () => {
    if (loadingMore || items.length >= total) return;
    setLoadingMore(true);
    await fetchPage(page + 1, false);
    setLoadingMore(false);
  };

  const handleSearch = () => {
    setLoading(true);
    fetchPage(1, true).finally(() => setLoading(false));
  };

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  const renderItem = ({ item }: { item: AuditLogItem }) => {
    const meta    = getActionMeta(item.action);
    const extra   = buildExtraSummary(item.extra_data);
    const entity  = item.entity_type
      ? `${item.entity_type}${item.entity_id ? ` #${item.entity_id.slice(0, 8)}` : ''}`
      : null;

    return (
      <View style={styles.card}>
        {/* Icon + action */}
        <View style={styles.cardHeader}>
          <View style={[styles.iconBadge, { backgroundColor: `${meta.color}18` }]}>
            <Ionicons name={meta.icon as IoniconsName} size={18} color={meta.color} />
          </View>
          <View style={styles.cardHeaderText}>
            <Text style={[styles.actionLabel, { color: meta.color }]}>{meta.label}</Text>
            <Text style={styles.dateText}>{formatDate(item.created_at)}</Text>
          </View>
        </View>

        {/* Actor */}
        {item.actor_name && (
          <View style={styles.rowMeta}>
            <Ionicons name="person-outline" size={13} color="#6b7280" />
            <Text style={styles.metaText}>{item.actor_name}</Text>
          </View>
        )}

        {/* Entity */}
        {entity && (
          <View style={styles.rowMeta}>
            <Ionicons name="cube-outline" size={13} color="#6b7280" />
            <Text style={styles.metaText}>{entity}</Text>
          </View>
        )}

        {/* Extra summary */}
        {extra !== '' && (
          <View style={styles.rowMeta}>
            <Ionicons name="information-circle-outline" size={13} color="#6b7280" />
            <Text style={styles.metaText}>{extra}</Text>
          </View>
        )}
      </View>
    );
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#7c3aed" />
        <Text style={styles.loadingText}>Carregando logs…</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.center}>
        <Ionicons name="alert-circle-outline" size={48} color="#dc2626" />
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity style={styles.retryBtn} onPress={handleRefresh}>
          <Text style={styles.retryBtnText}>Tentar novamente</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Filter bar */}
      <View style={styles.filterBar}>
        <TextInput
          style={styles.filterInput}
          placeholder="Filtrar por ação (ex: member_removed)"
          placeholderTextColor="#9ca3af"
          value={filterAction}
          onChangeText={setFilterAction}
          onSubmitEditing={handleSearch}
          returnKeyType="search"
          autoCapitalize="none"
        />
        <TouchableOpacity style={styles.searchBtn} onPress={handleSearch}>
          <Ionicons name="search" size={18} color="#fff" />
        </TouchableOpacity>
        {filterAction !== '' && (
          <TouchableOpacity
            style={styles.clearBtn}
            onPress={() => { setFilterAction(''); handleSearch(); }}
          >
            <Ionicons name="close" size={18} color="#6b7280" />
          </TouchableOpacity>
        )}
      </View>

      {/* Total count */}
      <Text style={styles.totalText}>
        {total} {total === 1 ? 'registro' : 'registros'}
      </Text>

      <FlatList
        data={items}
        keyExtractor={item => item.id}
        renderItem={renderItem}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            colors={['#7c3aed']}
            tintColor="#7c3aed"
          />
        }
        onEndReached={handleLoadMore}
        onEndReachedThreshold={0.3}
        ListFooterComponent={
          loadingMore
            ? <ActivityIndicator style={{ marginVertical: 16 }} color="#7c3aed" />
            : items.length >= total && items.length > 0
              ? <Text style={styles.endText}>Todos os registros carregados</Text>
              : null
        }
        ListEmptyComponent={
          <View style={styles.center}>
            <Ionicons name="document-text-outline" size={48} color="#d1d5db" />
            <Text style={styles.emptyText}>Nenhum log encontrado</Text>
          </View>
        }
      />
    </View>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f3f4f6',
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    gap: 12,
  },
  loadingText: {
    color: '#6b7280',
    marginTop: 8,
  },
  errorText: {
    color: '#dc2626',
    textAlign: 'center',
    fontSize: 14,
  },
  retryBtn: {
    marginTop: 8,
    paddingHorizontal: 24,
    paddingVertical: 10,
    backgroundColor: '#7c3aed',
    borderRadius: 8,
  },
  retryBtnText: {
    color: '#fff',
    fontWeight: '600',
  },
  filterBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    margin: 12,
    borderRadius: 10,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  filterInput: {
    flex: 1,
    height: 42,
    fontSize: 13,
    color: '#111827',
  },
  searchBtn: {
    backgroundColor: '#7c3aed',
    borderRadius: 6,
    padding: 6,
    marginLeft: 6,
  },
  clearBtn: {
    padding: 6,
    marginLeft: 2,
  },
  totalText: {
    fontSize: 12,
    color: '#6b7280',
    marginLeft: 16,
    marginBottom: 4,
  },
  list: {
    paddingHorizontal: 12,
    paddingBottom: 32,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    gap: 6,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 4,
  },
  iconBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardHeaderText: {
    flex: 1,
  },
  actionLabel: {
    fontSize: 14,
    fontWeight: '700',
  },
  dateText: {
    fontSize: 11,
    color: '#9ca3af',
    marginTop: 1,
  },
  rowMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  metaText: {
    fontSize: 12,
    color: '#6b7280',
    flexShrink: 1,
  },
  endText: {
    textAlign: 'center',
    color: '#9ca3af',
    fontSize: 12,
    marginVertical: 16,
  },
  emptyText: {
    color: '#9ca3af',
    fontSize: 14,
    marginTop: 8,
  },
});
