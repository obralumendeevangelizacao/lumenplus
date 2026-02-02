/**
 * Members Screen
 * ==============
 * Tela de gerenciamento de membros de uma unidade organizacional.
 * Permite ver membros, convidar, promover/rebaixar e remover.
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
  Modal,
  TextInput,
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import api from '@/services/api';

const colors = {
  primary: '#1a365d',
  primaryLight: '#2c5282',
  white: '#ffffff',
  gray: '#6b7280',
  lightGray: '#f3f4f6',
  background: '#f9fafb',
  border: '#e5e5e5',
  success: '#22c55e',
  error: '#ef4444',
  warning: '#f59e0b',
};

interface Member {
  user_id: string;
  user_name: string;
  user_email: string | null;
  role: string;
  status: string;
  joined_at: string;
}

interface UserSearchResult {
  id: string;
  name: string;
  email: string | null;
  photo_url: string | null;
}

interface Permissions {
  can_invite: boolean;
  can_manage_members: boolean;
  is_coordinator: boolean;
}

const ROLE_LABELS: Record<string, string> = {
  COORDINATOR: 'Coordenador',
  MEMBER: 'Membro',
};

export default function MembersScreen() {
  const params = useLocalSearchParams<{ 
    org_unit_id: string; 
    org_unit_name: string;
  }>();
  
  const [members, setMembers] = useState<Member[]>([]);
  const [permissions, setPermissions] = useState<Permissions | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  
  // Modal de convite
  const [showInvite, setShowInvite] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<UserSearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [inviteRole, setInviteRole] = useState<'MEMBER' | 'COORDINATOR'>('MEMBER');
  const [inviteMessage, setInviteMessage] = useState('');
  const [isSendingInvite, setIsSendingInvite] = useState(false);
  
  // Modal de ações do membro
  const [selectedMember, setSelectedMember] = useState<Member | null>(null);
  const [showMemberActions, setShowMemberActions] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const [membersData, permissionsData] = await Promise.all([
        api.get<{ members: Member[] }>(`/org/units/${params.org_unit_id}/members`),
        api.get<Permissions>(`/org/units/${params.org_unit_id}/permissions`),
      ]);
      
      setMembers(membersData.members);
      setPermissions(permissionsData);
    } catch (err) {
      console.error('Erro ao carregar membros:', err);
      Alert.alert('Erro', 'Não foi possível carregar os membros');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [params.org_unit_id]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleRefresh = () => {
    setIsRefreshing(true);
    loadData();
  };

  // Busca de usuários para convidar
  useEffect(() => {
    const searchUsers = async () => {
      if (searchQuery.length < 2) {
        setSearchResults([]);
        return;
      }
      
      try {
        setIsSearching(true);
        const results = await api.get<UserSearchResult[]>(
          `/org/units/${params.org_unit_id}/search-users?q=${encodeURIComponent(searchQuery)}`
        );
        setSearchResults(results);
      } catch (err) {
        console.error('Erro na busca:', err);
      } finally {
        setIsSearching(false);
      }
    };

    const debounce = setTimeout(searchUsers, 300);
    return () => clearTimeout(debounce);
  }, [searchQuery, params.org_unit_id]);

  const handleSendInvite = async (userId: string, userName: string) => {
    Alert.alert(
      'Enviar Convite',
      `Convidar ${userName} como ${ROLE_LABELS[inviteRole]}?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Enviar',
          onPress: async () => {
            try {
              setIsSendingInvite(true);
              await api.post(`/org/units/${params.org_unit_id}/invites`, {
                user_id: userId,
                role: inviteRole,
                message: inviteMessage || null,
              });
              Alert.alert('Sucesso!', 'Convite enviado!');
              setSearchQuery('');
              setSearchResults([]);
              setInviteMessage('');
            } catch (err: any) {
              const message = err.response?.data?.detail?.message || 'Erro ao enviar convite';
              Alert.alert('Erro', message);
            } finally {
              setIsSendingInvite(false);
            }
          },
        },
      ]
    );
  };

  const handlePromote = async (member: Member) => {
    const newRole = member.role === 'COORDINATOR' ? 'MEMBER' : 'COORDINATOR';
    const action = member.role === 'COORDINATOR' ? 'rebaixar' : 'promover';
    
    Alert.alert(
      `${action.charAt(0).toUpperCase() + action.slice(1)} Membro`,
      `Deseja ${action} ${member.user_name} para ${ROLE_LABELS[newRole]}?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Confirmar',
          onPress: async () => {
            try {
              await api.put(
                `/org/units/${params.org_unit_id}/members/${member.user_id}/role?role=${newRole}`
              );
              Alert.alert('Sucesso!', `${member.user_name} agora é ${ROLE_LABELS[newRole]}`);
              setShowMemberActions(false);
              loadData();
            } catch (err: any) {
              const message = err.response?.data?.detail?.message || 'Erro ao atualizar papel';
              Alert.alert('Erro', message);
            }
          },
        },
      ]
    );
  };

  const handleRemove = async (member: Member) => {
    Alert.alert(
      'Remover Membro',
      `Deseja remover ${member.user_name} da unidade?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Remover',
          style: 'destructive',
          onPress: async () => {
            try {
              await api.delete(`/org/units/${params.org_unit_id}/members/${member.user_id}`);
              Alert.alert('Sucesso!', 'Membro removido');
              setShowMemberActions(false);
              loadData();
            } catch (err: any) {
              const message = err.response?.data?.detail?.message || 'Erro ao remover membro';
              Alert.alert('Erro', message);
            }
          },
        },
      ]
    );
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  };

  const renderMember = ({ item }: { item: Member }) => {
    const isCoord = item.role === 'COORDINATOR';
    
    return (
      <TouchableOpacity
        style={styles.memberCard}
        onPress={() => {
          if (permissions?.can_manage_members) {
            setSelectedMember(item);
            setShowMemberActions(true);
          }
        }}
        disabled={!permissions?.can_manage_members}
      >
        <View style={styles.memberAvatar}>
          <Text style={styles.avatarText}>
            {item.user_name.charAt(0).toUpperCase()}
          </Text>
        </View>
        
        <View style={styles.memberInfo}>
          <Text style={styles.memberName}>{item.user_name}</Text>
          {item.user_email && (
            <Text style={styles.memberEmail}>{item.user_email}</Text>
          )}
          <Text style={styles.memberJoined}>
            Desde {formatDate(item.joined_at)}
          </Text>
        </View>
        
        <View style={styles.memberBadge}>
          {isCoord && (
            <Ionicons name="star" size={16} color={colors.warning} />
          )}
          <Text style={[styles.memberRole, isCoord && styles.memberRoleCoord]}>
            {ROLE_LABELS[item.role]}
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  const renderInviteModal = () => (
    <Modal
      visible={showInvite}
      animationType="slide"
      transparent
      onRequestClose={() => setShowInvite(false)}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Convidar Membro</Text>
            <TouchableOpacity onPress={() => setShowInvite(false)}>
              <Ionicons name="close" size={24} color={colors.gray} />
            </TouchableOpacity>
          </View>

          <Text style={styles.label}>Buscar usuário</Text>
          <TextInput
            style={styles.input}
            placeholder="Digite o nome..."
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholderTextColor={colors.gray}
          />

          {isSearching && (
            <ActivityIndicator style={styles.searchLoader} color={colors.primary} />
          )}

          {searchResults.length > 0 && (
            <View style={styles.searchResults}>
              {searchResults.map(user => (
                <TouchableOpacity
                  key={user.id}
                  style={styles.searchResultItem}
                  onPress={() => handleSendInvite(user.id, user.name)}
                  disabled={isSendingInvite}
                >
                  <View style={styles.searchResultAvatar}>
                    <Text style={styles.avatarText}>
                      {user.name.charAt(0).toUpperCase()}
                    </Text>
                  </View>
                  <View style={styles.searchResultInfo}>
                    <Text style={styles.searchResultName}>{user.name}</Text>
                    {user.email && (
                      <Text style={styles.searchResultEmail}>{user.email}</Text>
                    )}
                  </View>
                  <Ionicons name="add-circle" size={24} color={colors.primary} />
                </TouchableOpacity>
              ))}
            </View>
          )}

          <Text style={styles.label}>Convidar como</Text>
          <View style={styles.roleOptions}>
            <TouchableOpacity
              style={[styles.roleOption, inviteRole === 'MEMBER' && styles.roleOptionActive]}
              onPress={() => setInviteRole('MEMBER')}
            >
              <Text style={[styles.roleOptionText, inviteRole === 'MEMBER' && styles.roleOptionTextActive]}>
                Membro
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.roleOption, inviteRole === 'COORDINATOR' && styles.roleOptionActive]}
              onPress={() => setInviteRole('COORDINATOR')}
            >
              <Text style={[styles.roleOptionText, inviteRole === 'COORDINATOR' && styles.roleOptionTextActive]}>
                Coordenador
              </Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.label}>Mensagem (opcional)</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            placeholder="Adicione uma mensagem ao convite..."
            value={inviteMessage}
            onChangeText={setInviteMessage}
            multiline
            numberOfLines={3}
            placeholderTextColor={colors.gray}
          />
        </View>
      </View>
    </Modal>
  );

  const renderMemberActionsModal = () => {
    if (!selectedMember) return null;
    
    const isCoord = selectedMember.role === 'COORDINATOR';
    
    return (
      <Modal
        visible={showMemberActions}
        animationType="fade"
        transparent
        onRequestClose={() => setShowMemberActions(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowMemberActions(false)}
        >
          <View style={styles.actionsModal}>
            <Text style={styles.actionsTitle}>{selectedMember.user_name}</Text>
            <Text style={styles.actionsSubtitle}>{ROLE_LABELS[selectedMember.role]}</Text>

            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => handlePromote(selectedMember)}
            >
              <Ionicons
                name={isCoord ? 'arrow-down' : 'arrow-up'}
                size={20}
                color={colors.primary}
              />
              <Text style={styles.actionButtonText}>
                {isCoord ? 'Rebaixar para Membro' : 'Promover a Coordenador'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.actionButton, styles.actionButtonDanger]}
              onPress={() => handleRemove(selectedMember)}
            >
              <Ionicons name="person-remove" size={20} color={colors.error} />
              <Text style={[styles.actionButtonText, styles.actionButtonTextDanger]}>
                Remover da Unidade
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.cancelButton}
              onPress={() => setShowMemberActions(false)}
            >
              <Text style={styles.cancelButtonText}>Cancelar</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    );
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Carregando membros...</Text>
      </View>
    );
  }

  const coordinators = members.filter(m => m.role === 'COORDINATOR');
  const regularMembers = members.filter(m => m.role === 'MEMBER');

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={colors.primary} />
        </TouchableOpacity>
        <View style={styles.headerTitle}>
          <Text style={styles.headerTitleText}>{params.org_unit_name}</Text>
          <Text style={styles.headerSubtitle}>{members.length} membros</Text>
        </View>
        {permissions?.can_invite && (
          <TouchableOpacity
            style={styles.inviteButton}
            onPress={() => setShowInvite(true)}
          >
            <Ionicons name="person-add" size={20} color={colors.white} />
          </TouchableOpacity>
        )}
      </View>

      <FlatList
        data={[...coordinators, ...regularMembers]}
        renderItem={renderMember}
        keyExtractor={(item) => item.user_id}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            colors={[colors.primary]}
          />
        }
        ListHeaderComponent={
          coordinators.length > 0 ? (
            <Text style={styles.sectionTitle}>
              ⭐ Coordenadores ({coordinators.length})
            </Text>
          ) : null
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="people-outline" size={48} color={colors.gray} />
            <Text style={styles.emptyText}>Nenhum membro encontrado</Text>
          </View>
        }
      />

      {renderInviteModal()}
      {renderMemberActionsModal()}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background },
  loadingText: { marginTop: 12, fontSize: 16, color: colors.gray },
  header: { flexDirection: 'row', alignItems: 'center', padding: 16, backgroundColor: colors.white, borderBottomWidth: 1, borderBottomColor: colors.border },
  headerTitle: { flex: 1, marginLeft: 12 },
  headerTitleText: { fontSize: 18, fontWeight: '600', color: '#171717' },
  headerSubtitle: { fontSize: 13, color: colors.gray, marginTop: 2 },
  inviteButton: { backgroundColor: colors.primary, padding: 10, borderRadius: 10 },
  listContent: { padding: 16 },
  sectionTitle: { fontSize: 14, fontWeight: '600', color: colors.gray, marginBottom: 12 },
  memberCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.white, padding: 14, borderRadius: 12, marginBottom: 10, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 2, elevation: 1 },
  memberAvatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.primaryLight, justifyContent: 'center', alignItems: 'center' },
  avatarText: { fontSize: 18, fontWeight: '600', color: colors.white },
  memberInfo: { flex: 1, marginLeft: 12 },
  memberName: { fontSize: 15, fontWeight: '500', color: '#171717' },
  memberEmail: { fontSize: 13, color: colors.gray, marginTop: 2 },
  memberJoined: { fontSize: 12, color: colors.gray, marginTop: 2 },
  memberBadge: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  memberRole: { fontSize: 12, color: colors.gray },
  memberRoleCoord: { color: colors.warning, fontWeight: '500' },
  emptyContainer: { alignItems: 'center', paddingVertical: 40 },
  emptyText: { fontSize: 14, color: colors.gray, marginTop: 12 },
  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: colors.white, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, maxHeight: '80%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  modalTitle: { fontSize: 20, fontWeight: '600', color: '#171717' },
  label: { fontSize: 14, fontWeight: '600', color: '#374151', marginBottom: 8, marginTop: 16 },
  input: { backgroundColor: colors.lightGray, borderRadius: 12, padding: 14, fontSize: 16, borderWidth: 1, borderColor: colors.border },
  textArea: { minHeight: 80, textAlignVertical: 'top' },
  searchLoader: { marginTop: 12 },
  searchResults: { marginTop: 12, maxHeight: 200 },
  searchResultItem: { flexDirection: 'row', alignItems: 'center', padding: 12, borderBottomWidth: 1, borderBottomColor: colors.border },
  searchResultAvatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.primaryLight, justifyContent: 'center', alignItems: 'center' },
  searchResultInfo: { flex: 1, marginLeft: 12 },
  searchResultName: { fontSize: 15, fontWeight: '500', color: '#171717' },
  searchResultEmail: { fontSize: 13, color: colors.gray },
  roleOptions: { flexDirection: 'row', gap: 12 },
  roleOption: { flex: 1, padding: 14, borderRadius: 12, borderWidth: 2, borderColor: colors.border, alignItems: 'center' },
  roleOptionActive: { borderColor: colors.primary, backgroundColor: '#eff6ff' },
  roleOptionText: { fontSize: 15, fontWeight: '500', color: colors.gray },
  roleOptionTextActive: { color: colors.primary },
  // Actions Modal
  actionsModal: { backgroundColor: colors.white, margin: 20, borderRadius: 16, padding: 20 },
  actionsTitle: { fontSize: 18, fontWeight: '600', color: '#171717', textAlign: 'center' },
  actionsSubtitle: { fontSize: 14, color: colors.gray, textAlign: 'center', marginBottom: 20 },
  actionButton: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16, borderRadius: 12, backgroundColor: colors.lightGray, marginBottom: 10 },
  actionButtonText: { fontSize: 15, fontWeight: '500', color: colors.primary },
  actionButtonDanger: { backgroundColor: '#fef2f2' },
  actionButtonTextDanger: { color: colors.error },
  cancelButton: { padding: 16, alignItems: 'center' },
  cancelButtonText: { fontSize: 15, color: colors.gray },
});
