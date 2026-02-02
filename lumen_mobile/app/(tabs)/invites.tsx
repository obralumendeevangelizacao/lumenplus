/**
 * Invites Screen
 * ==============
 * Tela de convites pendentes do usuário.
 * Permite aceitar ou recusar convites para participar de grupos/ministérios.
 */

import { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import api from '@/services/api';

const colors = {
  primary: '#1a365d',
  primaryLight: '#2c5282',
  white: '#ffffff',
  gray: '#6b7280',
  lightGray: '#f3f4f6',
  error: '#ef4444',
  success: '#22c55e',
  warning: '#f59e0b',
  border: '#e5e5e5',
  background: '#f9fafb',
};

interface Invite {
  id: string;
  org_unit_id: string;
  org_unit_name: string;
  org_unit_type: string;
  invited_by_name: string;
  role: string;
  message: string | null;
  created_at: string;
  expires_at: string | null;
}

const ORG_TYPE_LABELS: Record<string, string> = {
  CONSELHO_GERAL: 'Conselho Geral',
  CONSELHO_EXECUTIVO: 'Conselho Executivo',
  SETOR: 'Setor',
  MINISTERIO: 'Ministério',
  GRUPO: 'Grupo',
};

const ROLE_LABELS: Record<string, string> = {
  COORDINATOR: 'Coordenador',
  MEMBER: 'Membro',
};

export default function InvitesScreen() {
  const [invites, setInvites] = useState<Invite[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [processingId, setProcessingId] = useState<string | null>(null);

  const loadInvites = useCallback(async () => {
    try {
      const data = await api.get<Invite[]>('/org/my/invites');
      setInvites(data);
    } catch (err) {
      console.error('Erro ao carregar convites:', err);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadInvites();
  }, [loadInvites]);

  const handleRefresh = () => {
    setIsRefreshing(true);
    loadInvites();
  };

  const handleAccept = async (invite: Invite) => {
    Alert.alert(
      'Aceitar Convite',
      `Deseja aceitar o convite para participar de "${invite.org_unit_name}" como ${ROLE_LABELS[invite.role] || invite.role}?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Aceitar',
          onPress: async () => {
            try {
              setProcessingId(invite.id);
              await api.post(`/org/invites/${invite.id}/accept`);
              Alert.alert('Sucesso!', 'Você agora faz parte do grupo!');
              loadInvites();
            } catch (err: any) {
              const message = err.response?.data?.detail?.message || 'Erro ao aceitar convite';
              Alert.alert('Erro', message);
            } finally {
              setProcessingId(null);
            }
          },
        },
      ]
    );
  };

  const handleReject = async (invite: Invite) => {
    Alert.alert(
      'Recusar Convite',
      `Deseja recusar o convite para "${invite.org_unit_name}"?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Recusar',
          style: 'destructive',
          onPress: async () => {
            try {
              setProcessingId(invite.id);
              await api.post(`/org/invites/${invite.id}/reject`);
              Alert.alert('Convite recusado');
              loadInvites();
            } catch (err: any) {
              const message = err.response?.data?.detail?.message || 'Erro ao recusar convite';
              Alert.alert('Erro', message);
            } finally {
              setProcessingId(null);
            }
          },
        },
      ]
    );
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  };

  const renderInvite = ({ item }: { item: Invite }) => {
    const isProcessing = processingId === item.id;
    const typeLabel = ORG_TYPE_LABELS[item.org_unit_type] || item.org_unit_type;
    const roleLabel = ROLE_LABELS[item.role] || item.role;

    return (
      <View style={styles.card}>
        {/* Header */}
        <View style={styles.cardHeader}>
          <View style={styles.iconContainer}>
            <Ionicons name="mail-open" size={24} color={colors.primary} />
          </View>
          <View style={styles.cardTitleContainer}>
            <Text style={styles.cardTitle}>{item.org_unit_name}</Text>
            <Text style={styles.cardSubtitle}>{typeLabel}</Text>
          </View>
          <View style={styles.roleBadge}>
            <Text style={styles.roleBadgeText}>{roleLabel}</Text>
          </View>
        </View>

        {/* Info */}
        <View style={styles.cardInfo}>
          <View style={styles.infoRow}>
            <Ionicons name="person-outline" size={16} color={colors.gray} />
            <Text style={styles.infoText}>
              Convidado por <Text style={styles.infoHighlight}>{item.invited_by_name}</Text>
            </Text>
          </View>
          <View style={styles.infoRow}>
            <Ionicons name="calendar-outline" size={16} color={colors.gray} />
            <Text style={styles.infoText}>
              Recebido em {formatDate(item.created_at)}
            </Text>
          </View>
          {item.expires_at && (
            <View style={styles.infoRow}>
              <Ionicons name="time-outline" size={16} color={colors.warning} />
              <Text style={[styles.infoText, { color: colors.warning }]}>
                Expira em {formatDate(item.expires_at)}
              </Text>
            </View>
          )}
        </View>

        {/* Message */}
        {item.message && (
          <View style={styles.messageContainer}>
            <Text style={styles.messageLabel}>Mensagem:</Text>
            <Text style={styles.messageText}>"{item.message}"</Text>
          </View>
        )}

        {/* Actions */}
        <View style={styles.cardActions}>
          <TouchableOpacity
            style={[styles.rejectButton, isProcessing && styles.buttonDisabled]}
            onPress={() => handleReject(item)}
            disabled={isProcessing}
          >
            {isProcessing ? (
              <ActivityIndicator size="small" color={colors.error} />
            ) : (
              <>
                <Ionicons name="close" size={18} color={colors.error} />
                <Text style={styles.rejectButtonText}>Recusar</Text>
              </>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.acceptButton, isProcessing && styles.buttonDisabled]}
            onPress={() => handleAccept(item)}
            disabled={isProcessing}
          >
            {isProcessing ? (
              <ActivityIndicator size="small" color={colors.white} />
            ) : (
              <>
                <Ionicons name="checkmark" size={18} color={colors.white} />
                <Text style={styles.acceptButtonText}>Aceitar</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  const renderEmpty = () => (
    <View style={styles.emptyContainer}>
      <Ionicons name="mail-outline" size={64} color={colors.gray} />
      <Text style={styles.emptyTitle}>Nenhum convite pendente</Text>
      <Text style={styles.emptyText}>
        Quando você receber convites para participar de grupos ou ministérios, eles aparecerão aqui.
      </Text>
    </View>
  );

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Carregando convites...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={invites}
        renderItem={renderInvite}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            colors={[colors.primary]}
          />
        }
        ListEmptyComponent={renderEmpty}
        ListHeaderComponent={
          invites.length > 0 ? (
            <Text style={styles.headerText}>
              Você tem {invites.length} convite{invites.length > 1 ? 's' : ''} pendente{invites.length > 1 ? 's' : ''}
            </Text>
          ) : null
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: colors.gray,
  },
  listContent: {
    padding: 16,
    flexGrow: 1,
  },
  headerText: {
    fontSize: 14,
    color: colors.gray,
    marginBottom: 16,
  },
  card: {
    backgroundColor: colors.white,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  iconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.lightGray,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  cardTitleContainer: {
    flex: 1,
  },
  cardTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: '#171717',
  },
  cardSubtitle: {
    fontSize: 13,
    color: colors.gray,
    marginTop: 2,
  },
  roleBadge: {
    backgroundColor: colors.primaryLight,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  roleBadgeText: {
    fontSize: 12,
    color: colors.white,
    fontWeight: '500',
  },
  cardInfo: {
    marginBottom: 12,
    gap: 6,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  infoText: {
    fontSize: 14,
    color: colors.gray,
  },
  infoHighlight: {
    fontWeight: '500',
    color: '#374151',
  },
  messageContainer: {
    backgroundColor: colors.lightGray,
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
  },
  messageLabel: {
    fontSize: 12,
    color: colors.gray,
    marginBottom: 4,
  },
  messageText: {
    fontSize: 14,
    color: '#374151',
    fontStyle: 'italic',
  },
  cardActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 4,
  },
  rejectButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: colors.error,
  },
  rejectButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.error,
  },
  acceptButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    padding: 12,
    borderRadius: 10,
    backgroundColor: colors.success,
  },
  acceptButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.white,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
    paddingTop: 60,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#374151',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 15,
    color: colors.gray,
    textAlign: 'center',
    lineHeight: 22,
  },
});
