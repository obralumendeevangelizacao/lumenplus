/**
 * Inbox Screen
 * ============
 * Tela de avisos e comunicações do app.
 * Os avisos ficam guardados por 30 dias.
 */

import { useState, useEffect, useCallback } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  FlatList, 
  TouchableOpacity, 
  RefreshControl,
  Modal,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import api from '@/services/api';

const colors = {
  primary: '#1A859B',
  white: '#ffffff',
  gray: '#6b7280',
  lightGray: '#E8E8E8',
  success: '#22c55e',
  warning: '#f59e0b',
  error: '#ef4444',
  info: '#3b82f6',
};

interface Aviso {
  id: string;
  title: string;
  message: string;
  type: 'info' | 'warning' | 'success' | 'urgent';
  read: boolean;
  created_at: string;
  expires_at: string;
}

export default function InboxScreen() {
  const [avisos, setAvisos] = useState<Aviso[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedAviso, setSelectedAviso] = useState<Aviso | null>(null);
  const [modalVisible, setModalVisible] = useState(false);

  useEffect(() => {
    loadAvisos();
  }, []);

  const loadAvisos = async () => {
    try {
      const response = await api.get('/inbox');
      setAvisos(response.data || []);
    } catch (error) {
      console.log('Erro ao carregar avisos:', error);
      // Mock data para demonstração enquanto API não existe
      setAvisos([]);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadAvisos();
    setRefreshing(false);
  }, []);

  const handleOpenAviso = async (aviso: Aviso) => {
    setSelectedAviso(aviso);
    setModalVisible(true);

    // Marcar como lido
    if (!aviso.read) {
      try {
        await api.patch(`/inbox/${aviso.id}/read`);
        setAvisos(prev => 
          prev.map(a => a.id === aviso.id ? { ...a, read: true } : a)
        );
      } catch (error) {
        console.log('Erro ao marcar como lido:', error);
      }
    }
  };

  const getAvisoIcon = (type: string) => {
    switch (type) {
      case 'urgent':
        return { name: 'alert-circle', color: colors.error };
      case 'warning':
        return { name: 'warning', color: colors.warning };
      case 'success':
        return { name: 'checkmark-circle', color: colors.success };
      default:
        return { name: 'information-circle', color: colors.info };
    }
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'urgent': return 'Urgente';
      case 'warning': return 'Atenção';
      case 'success': return 'Confirmação';
      default: return 'Informativo';
    }
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatRelativeDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffHours < 1) return 'Agora';
    if (diffHours < 24) return `Há ${diffHours}h`;
    if (diffDays === 1) return 'Ontem';
    if (diffDays < 7) return `Há ${diffDays} dias`;
    return date.toLocaleDateString('pt-BR');
  };

  const unreadCount = avisos.filter(a => !a.read).length;

  const renderAviso = ({ item }: { item: Aviso }) => {
    const icon = getAvisoIcon(item.type);
    
    return (
      <TouchableOpacity 
        style={[styles.avisoCard, !item.read && styles.avisoUnread]}
        onPress={() => handleOpenAviso(item)}
        activeOpacity={0.7}
      >
        <View style={[styles.avisoIconContainer, { backgroundColor: `${icon.color}15` }]}>
          <Ionicons name={icon.name as any} size={24} color={icon.color} />
        </View>
        
        <View style={styles.avisoContent}>
          <View style={styles.avisoHeader}>
            <Text style={[styles.avisoTitle, !item.read && styles.avisoTitleUnread]} numberOfLines={1}>
              {item.title}
            </Text>
            {!item.read && <View style={styles.unreadDot} />}
          </View>
          <Text style={styles.avisoMessage} numberOfLines={2}>{item.message}</Text>
          <Text style={styles.avisoDate}>{formatRelativeDate(item.created_at)}</Text>
        </View>
        
        <Ionicons name="chevron-forward" size={20} color={colors.gray} />
      </TouchableOpacity>
    );
  };

  const renderEmpty = () => (
    <View style={styles.emptyContainer}>
      <View style={styles.emptyIconContainer}>
        <Ionicons name="mail-open-outline" size={64} color={colors.primary} />
      </View>
      <Text style={styles.emptyTitle}>Nenhum aviso</Text>
      <Text style={styles.emptyMessage}>
        Você não tem avisos no momento.{'\n'}Os avisos ficam disponíveis por 30 dias.
      </Text>
    </View>
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header Info */}
      {avisos.length > 0 && (
        <View style={styles.headerInfo}>
          <Text style={styles.headerText}>
            {unreadCount > 0 
              ? `${unreadCount} aviso${unreadCount > 1 ? 's' : ''} não lido${unreadCount > 1 ? 's' : ''}`
              : 'Todos os avisos lidos'
            }
          </Text>
          <Text style={styles.headerSubtext}>Avisos expiram em 30 dias</Text>
        </View>
      )}

      {/* Lista de Avisos */}
      <FlatList
        data={avisos}
        renderItem={renderAviso}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.primary]} />
        }
        ListEmptyComponent={renderEmpty}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
      />

      {/* Modal de Detalhes */}
      <Modal
        visible={modalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            {selectedAviso && (
              <>
                <View style={styles.modalHeader}>
                  <View style={[
                    styles.modalTypeChip, 
                    { backgroundColor: `${getAvisoIcon(selectedAviso.type).color}15` }
                  ]}>
                    <Ionicons 
                      name={getAvisoIcon(selectedAviso.type).name as any} 
                      size={16} 
                      color={getAvisoIcon(selectedAviso.type).color} 
                    />
                    <Text style={[
                      styles.modalTypeText,
                      { color: getAvisoIcon(selectedAviso.type).color }
                    ]}>
                      {getTypeLabel(selectedAviso.type)}
                    </Text>
                  </View>
                  
                  <TouchableOpacity 
                    style={styles.modalCloseButton}
                    onPress={() => setModalVisible(false)}
                  >
                    <Ionicons name="close" size={24} color={colors.gray} />
                  </TouchableOpacity>
                </View>

                <ScrollView style={styles.modalBody}>
                  <Text style={styles.modalTitle}>{selectedAviso.title}</Text>
                  <Text style={styles.modalDate}>{formatDate(selectedAviso.created_at)}</Text>
                  <Text style={styles.modalMessage}>{selectedAviso.message}</Text>
                </ScrollView>

                <TouchableOpacity 
                  style={styles.modalButton}
                  onPress={() => setModalVisible(false)}
                >
                  <Text style={styles.modalButtonText}>Fechar</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.lightGray,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.lightGray,
  },
  headerInfo: {
    backgroundColor: colors.white,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e5e5',
  },
  headerText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#171717',
  },
  headerSubtext: {
    fontSize: 12,
    color: colors.gray,
    marginTop: 2,
  },
  listContent: {
    padding: 16,
    flexGrow: 1,
  },
  separator: {
    height: 10,
  },
  avisoCard: {
    backgroundColor: colors.white,
    borderRadius: 12,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
  },
  avisoUnread: {
    borderLeftWidth: 3,
    borderLeftColor: colors.primary,
  },
  avisoIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  avisoContent: {
    flex: 1,
  },
  avisoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avisoTitle: {
    fontSize: 15,
    fontWeight: '500',
    color: '#171717',
    flex: 1,
  },
  avisoTitleUnread: {
    fontWeight: '600',
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.primary,
    marginLeft: 8,
  },
  avisoMessage: {
    fontSize: 13,
    color: colors.gray,
    lineHeight: 18,
    marginTop: 2,
  },
  avisoDate: {
    fontSize: 11,
    color: colors.gray,
    marginTop: 4,
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
    backgroundColor: 'rgba(26, 133, 155, 0.1)',
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
    lineHeight: 20,
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: colors.white,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e5e5',
  },
  modalTypeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    gap: 6,
  },
  modalTypeText: {
    fontSize: 13,
    fontWeight: '600',
  },
  modalCloseButton: {
    padding: 4,
  },
  modalBody: {
    padding: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#171717',
    marginBottom: 8,
  },
  modalDate: {
    fontSize: 13,
    color: colors.gray,
    marginBottom: 16,
  },
  modalMessage: {
    fontSize: 15,
    color: '#374151',
    lineHeight: 24,
  },
  modalButton: {
    margin: 16,
    padding: 16,
    backgroundColor: colors.primary,
    borderRadius: 12,
    alignItems: 'center',
  },
  modalButtonText: {
    color: colors.white,
    fontSize: 16,
    fontWeight: '600',
  },
});
