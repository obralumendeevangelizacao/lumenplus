/**
 * Admin — Retreat List
 * ====================
 * Lista todos os retiros para gestores.
 */

import { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  ActivityIndicator, RefreshControl,
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import api from '@/services/api';

const colors = {
  primary: '#7c3aed',
  white: '#ffffff',
  gray: '#6b7280',
  lightGray: '#f3f4f6',
};

const STATUS_META: Record<string, { label: string; color: string }> = {
  DRAFT:     { label: 'Rascunho',  color: '#6b7280' },
  PUBLISHED: { label: 'Publicado', color: '#059669' },
  CLOSED:    { label: 'Encerrado', color: '#2563eb' },
  CANCELLED: { label: 'Cancelado', color: '#dc2626' },
};

const TYPE_LABEL: Record<string, string> = {
  WEEKEND: 'Fim de semana',
  DAY: 'Dia único',
  FORMATION: 'Formação',
};

interface Retreat {
  id: string;
  title: string;
  retreat_type: string;
  status: string;
  start_date: string;
  end_date: string;
  location: string | null;
  registrations_count: number;
}

export default function AdminRetreatsScreen() {
  const [retreats, setRetreats] = useState<Retreat[]>([]);
  const [loading, setLoading]   = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError]       = useState<string | null>(null);

  const fetchRetreats = async () => {
    try {
      const result = await api.get<{ retreats: Retreat[] }>('/admin/retreats');
      setRetreats(result.retreats || []);
      setError(null);
    } catch (err: any) {
      setError(err?.response?.data?.detail?.message || err?.message || 'Erro ao carregar retiros');
    }
  };

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      fetchRetreats().finally(() => setLoading(false));
    }, [])
  );

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchRetreats();
    setRefreshing(false);
  };

  const renderItem = ({ item }: { item: Retreat }) => {
    const meta = STATUS_META[item.status] ?? { label: item.status, color: colors.gray };
    const start = new Date(item.start_date).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });

    return (
      <TouchableOpacity
        style={styles.card}
        onPress={() => router.push(`/admin/retreats/${item.id}` as any)}
        activeOpacity={0.8}
      >
        <View style={styles.cardHeader}>
          <Text style={styles.typeText}>{TYPE_LABEL[item.retreat_type] ?? item.retreat_type}</Text>
          <View style={[styles.statusBadge, { backgroundColor: `${meta.color}18` }]}>
            <Text style={[styles.statusText, { color: meta.color }]}>{meta.label}</Text>
          </View>
        </View>
        <Text style={styles.title}>{item.title}</Text>
        <View style={styles.cardMeta}>
          <View style={styles.metaRow}>
            <Ionicons name="calendar-outline" size={13} color={colors.gray} />
            <Text style={styles.metaText}>{start}</Text>
          </View>
          {item.location && (
            <View style={styles.metaRow}>
              <Ionicons name="location-outline" size={13} color={colors.gray} />
              <Text style={styles.metaText}>{item.location}</Text>
            </View>
          )}
          <View style={styles.metaRow}>
            <Ionicons name="people-outline" size={13} color={colors.gray} />
            <Text style={styles.metaText}>{item.registrations_count} inscrito(s)</Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  if (loading) {
    return <View style={styles.center}><ActivityIndicator size="large" color={colors.primary} /></View>;
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={retreats}
        keyExtractor={item => item.id}
        renderItem={renderItem}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} colors={[colors.primary]} />}
        ListHeaderComponent={
          error ? (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null
        }
        ListEmptyComponent={
          <View style={styles.center}>
            <Ionicons name="calendar-outline" size={56} color="#d1d5db" />
            <Text style={styles.emptyText}>Nenhum retiro criado</Text>
          </View>
        }
      />
      <TouchableOpacity
        style={styles.fab}
        onPress={() => router.push('/admin/retreats/create' as any)}
      >
        <Ionicons name="add" size={28} color={colors.white} />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.lightGray },
  list: { padding: 14, paddingBottom: 90 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 10 },
  card: {
    backgroundColor: colors.white, borderRadius: 14, padding: 14, marginBottom: 12, gap: 6,
    shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 4, elevation: 1,
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  typeText: { fontSize: 11, fontWeight: '600', color: colors.gray, textTransform: 'uppercase' },
  statusBadge: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  statusText: { fontSize: 11, fontWeight: '700' },
  title: { fontSize: 16, fontWeight: '700', color: '#111827' },
  cardMeta: { gap: 3 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  metaText: { fontSize: 12, color: colors.gray },
  errorBox: { backgroundColor: '#fef2f2', borderRadius: 10, padding: 12, marginBottom: 12 },
  errorText: { color: '#dc2626', fontSize: 13 },
  emptyText: { fontSize: 15, color: colors.gray },
  fab: {
    position: 'absolute', bottom: 24, right: 20,
    backgroundColor: colors.primary, width: 56, height: 56, borderRadius: 28,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 6, elevation: 4,
  },
});
