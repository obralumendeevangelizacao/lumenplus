/**
 * Admin — Entidades
 * =================
 * Gerenciamento da estrutura organizacional:
 * - Cria Conselho Geral (unidade raiz) se não existir
 * - Exibe a árvore de entidades
 * - Permite criar filhos e convidar membros
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Modal,
  ActivityIndicator,
  Alert,
  RefreshControl,
} from 'react-native';
import { Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { orgService, orgAdminService } from '@/services';

const colors = {
  admin: '#7c3aed',
  adminLight: '#ede9fe',
  primary: '#1A859B',
  white: '#ffffff',
  gray: '#6b7280',
  lightGray: '#E8E8E8',
  danger: '#dc2626',
  success: '#16a34a',
  text: '#171717',
};

// Tipos correspondentes ao backend
const TYPE_LABELS: Record<string, string> = {
  CONSELHO_GERAL: 'Conselho Geral',
  CONSELHO_EXECUTIVO: 'Conselho Executivo',
  SETOR: 'Setor',
  MINISTERIO: 'Ministério',
  GRUPO: 'Grupo',
};

const TYPE_ICONS: Record<string, string> = {
  CONSELHO_GERAL: 'shield-checkmark',
  CONSELHO_EXECUTIVO: 'people-circle',
  SETOR: 'layers',
  MINISTERIO: 'home',
  GRUPO: 'person-add',
};

// Hierarquia: qual tipo de filho cada pai pode ter
const CHILD_TYPE: Record<string, string | null> = {
  CONSELHO_GERAL: 'CONSELHO_EXECUTIVO',
  CONSELHO_EXECUTIVO: 'SETOR',
  SETOR: 'MINISTERIO_OU_GRUPO',
  MINISTERIO: 'GRUPO',
  GRUPO: null,
};

const GROUP_TYPES = [
  { value: 'ACOLHIDA', label: 'Acolhida' },
  { value: 'APROFUNDAMENTO', label: 'Aprofundamento' },
  { value: 'VOCACIONAL', label: 'Vocacional' },
  { value: 'CASAIS', label: 'Casais' },
  { value: 'CURSO', label: 'Curso' },
  { value: 'PROJETO', label: 'Projeto' },
];

interface OrgUnitNode {
  id: string;
  type: string;
  name: string;
  slug: string;
  description?: string | null;
  visibility: string;
  is_active: boolean;
  parent_id?: string | null;
  children: OrgUnitNode[];
  member_count: number;
  created_at: string;
}

interface CreateModalState {
  visible: boolean;
  parentId: string | null;
  parentType: string | null;
  parentName: string;
  isRoot: boolean;
}

interface InviteModalState {
  visible: boolean;
  orgUnitId: string;
  orgUnitName: string;
}

// =============================================================================
// Componente principal
// =============================================================================
export default function EntitiesScreen() {
  const [tree, setTree] = useState<OrgUnitNode | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [createModal, setCreateModal] = useState<CreateModalState>({
    visible: false,
    parentId: null,
    parentType: null,
    parentName: '',
    isRoot: false,
  });

  const [inviteModal, setInviteModal] = useState<InviteModalState>({
    visible: false,
    orgUnitId: '',
    orgUnitName: '',
  });

  const loadTree = useCallback(async () => {
    try {
      setError(null);
      const response = await orgService.getTree() as any;
      setTree(response?.root ?? null);
    } catch (e: any) {
      const msg = e?.response?.data?.detail?.message ?? 'Erro ao carregar estrutura';
      setError(msg);
    }
  }, []);

  useEffect(() => {
    setLoading(true);
    loadTree().finally(() => setLoading(false));
  }, [loadTree]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadTree();
    setRefreshing(false);
  }, [loadTree]);

  // ──────────────────────────────────────────────────────────────────────────
  // Renderização da árvore
  // ──────────────────────────────────────────────────────────────────────────
  const renderUnit = (unit: OrgUnitNode, depth: number = 0): React.ReactNode => {
    const icon = TYPE_ICONS[unit.type] ?? 'ellipse';
    const label = TYPE_LABELS[unit.type] ?? unit.type;
    const canHaveChildren = CHILD_TYPE[unit.type] !== null;

    return (
      <View key={unit.id} style={[styles.unitCard, { marginLeft: depth * 12 }]}>
        <View style={styles.unitHeader}>
          <View style={[styles.unitIconBox, { backgroundColor: colors.adminLight }]}>
            <Ionicons name={icon as any} size={20} color={colors.admin} />
          </View>
          <View style={styles.unitInfo}>
            <Text style={styles.unitName}>{unit.name}</Text>
            <Text style={styles.unitType}>{label} · {unit.member_count} membro{unit.member_count !== 1 ? 's' : ''}</Text>
          </View>
        </View>

        <View style={styles.unitActions}>
          {/* Convidar membro */}
          <TouchableOpacity
            style={styles.actionBtn}
            onPress={() => setInviteModal({ visible: true, orgUnitId: unit.id, orgUnitName: unit.name })}
          >
            <Ionicons name="person-add-outline" size={14} color={colors.primary} />
            <Text style={[styles.actionBtnText, { color: colors.primary }]}>Convidar</Text>
          </TouchableOpacity>

          {/* Criar filho */}
          {canHaveChildren && (
            <TouchableOpacity
              style={styles.actionBtn}
              onPress={() =>
                setCreateModal({
                  visible: true,
                  parentId: unit.id,
                  parentType: unit.type,
                  parentName: unit.name,
                  isRoot: false,
                })
              }
            >
              <Ionicons name="add-circle-outline" size={14} color={colors.admin} />
              <Text style={[styles.actionBtnText, { color: colors.admin }]}>Criar filho</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Filhos */}
        {unit.children.map((child) => renderUnit(child, depth + 1))}
      </View>
    );
  };

  // ──────────────────────────────────────────────────────────────────────────
  // Render
  // ──────────────────────────────────────────────────────────────────────────
  return (
    <>
      <Stack.Screen options={{ title: 'Entidades' }} />

      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color={colors.admin} />
            <Text style={styles.loadingText}>Carregando estrutura...</Text>
          </View>
        ) : error ? (
          <View style={styles.errorCard}>
            <Ionicons name="alert-circle-outline" size={32} color={colors.danger} />
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity style={styles.retryBtn} onPress={() => loadTree()}>
              <Text style={styles.retryBtnText}>Tentar novamente</Text>
            </TouchableOpacity>
          </View>
        ) : tree === null ? (
          // Nenhuma unidade raiz
          <View style={styles.emptyCard}>
            <Ionicons name="git-network-outline" size={48} color={colors.admin} />
            <Text style={styles.emptyTitle}>Nenhuma estrutura criada</Text>
            <Text style={styles.emptyDesc}>
              Crie o Conselho Geral para começar a estrutura organizacional da Obra.
            </Text>
            <TouchableOpacity
              style={styles.createRootBtn}
              onPress={() =>
                setCreateModal({
                  visible: true,
                  parentId: null,
                  parentType: null,
                  parentName: '',
                  isRoot: true,
                })
              }
            >
              <Ionicons name="add-circle" size={20} color={colors.white} />
              <Text style={styles.createRootBtnText}>Criar Conselho Geral</Text>
            </TouchableOpacity>
          </View>
        ) : (
          // Árvore existente
          <>
            <View style={styles.treeHeader}>
              <Text style={styles.treeHeaderTitle}>Estrutura Organizacional</Text>
            </View>
            {renderUnit(tree)}
          </>
        )}
      </ScrollView>

      {/* Modal de criação */}
      <CreateUnitModal
        state={createModal}
        onClose={() => setCreateModal((s) => ({ ...s, visible: false }))}
        onSuccess={() => {
          setCreateModal((s) => ({ ...s, visible: false }));
          loadTree();
        }}
      />

      {/* Modal de convite */}
      <InviteModal
        state={inviteModal}
        onClose={() => setInviteModal((s) => ({ ...s, visible: false }))}
      />
    </>
  );
}

