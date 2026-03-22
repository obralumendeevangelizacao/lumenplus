/**
 * Retreats List Screen
 * ====================
 * Lista os retiros disponíveis para o usuário logado.
 */

import { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  ActivityIndicator, RefreshControl,
} from 'react-native';
import { router, useFocusEffect, type Href } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import type { IoniconsName } from '@/types/icons';
import api from '@/services/api';

const colors = {
  primary: '#1A859B',
  white: '#ffffff',
  gray: '#6b7280',
  lightGray: '#f3f4f6',
};

const TYPE_LABEL: Record<string, string> = {
  WEEKEND: 'Fim de semana',
  DAY: 'Dia único',
  FORMATION: 'Formação',
};

const STATUS_META: Record<string, { label: string; color: string }> = {
  PUBLISHED: { label: 'Inscrições abertas', color: '#059669' },
  CLOSED:    { label: 'Encerrado',          color: '#6b7280' },
};

const REG_STATUS_META: Record<string, { label: string; color: string; icon: string }> = {
  PENDING_PAYMENT:   { label: 'Aguardando pagamento', color: '#d97706', icon: 'time-outline' },
  PAYMENT_SUBMITTED: { label: 'Comprovante enviado',  color: '#2563eb', icon: 'cloud-upload-outline' },
  CONFIRMED:         { label: 'Confirmado',            color: '#059669', icon: 'checkmark-circle-outline' },
  WAITLIST:          { label: 'Lista de espera',       color: '#7c3aed', icon: 'list-outline' },
};

interface Retreat {
  id: string;
  title: string;
  description: string | null;
  retreat_type: string;
  status: string;
  start_date: string;
  end_date: string;
  location: string | null;
  price_brl: string | null;
  my_registration: {
    id: string;
    status: string;
  } | null;
}

export default function RetreatsScreen() {
  const [retreats, setRetreats] = useState<Retreat[]>([]);
  const [loading, setLoading]   = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError]       = useState<string | null>(null);

  const fetchRetreats = async () => {
    try {
      const result = await api.get<{ retreats: Retreat[] }>('/retreats');
      setRetreats(result.retreats || []);
      setError(null);
    } catch (err: any) {
      setError(err?.message || 'Erro ao carregar retiros');
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

  const formatDateRange = (start: string, end: string) => {
    const s = new Date(start);
    const e = new Date(end);
    const sStr = s.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
    const eStr = e.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });
    return `${sStr} – ${eStr}`;
  };

  const renderItem = ({ item }: { item: Retreat }) => {
    const statusMeta = STATUS_META[item.status] ?? { label: item.status, color: colors.gray };
    const regMeta = item.my_registration ? REG_STATUS_META[item.my_registration.status] : null;

    return (
      <TouchableOpacity
        style={styles.card}
        onPress={() => router.push(`/retreats/${item.id}` as Href)}
        activeOpacity={0.8}
      >
        {/* Header */}
        <View style={styles.cardHeader}>
          <View style={styles.typeBadge}>
            <Text style={styles.typeText}>{TYPE_LABEL[item.retreat_type] ?? item.retreat_type}</Text>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: `${statusMeta.color}18` }]}>
            <Text style={[styles.statusText, { color: statusMeta.color }]}>{statusMeta.label}</Text>
          </View>
        </View>

        <Text style={styles.title}>{item.title}</Text>

        {item.description && (
          <Text style={styles.description} numberOfLines={2}>{item.description}</Text>
        )}

        {/* Meta */}
        <View style={styles.meta}>
          <View style={styles.metaRow}>
            <Ionicons name="calendar-outline" size={14} color={colors.gray} />
            <Text style={styles.metaText}>{formatDateRange(item.start_date, item.end_date)}</Text>
          </View>
          {item.location && (
            <View style={styles.metaRow}>
              <Ionicons name="location-outline" size={14} color={colors.gray} />
              <Text style={styles.metaText}>{item.location}</Text>
            </View>
          )}
          <View style={styles.metaRow}>
            <Ionicons name="cash-outline" size={14} color={colors.gray} />
            <Text style={styles.metaText}>
              {item.price_brl ? `R$ ${item.price_brl}` : 'Gratuito'}
            </Text>
          </View>
        </View>

        {/* My registration status */}
        {regMeta && (
          <View style={[styles.regBadge, { backgroundColor: `${regMeta.color}18` }]}>
            <Ionicons name={regMeta.icon as IoniconsName} size={14} color={regMeta.color} />
            <Text style={[styles.regText, { color: regMeta.color }]}>{regMeta.label}</Text>
          </View>
        )}

        <View style={styles.cardFooter}>
          <Text style={styles.seeMore}>
            {item.my_registration ? 'Ver detalhes' : 'Inscrever-se'} →
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.center}>
        <Ionicons name="alert-circle-outline" size={48} color="#dc2626" />
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity style={styles.retryBtn} onPress={() => { setLoading(true); fetchRetreats().finally(() => setLoading(false)); }}>
          <Text style={styles.retryText}>Tentar novamente</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <FlatList
      data={retreats}
      keyExtractor={item => item.id}
      renderItem={renderItem}
      contentContainerStyle={styles.list}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} colors={[colors.primary]} />
      }
      ListEmptyComponent={
        <View style={styles.center}>
          <Ionicons name="calendar-outline" size={64} color="#d1d5db" />
          <Text style={styles.emptyTitle}>Nenhum retiro disponível</Text>
          <Text style={styles.emptySubtitle}>Acompanhe os avisos para novidades</Text>
        </View>
      }
    />
  );
}

const styles = StyleSheet.create({
  list: { padding: 16, paddingBottom: 32 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 12 },
  card: {
    backgroundColor: colors.white,
    borderRadius: 16,
    padding: 16,
    marginBottom: 14,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
    gap: 8,
  },
  cardHeader: { flexDirection: 'row', gap: 8 },
  typeBadge: {
    backgroundColor: `${colors.primary}18`,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  typeText: { fontSize: 11, fontWeight: '600', color: colors.primary },
  statusBadge: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  statusText: { fontSize: 11, fontWeight: '600' },
  title: { fontSize: 17, fontWeight: '700', color: '#111827' },
  description: { fontSize: 13, color: colors.gray, lineHeight: 18 },
  meta: { gap: 4 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  metaText: { fontSize: 13, color: colors.gray },
  regBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6, alignSelf: 'flex-start',
  },
  regText: { fontSize: 12, fontWeight: '600' },
  cardFooter: { alignItems: 'flex-end' },
  seeMore: { fontSize: 13, color: colors.primary, fontWeight: '600' },
  errorText: { color: '#dc2626', textAlign: 'center' },
  retryBtn: { backgroundColor: colors.primary, borderRadius: 8, paddingHorizontal: 24, paddingVertical: 10 },
  retryText: { color: colors.white, fontWeight: '600' },
  emptyTitle: { fontSize: 17, fontWeight: '600', color: '#374151' },
  emptySubtitle: { fontSize: 13, color: colors.gray, textAlign: 'center' },
});
