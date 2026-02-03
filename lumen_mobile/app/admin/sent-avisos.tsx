/**
 * Sent Avisos Screen
 * ==================
 * Histórico de avisos enviados pelo usuário.
 */

import { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import api from '@/services/api';

const colors = {
  primary: '#1A859B',
  white: '#ffffff',
  gray: '#6b7280',
  lightGray: '#E8E8E8',
  admin: '#7c3aed',
  error: '#ef4444',
  success: '#22c55e',
  warning: '#f59e0b',
  info: '#3b82f6',
};

interface SentAviso {
  id: string;
  title: string;
  message: string;
  type: string;
  created_at: string;
  expires_at: string;
  recipient_count: number;
  read_count: number;
}

export default function SentAvisosScreen() {
  const [avisos, setAvisos] = useState<SentAviso[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadAvisos();
  }, []);

  const loadAvisos = async () => {
    try {
      const response = await api.get('/inbox/sent');
      setAvisos(response.data.messages || []);
    } catch (error) {
      console.log('Erro ao carregar avisos:', error);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadAvisos();
    setRefreshing(false);
  }, []);

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'urgent': return { name: 'alert-circle', color: colors.error };
      case 'warning': return { name: 'warning', color: colors.warning };
      case 'success': return { name: 'checkmark-circle', color: colors.success };
      default: return { name: 'information-circle', color: colors.info };
    }
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const renderAviso = ({ item }: { item: SentAviso }) => {
    const icon = getTypeIcon(item.type);
    const readPercentage = item.recipient_count > 0 
      ? Math.round((item.read_count / item.recipient_count) * 100) 
      : 0;

    return (
      <View style={styles.avisoCard}>
        <View style={styles.avisoHeader}>
          <View style={[styles.iconContainer, { backgroundColor: `${icon.color}15` }]}>
            <Ionicons name={icon.name as any} size={24} color={icon.color} />
          </View>
          <View style={styles.avisoInfo}>
            <Text style={styles.avisoTitle} numberOfLines={1}>{item.title}</Text>
            <Text style={styles.avisoDate}>{formatDate(item.created_at)}</Text>
          </View>
        </View>
        
        <Text style={styles.avisoMessage} numberOfLines={2}>{item.message}</Text>
        
        <View style={styles.statsContainer}>
          <View style={styles.stat}>
            <Ionicons name="people-outline" size={16} color={colors.gray} />
            <Text style={styles.statText}>{item.recipient_count} destinatários</Text>
          </View>
          <View style={styles.stat}>
            <Ionicons name="eye-outline" size={16} color={colors.gray} />
            <Text style={styles.statText}>{item.read_count} leram ({readPercentage}%)</Text>
          </View>
        </View>

        {/* Progress bar */}
        <View style={styles.progressContainer}>
          <View style={[styles.progressBar, { width: `${readPercentage}%` }]} />
        </View>
      </View>
    );
  };

  const renderEmpty = () => (
    <View style={styles.emptyContainer}>
      <View style={styles.emptyIconContainer}>
        <Ionicons name="paper-plane-outline" size={64} color={colors.admin} />
      </View>
      <Text style={styles.emptyTitle}>Nenhum aviso enviado</Text>
      <Text style={styles.emptyMessage}>
        Os avisos que você enviar aparecerão aqui.
      </Text>
    </View>
  );

  if (loading) {
    return (
      <>
        <Stack.Screen options={{ title: 'Avisos Enviados' }} />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.admin} />
        </View>
      </>
    );
  }

  return (
    <>
      <Stack.Screen options={{ title: 'Avisos Enviados' }} />
      
      <FlatList
        data={avisos}
        renderItem={renderAviso}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.admin]} />
        }
        ListEmptyComponent={renderEmpty}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
      />
    </>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.lightGray,
  },
  listContent: {
    padding: 16,
    flexGrow: 1,
    backgroundColor: colors.lightGray,
  },
  separator: {
    height: 12,
  },
  avisoCard: {
    backgroundColor: colors.white,
    borderRadius: 12,
    padding: 16,
  },
  avisoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  iconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  avisoInfo: {
    flex: 1,
  },
  avisoTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#171717',
  },
  avisoDate: {
    fontSize: 12,
    color: colors.gray,
    marginTop: 2,
  },
  avisoMessage: {
    fontSize: 14,
    color: colors.gray,
    lineHeight: 20,
    marginBottom: 12,
  },
  statsContainer: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 8,
  },
  stat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  statText: {
    fontSize: 12,
    color: colors.gray,
  },
  progressContainer: {
    height: 4,
    backgroundColor: '#e5e5e5',
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    backgroundColor: colors.success,
    borderRadius: 2,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
    marginTop: 60,
  },
  emptyIconContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: `${colors.admin}15`,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#171717',
    marginBottom: 8,
  },
  emptyMessage: {
    fontSize: 14,
    color: colors.gray,
    textAlign: 'center',
  },
});