// =============================================================================
// Modal de Criação de Unidade
// =============================================================================
function CreateUnitModal({
  state,
  onClose,
  onSuccess,
}: {
  state: CreateModalState;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [groupType, setGroupType] = useState('');
  const [isGrupo, setIsGrupo] = useState(false);
  const [loading, setLoading] = useState(false);

  // Determina o tipo do filho baseado no parent
  const childType = state.isRoot ? 'CONSELHO_GERAL' : (
    state.parentType === 'SETOR' && isGrupo ? 'GRUPO' :
    state.parentType === 'SETOR' ? 'MINISTERIO' :
    state.parentType ? (CHILD_TYPE[state.parentType] === 'MINISTERIO_OU_GRUPO' ? (isGrupo ? 'GRUPO' : 'MINISTERIO') : CHILD_TYPE[state.parentType]) : null
  );

  useEffect(() => {
    if (state.visible) {
      setName('');
      setDescription('');
      setGroupType('');
      setIsGrupo(false);
    }
  }, [state.visible]);

  const handleSubmit = async () => {
    if (!name.trim()) {
      Alert.alert('Campo obrigatório', 'Informe o nome da entidade.');
      return;
    }
    if ((childType === 'GRUPO') && !groupType) {
      Alert.alert('Campo obrigatório', 'Selecione o tipo de grupo.');
      return;
    }

    setLoading(true);
    try {
      if (state.isRoot) {
        await orgAdminService.createRootUnit({ name: name.trim(), description: description.trim() || undefined });
      } else if (state.parentId) {
        const payload: any = { name: name.trim(), description: description.trim() || undefined };
        if (childType === 'GRUPO') payload.group_type = groupType;
        await orgAdminService.createChildUnit(state.parentId, payload);
      }
      onSuccess();
    } catch (e: any) {
      const msg = e?.response?.data?.detail?.message ?? 'Erro ao criar entidade';
      Alert.alert('Erro', msg);
    } finally {
      setLoading(false);
    }
  };

  const canChooseGrupo = state.parentType === 'SETOR';

  return (
    <Modal visible={state.visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={styles.modalContainer}>
        <View style={styles.modalHeader}>
          <Text style={styles.modalTitle}>
            {state.isRoot ? 'Criar Conselho Geral' : `Criar em: ${state.parentName}`}
          </Text>
          <TouchableOpacity onPress={onClose}>
            <Ionicons name="close" size={24} color={colors.text} />
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.modalBody}>
          {!state.isRoot && (
            <Text style={styles.fieldLabel}>
              Tipo: <Text style={{ color: colors.admin, fontWeight: '600' }}>{TYPE_LABELS[childType ?? ''] ?? childType}</Text>
            </Text>
          )}

          {/* Toggle Ministério / Grupo (só quando parent = SETOR) */}
          {canChooseGrupo && (
            <View style={styles.toggleRow}>
              <TouchableOpacity
                style={[styles.toggleBtn, !isGrupo && styles.toggleBtnActive]}
                onPress={() => setIsGrupo(false)}
              >
                <Text style={[styles.toggleBtnText, !isGrupo && styles.toggleBtnTextActive]}>Ministério</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.toggleBtn, isGrupo && styles.toggleBtnActive]}
                onPress={() => setIsGrupo(true)}
              >
                <Text style={[styles.toggleBtnText, isGrupo && styles.toggleBtnTextActive]}>Grupo</Text>
              </TouchableOpacity>
            </View>
          )}

          <Text style={styles.fieldLabel}>Nome *</Text>
          <TextInput
            style={styles.input}
            value={name}
            onChangeText={setName}
            placeholder="Nome da entidade"
            placeholderTextColor={colors.gray}
            maxLength={80}
          />

          <Text style={styles.fieldLabel}>Descrição (opcional)</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            value={description}
            onChangeText={setDescription}
            placeholder="Breve descrição..."
            placeholderTextColor={colors.gray}
            multiline
            numberOfLines={3}
            maxLength={300}
          />

          {/* Tipo de grupo */}
          {childType === 'GRUPO' && (
            <>
              <Text style={styles.fieldLabel}>Tipo de Grupo *</Text>
              <View style={styles.chipRow}>
                {GROUP_TYPES.map((gt) => (
                  <TouchableOpacity
                    key={gt.value}
                    style={[styles.chip, groupType === gt.value && styles.chipActive]}
                    onPress={() => setGroupType(gt.value)}
                  >
                    <Text style={[styles.chipText, groupType === gt.value && styles.chipTextActive]}>
                      {gt.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </>
          )}
        </ScrollView>

        <View style={styles.modalFooter}>
          <TouchableOpacity style={styles.cancelBtn} onPress={onClose} disabled={loading}>
            <Text style={styles.cancelBtnText}>Cancelar</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.submitBtn} onPress={handleSubmit} disabled={loading}>
            {loading ? (
              <ActivityIndicator size="small" color={colors.white} />
            ) : (
              <Text style={styles.submitBtnText}>Criar</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

// =============================================================================
// Modal de Convite
// =============================================================================
function InviteModal({
  state,
  onClose,
}: {
  state: InviteModalState;
  onClose: () => void;
}) {
  const [search, setSearch] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);
  const [selectedUser, setSelectedUser] = useState<any | null>(null);
  const [role, setRole] = useState<'MEMBER' | 'COORDINATOR'>('MEMBER');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (state.visible) {
      setSearch('');
      setSearchResults([]);
      setSelectedUser(null);
      setRole('MEMBER');
      setMessage('');
    }
  }, [state.visible]);

  const handleSearch = async (q: string) => {
    setSearch(q);
    if (q.length < 2) { setSearchResults([]); return; }
    setSearching(true);
    try {
      const results = await orgAdminService.searchUsers(state.orgUnitId, q) as any[];
      setSearchResults(results);
    } catch {
      setSearchResults([]);
    } finally {
      setSearching(false);
    }
  };

  const handleSendInvite = async () => {
    if (!selectedUser) return;
    setSending(true);
    try {
      await orgAdminService.sendInvite(state.orgUnitId, {
        user_id: selectedUser.id,
        role,
        message: message.trim() || undefined,
      });
      Alert.alert('Sucesso', `Convite enviado para ${selectedUser.name}!`);
      onClose();
    } catch (e: any) {
      const msg = e?.response?.data?.detail?.message ?? 'Erro ao enviar convite';
      Alert.alert('Erro', msg);
    } finally {
      setSending(false);
    }
  };

  return (
    <Modal visible={state.visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={styles.modalContainer}>
        <View style={styles.modalHeader}>
          <Text style={styles.modalTitle}>Convidar para: {state.orgUnitName}</Text>
          <TouchableOpacity onPress={onClose}>
            <Ionicons name="close" size={24} color={colors.text} />
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.modalBody} keyboardShouldPersistTaps="handled">
          {!selectedUser ? (
            <>
              <Text style={styles.fieldLabel}>Buscar usuário</Text>
              <View style={styles.searchRow}>
                <Ionicons name="search-outline" size={18} color={colors.gray} style={{ marginRight: 8 }} />
                <TextInput
                  style={styles.searchInput}
                  value={search}
                  onChangeText={handleSearch}
                  placeholder="Nome ou e-mail..."
                  placeholderTextColor={colors.gray}
                  autoFocus
                />
                {searching && <ActivityIndicator size="small" color={colors.admin} />}
              </View>

              {searchResults.map((u) => (
                <TouchableOpacity
                  key={u.id}
                  style={styles.userResult}
                  onPress={() => setSelectedUser(u)}
                >
                  <View style={styles.userAvatar}>
                    <Text style={styles.userAvatarText}>
                      {(u.name ?? u.email ?? '?')[0].toUpperCase()}
                    </Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.userName}>{u.name ?? 'Sem nome'}</Text>
                    <Text style={styles.userEmail}>{u.email}</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={16} color={colors.gray} />
                </TouchableOpacity>
              ))}

              {search.length >= 2 && !searching && searchResults.length === 0 && (
                <Text style={styles.noResults}>Nenhum usuário encontrado</Text>
              )}
            </>
          ) : (
            <>
              {/* Usuário selecionado */}
              <View style={styles.selectedUserCard}>
                <View style={styles.userAvatar}>
                  <Text style={styles.userAvatarText}>
                    {(selectedUser.name ?? selectedUser.email ?? '?')[0].toUpperCase()}
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.userName}>{selectedUser.name ?? 'Sem nome'}</Text>
                  <Text style={styles.userEmail}>{selectedUser.email}</Text>
                </View>
                <TouchableOpacity onPress={() => setSelectedUser(null)}>
                  <Ionicons name="close-circle" size={22} color={colors.gray} />
                </TouchableOpacity>
              </View>

              <Text style={styles.fieldLabel}>Papel</Text>
              <View style={styles.toggleRow}>
                <TouchableOpacity
                  style={[styles.toggleBtn, role === 'MEMBER' && styles.toggleBtnActive]}
                  onPress={() => setRole('MEMBER')}
                >
                  <Text style={[styles.toggleBtnText, role === 'MEMBER' && styles.toggleBtnTextActive]}>Membro</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.toggleBtn, role === 'COORDINATOR' && styles.toggleBtnActive]}
                  onPress={() => setRole('COORDINATOR')}
                >
                  <Text style={[styles.toggleBtnText, role === 'COORDINATOR' && styles.toggleBtnTextActive]}>Coordenador</Text>
                </TouchableOpacity>
              </View>

              <Text style={styles.fieldLabel}>Mensagem (opcional)</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                value={message}
                onChangeText={setMessage}
                placeholder="Escreva uma mensagem para o convite..."
                placeholderTextColor={colors.gray}
                multiline
                numberOfLines={3}
                maxLength={300}
              />
            </>
          )}
        </ScrollView>

        {selectedUser && (
          <View style={styles.modalFooter}>
            <TouchableOpacity style={styles.cancelBtn} onPress={onClose} disabled={sending}>
              <Text style={styles.cancelBtnText}>Cancelar</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.submitBtn} onPress={handleSendInvite} disabled={sending}>
              {sending ? (
                <ActivityIndicator size="small" color={colors.white} />
              ) : (
                <Text style={styles.submitBtnText}>Enviar Convite</Text>
              )}
            </TouchableOpacity>
          </View>
        )}
      </View>
    </Modal>
  );
}

// =============================================================================
// Estilos
// =============================================================================
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.lightGray },
  content: { padding: 16, paddingBottom: 40 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 60 },
  loadingText: { marginTop: 12, color: colors.gray, fontSize: 14 },

  errorCard: {
    backgroundColor: colors.white, borderRadius: 12, padding: 24,
    alignItems: 'center', gap: 12,
  },
  errorText: { color: colors.danger, fontSize: 14, textAlign: 'center' },
  retryBtn: {
    backgroundColor: colors.admin, borderRadius: 8,
    paddingHorizontal: 20, paddingVertical: 10,
  },
  retryBtnText: { color: colors.white, fontWeight: '600' },

  emptyCard: {
    backgroundColor: colors.white, borderRadius: 16, padding: 32,
    alignItems: 'center', gap: 12,
  },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: colors.text },
  emptyDesc: { fontSize: 14, color: colors.gray, textAlign: 'center', lineHeight: 20 },
  createRootBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: colors.admin, borderRadius: 10,
    paddingHorizontal: 20, paddingVertical: 12, marginTop: 8,
  },
  createRootBtnText: { color: colors.white, fontWeight: '700', fontSize: 15 },

  treeHeader: { marginBottom: 12 },
  treeHeaderTitle: { fontSize: 16, fontWeight: '700', color: colors.text },

  unitCard: {
    backgroundColor: colors.white, borderRadius: 12,
    padding: 14, marginBottom: 10,
    borderLeftWidth: 3, borderLeftColor: colors.adminLight,
  },
  unitHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  unitIconBox: {
    width: 36, height: 36, borderRadius: 18,
    alignItems: 'center', justifyContent: 'center', marginRight: 10,
  },
  unitInfo: { flex: 1 },
  unitName: { fontSize: 15, fontWeight: '600', color: colors.text },
  unitType: { fontSize: 12, color: colors.gray, marginTop: 2 },
  unitActions: { flexDirection: 'row', gap: 10, flexWrap: 'wrap' },
  actionBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    borderWidth: 1, borderColor: colors.lightGray,
    borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6,
  },
  actionBtnText: { fontSize: 12, fontWeight: '500' },

  // Modal
  modalContainer: { flex: 1, backgroundColor: colors.white },
  modalHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    padding: 16, borderBottomWidth: 1, borderBottomColor: colors.lightGray,
  },
  modalTitle: { fontSize: 16, fontWeight: '700', color: colors.text, flex: 1, marginRight: 12 },
  modalBody: { flex: 1, padding: 16 },
  modalFooter: {
    flexDirection: 'row', gap: 12, padding: 16,
    borderTopWidth: 1, borderTopColor: colors.lightGray,
  },

  fieldLabel: { fontSize: 13, fontWeight: '600', color: colors.text, marginBottom: 6, marginTop: 12 },
  input: {
    borderWidth: 1, borderColor: colors.lightGray, borderRadius: 10,
    padding: 12, fontSize: 15, color: colors.text, backgroundColor: '#fafafa',
  },
  textArea: { minHeight: 80, textAlignVertical: 'top' },

  toggleRow: { flexDirection: 'row', gap: 10, marginBottom: 4 },
  toggleBtn: {
    flex: 1, borderWidth: 1, borderColor: colors.lightGray,
    borderRadius: 8, paddingVertical: 10, alignItems: 'center',
  },
  toggleBtnActive: { backgroundColor: colors.admin, borderColor: colors.admin },
  toggleBtnText: { fontSize: 14, color: colors.gray, fontWeight: '500' },
  toggleBtnTextActive: { color: colors.white },

  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    borderWidth: 1, borderColor: colors.lightGray, borderRadius: 20,
    paddingHorizontal: 14, paddingVertical: 6,
  },
  chipActive: { backgroundColor: colors.admin, borderColor: colors.admin },
  chipText: { fontSize: 13, color: colors.gray },
  chipTextActive: { color: colors.white, fontWeight: '600' },

  cancelBtn: {
    flex: 1, borderWidth: 2, borderColor: colors.admin,
    borderRadius: 10, paddingVertical: 14, alignItems: 'center',
  },
  cancelBtnText: { color: colors.admin, fontWeight: '700', fontSize: 15 },
  submitBtn: {
    flex: 1, backgroundColor: colors.admin,
    borderRadius: 10, paddingVertical: 14, alignItems: 'center',
  },
  submitBtnText: { color: colors.white, fontWeight: '700', fontSize: 15 },

  // Invite modal
  searchRow: {
    flexDirection: 'row', alignItems: 'center',
    borderWidth: 1, borderColor: colors.lightGray,
    borderRadius: 10, padding: 10, backgroundColor: '#fafafa', marginBottom: 8,
  },
  searchInput: { flex: 1, fontSize: 15, color: colors.text },
  userResult: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#fafafa', borderRadius: 10,
    padding: 12, marginBottom: 8, gap: 10,
  },
  selectedUserCard: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: colors.adminLight, borderRadius: 10,
    padding: 12, gap: 10, marginBottom: 4,
  },
  userAvatar: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: colors.admin, alignItems: 'center', justifyContent: 'center',
  },
  userAvatarText: { color: colors.white, fontWeight: '700', fontSize: 16 },
  userName: { fontSize: 14, fontWeight: '600', color: colors.text },
  userEmail: { fontSize: 12, color: colors.gray },
  noResults: { textAlign: 'center', color: colors.gray, marginTop: 16, fontSize: 14 },
});
