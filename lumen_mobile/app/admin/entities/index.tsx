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
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { IoniconsName } from '@/types/icons';
import { orgService, orgAdminService } from '@/services';
import api from '@/services/api';
import type { Membership } from '@/types';

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

interface EditModalState {
  visible: boolean;
  unit: OrgUnitNode | null;
}

interface ProfileModalState {
  visible: boolean;
  unit: OrgUnitNode | null;
  canEdit: boolean;
}

interface MemberItem {
  user_id: string;
  user_name: string;
  user_email: string | null;
  role: string; // 'COORDINATOR' | 'MEMBER'
  status: string;
  joined_at: string;
}

// =============================================================================
// Helpers de permissão client-side
// =============================================================================

/** Verifica se `unit` é descendente de `ancestorId` percorrendo a árvore. */
function isDescendantOf(unit: OrgUnitNode, ancestorId: string, root: OrgUnitNode | null): boolean {
  if (!root || !unit.parent_id) return false;
  function findParent(node: OrgUnitNode, targetId: string): OrgUnitNode | null {
    if (node.id === targetId) return node;
    for (const child of node.children) {
      const found = findParent(child, targetId);
      if (found) return found;
    }
    return null;
  }
  // Sobe a árvore a partir do parent_id de `unit`
  let currentId: string | null | undefined = unit.parent_id;
  while (currentId) {
    if (currentId === ancestorId) return true;
    const parent = findParent(root, currentId);
    currentId = parent?.parent_id;
  }
  return false;
}

// =============================================================================
// Componente principal
// =============================================================================
export default function EntitiesScreen() {
  const [tree, setTree] = useState<OrgUnitNode | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Permissões de edição
  const [isGlobalAdmin, setIsGlobalAdmin] = useState(false);
  const [myCoordMemberships, setMyCoordMemberships] = useState<Membership[]>([]);

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

  const [editModal, setEditModal] = useState<EditModalState>({
    visible: false,
    unit: null,
  });

  const [profileModal, setProfileModal] = useState<ProfileModalState>({
    visible: false,
    unit: null,
    canEdit: false,
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

  const loadPermissions = useCallback(async () => {
    // Chamadas separadas: se uma falhar, a outra ainda é processada.
    // Importante: se getMyMemberships() falhar, isGlobalAdmin ainda é definido
    // corretamente (DEV/ADMIN vêem o botão Editar mesmo sem memberships).
    try {
      const perms = await api.get<{ has_admin_access: boolean }>('/inbox/permissions');
      setIsGlobalAdmin(perms.has_admin_access || false);
    } catch {
      // sem acesso admin por padrão
    }

    try {
      const memberships = await orgService.getMyMemberships();
      setMyCoordMemberships(
        (memberships as Membership[]).filter((m) => m.role === 'COORDINATOR' && m.status === 'ACTIVE')
      );
    } catch {
      // sem memberships de coordenação por padrão
    }
  }, []);

  useEffect(() => {
    setLoading(true);
    Promise.all([loadTree(), loadPermissions()]).finally(() => setLoading(false));
  }, [loadTree, loadPermissions]);

  /** Verifica se o usuário atual pode editar a unidade. */
  const canEditUnit = useCallback((unit: OrgUnitNode): boolean => {
    if (isGlobalAdmin) return true;
    for (const m of myCoordMemberships) {
      if (m.org_unit_type === 'CONSELHO_GERAL') return true;
      if (m.org_unit_type === 'CONSELHO_EXECUTIVO' &&
          ['SETOR', 'MINISTERIO', 'GRUPO'].includes(unit.type)) return true;
      if (m.org_unit_type === 'SETOR' &&
          ['MINISTERIO', 'GRUPO'].includes(unit.type) &&
          isDescendantOf(unit, m.org_unit_id, tree)) return true;
    }
    return false;
  }, [isGlobalAdmin, myCoordMemberships, tree]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([loadTree(), loadPermissions()]);
    setRefreshing(false);
  }, [loadTree, loadPermissions]);

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
            <Ionicons name={icon as IoniconsName} size={20} color={colors.admin} />
          </View>
          <View style={styles.unitInfo}>
            <Text style={styles.unitName}>{unit.name}</Text>
            <Text style={styles.unitType}>{label} · {unit.member_count} membro{unit.member_count !== 1 ? 's' : ''}</Text>
          </View>
        </View>

        <View style={styles.unitActions}>
          {/* Ver membros */}
          <TouchableOpacity
            style={styles.actionBtn}
            onPress={() => setProfileModal({ visible: true, unit, canEdit: canEditUnit(unit) })}
          >
            <Ionicons name="people-outline" size={14} color={colors.primary} />
            <Text style={[styles.actionBtnText, { color: colors.primary }]}>Membros</Text>
          </TouchableOpacity>

          {/* Convidar membro */}
          <TouchableOpacity
            style={styles.actionBtn}
            onPress={() => setInviteModal({ visible: true, orgUnitId: unit.id, orgUnitName: unit.name })}
          >
            <Ionicons name="person-add-outline" size={14} color={colors.primary} />
            <Text style={[styles.actionBtnText, { color: colors.primary }]}>Convidar</Text>
          </TouchableOpacity>

          {/* Editar */}
          {canEditUnit(unit) && (
            <TouchableOpacity
              style={styles.actionBtn}
              onPress={() => setEditModal({ visible: true, unit })}
            >
              <Ionicons name="pencil-outline" size={14} color={colors.admin} />
              <Text style={[styles.actionBtnText, { color: colors.admin }]}>Editar</Text>
            </TouchableOpacity>
          )}

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
              <Text style={styles.createRootBtnText}>Criar Entidade</Text>
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

      {/* Modal de edição */}
      <EditEntityModal
        state={editModal}
        onClose={() => setEditModal({ visible: false, unit: null })}
        onSuccess={() => {
          setEditModal({ visible: false, unit: null });
          loadTree();
        }}
      />

      {/* Modal de perfil / membros */}
      <EntityProfileModal
        state={profileModal}
        onClose={() => setProfileModal({ visible: false, unit: null, canEdit: false })}
        onMembersChanged={() => loadTree()}
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
  const [formError, setFormError] = useState<string | null>(null);

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
    setFormError(null);
    if (!name.trim()) {
      setFormError('Informe o nome da entidade.');
      return;
    }
    if ((childType === 'GRUPO') && !groupType) {
      setFormError('Selecione o tipo de grupo.');
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
      setFormError(msg);
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
            {state.isRoot ? 'Criar Entidade' : `Criar em: ${state.parentName}`}
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

        {formError && (
          <Text style={[styles.errorText, { paddingHorizontal: 16, paddingBottom: 4 }]}>
            {formError}
          </Text>
        )}

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
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [inviteSuccess, setInviteSuccess] = useState<string | null>(null);

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
    setInviteError(null);
    setSending(true);
    try {
      await orgAdminService.sendInvite(state.orgUnitId, {
        user_id: selectedUser.id,
        role,
        message: message.trim() || undefined,
      });
      setInviteSuccess(`Convite enviado para ${selectedUser.name}!`);
      setTimeout(() => { setInviteSuccess(null); onClose(); }, 1500);
    } catch (e: any) {
      const msg = e?.response?.data?.detail?.message ?? 'Erro ao enviar convite';
      setInviteError(msg);
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

        {inviteSuccess && (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12, backgroundColor: '#dcfce7', margin: 12, borderRadius: 10 }}>
            <Ionicons name="checkmark-circle" size={20} color="#16a34a" />
            <Text style={{ color: '#16a34a', fontWeight: '600', flex: 1 }}>{inviteSuccess}</Text>
          </View>
        )}
        {inviteError && (
          <Text style={[styles.errorText, { paddingHorizontal: 16, paddingBottom: 4 }]}>{inviteError}</Text>
        )}

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
// Modal de Edição de Unidade
// =============================================================================
function EditEntityModal({
  state,
  onClose,
  onSuccess,
}: {
  state: EditModalState;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (state.visible && state.unit) {
      setName(state.unit.name);
      setDescription(state.unit.description ?? '');
      setError(null);
    }
  }, [state.visible, state.unit]);

  const handleSave = async () => {
    if (!name.trim()) {
      setError('O nome não pode ficar vazio.');
      return;
    }
    if (!state.unit) return;
    setLoading(true);
    setError(null);
    try {
      await orgAdminService.updateUnit(state.unit.id, {
        name: name.trim(),
        description: description.trim() || undefined,
      });
      onSuccess();
    } catch (e: any) {
      const status = e?.response?.status;
      const detail = e?.response?.data?.detail;
      const msg =
        (typeof detail === 'object' ? detail?.message : detail) ??
        (typeof detail === 'string' ? detail : null) ??
        `Erro ao salvar${status ? ` (${status})` : ''}`;
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal visible={state.visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={styles.modalContainer}>
        <View style={styles.modalHeader}>
          <Text style={styles.modalTitle}>Editar: {state.unit?.name}</Text>
          <TouchableOpacity onPress={onClose}>
            <Ionicons name="close" size={24} color={colors.text} />
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.modalBody}>
          <Text style={styles.fieldLabel}>Nome *</Text>
          <TextInput
            style={styles.input}
            value={name}
            onChangeText={(t) => { setName(t); setError(null); }}
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

          {error && (
            <Text style={{ color: colors.danger, fontSize: 13, marginTop: 8 }}>{error}</Text>
          )}
        </ScrollView>

        <View style={styles.modalFooter}>
          <TouchableOpacity style={styles.cancelBtn} onPress={onClose} disabled={loading}>
            <Text style={styles.cancelBtnText}>Cancelar</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.submitBtn} onPress={handleSave} disabled={loading}>
            {loading ? (
              <ActivityIndicator size="small" color={colors.white} />
            ) : (
              <Text style={styles.submitBtnText}>Salvar</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

// =============================================================================
// Modal de Perfil da Entidade (lista de membros)
// =============================================================================
function EntityProfileModal({
  state,
  onClose,
  onMembersChanged,
}: {
  state: ProfileModalState;
  onClose: () => void;
  onMembersChanged: () => void;
}) {
  const [members, setMembers] = useState<MemberItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [memberToRemove, setMemberToRemove] = useState<MemberItem | null>(null);
  const [removeError, setRemoveError] = useState<string | null>(null);

  useEffect(() => {
    if (state.visible && state.unit) {
      loadMembers();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.visible, state.unit?.id]);

  const loadMembers = async () => {
    if (!state.unit) return;
    setLoading(true);
    setError(null);
    try {
      const res = await orgAdminService.getMembers(state.unit.id) as any;
      setMembers(res.members ?? []);
    } catch {
      setError('Erro ao carregar membros');
    } finally {
      setLoading(false);
    }
  };

  const handleChangeRole = async (member: MemberItem, newRole: 'COORDINATOR' | 'MEMBER') => {
    if (!state.unit) return;
    setActionLoading(member.user_id);
    try {
      await orgAdminService.updateMemberRole(state.unit.id, member.user_id, newRole);
      setMembers((prev) =>
        prev.map((m) => (m.user_id === member.user_id ? { ...m, role: newRole } : m))
      );
      onMembersChanged();
    } catch (e: any) {
      const msg = e?.response?.data?.detail?.message ?? 'Erro ao alterar cargo';
      setError(msg);
    } finally {
      setActionLoading(null);
    }
  };

  const handleRemove = (member: MemberItem) => {
    if (!state.unit) return;
    setRemoveError(null);
    setMemberToRemove(member);
  };

  const handleConfirmRemove = async () => {
    if (!memberToRemove || !state.unit) return;
    setActionLoading(memberToRemove.user_id);
    try {
      await orgAdminService.removeMember(state.unit.id, memberToRemove.user_id);
      setMembers((prev) => prev.filter((m) => m.user_id !== memberToRemove.user_id));
      setMemberToRemove(null);
      onMembersChanged();
    } catch (e: any) {
      const msg = e?.response?.data?.detail?.message ?? 'Erro ao remover membro';
      setRemoveError(msg);
    } finally {
      setActionLoading(null);
    }
  };

  const coordinators = members.filter((m) => m.role === 'COORDINATOR');
  const regularMembers = members.filter((m) => m.role === 'MEMBER');
  const unit = state.unit;

  return (
    <Modal visible={state.visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={styles.modalContainer}>
        {/* Header */}
        <View style={styles.modalHeader}>
          <View style={{ flex: 1 }}>
            <Text style={styles.modalTitle}>{unit?.name}</Text>
            {unit && (
              <Text style={{ fontSize: 12, color: colors.gray, marginTop: 2 }}>
                {TYPE_LABELS[unit.type] ?? unit.type}
                {' · '}
                {members.length} membro{members.length !== 1 ? 's' : ''}
              </Text>
            )}
          </View>
          <TouchableOpacity onPress={onClose}>
            <Ionicons name="close" size={24} color={colors.text} />
          </TouchableOpacity>
        </View>

        {/* Conteúdo */}
        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color={colors.admin} />
          </View>
        ) : error ? (
          <View style={[styles.center, { padding: 24 }]}>
            <Ionicons name="alert-circle-outline" size={32} color={colors.danger} />
            <Text style={[styles.errorText, { marginTop: 8 }]}>{error}</Text>
            <TouchableOpacity style={[styles.retryBtn, { marginTop: 12 }]} onPress={loadMembers}>
              <Text style={styles.retryBtnText}>Tentar novamente</Text>
            </TouchableOpacity>
          </View>
        ) : members.length === 0 ? (
          <View style={[styles.center, { padding: 32 }]}>
            <Ionicons name="people-outline" size={44} color={colors.gray} />
            <Text style={{ color: colors.gray, marginTop: 12, textAlign: 'center', fontSize: 14 }}>
              Nenhum membro nesta entidade ainda.
            </Text>
          </View>
        ) : (
          <ScrollView style={styles.modalBody}>
            {/* Coordenação */}
            {coordinators.length > 0 && (
              <>
                <View style={memberStyles.sectionHeader}>
                  <Ionicons name="star" size={13} color={colors.admin} />
                  <Text style={memberStyles.sectionTitle}>
                    Coordenação ({coordinators.length})
                  </Text>
                </View>
                {coordinators.map((m) => (
                  <MemberCard
                    key={m.user_id}
                    member={m}
                    canEdit={state.canEdit}
                    loading={actionLoading === m.user_id}
                    onChangeRole={(role) => handleChangeRole(m, role)}
                    onRemove={() => handleRemove(m)}
                  />
                ))}
              </>
            )}

            {/* Membros */}
            {regularMembers.length > 0 && (
              <>
                <View style={memberStyles.sectionHeader}>
                  <Ionicons name="people-outline" size={13} color={colors.primary} />
                  <Text style={[memberStyles.sectionTitle, { color: colors.primary }]}>
                    Membros ({regularMembers.length})
                  </Text>
                </View>
                {regularMembers.map((m) => (
                  <MemberCard
                    key={m.user_id}
                    member={m}
                    canEdit={state.canEdit}
                    loading={actionLoading === m.user_id}
                    onChangeRole={(role) => handleChangeRole(m, role)}
                    onRemove={() => handleRemove(m)}
                  />
                ))}
              </>
            )}
          </ScrollView>
        )}

        {/* Modal de confirmação de remoção */}
        <Modal
          visible={!!memberToRemove}
          transparent
          animationType="fade"
          onRequestClose={() => { setMemberToRemove(null); setRemoveError(null); }}
        >
          <View style={styles.confirmOverlay}>
            <View style={styles.confirmBox}>
              <View style={[styles.confirmIcon, { backgroundColor: '#fee2e2' }]}>
                <Ionicons name="person-remove-outline" size={28} color={colors.danger} />
              </View>
              <Text style={styles.confirmTitle}>Remover membro</Text>
              <Text style={styles.confirmMsg}>
                Remover <Text style={{ fontWeight: '700' }}>{memberToRemove?.user_name}</Text> de "{state.unit?.name}"?
              </Text>
              {removeError && (
                <Text style={[styles.errorText, { textAlign: 'center', marginBottom: 8 }]}>
                  {removeError}
                </Text>
              )}
              <View style={styles.confirmActions}>
                <TouchableOpacity
                  style={[styles.confirmBtn, styles.confirmBtnCancel]}
                  onPress={() => { setMemberToRemove(null); setRemoveError(null); }}
                >
                  <Text style={styles.confirmBtnCancelText}>Cancelar</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.confirmBtn, { backgroundColor: colors.danger }]}
                  onPress={handleConfirmRemove}
                  disabled={!!actionLoading}
                >
                  {actionLoading ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Text style={styles.confirmBtnText}>Remover</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      </View>
    </Modal>
  );
}

// =============================================================================
// Card de membro individual
// =============================================================================
function MemberCard({
  member,
  canEdit,
  loading,
  onChangeRole,
  onRemove,
}: {
  member: MemberItem;
  canEdit: boolean;
  loading: boolean;
  onChangeRole: (role: 'COORDINATOR' | 'MEMBER') => void;
  onRemove: () => void;
}) {
  const isCoord = member.role === 'COORDINATOR';
  const initial = (member.user_name || member.user_email || '?')[0].toUpperCase();

  return (
    <View style={memberStyles.memberCard}>
      {/* Avatar */}
      <View style={[memberStyles.avatar, isCoord && memberStyles.avatarCoord]}>
        <Text style={memberStyles.avatarText}>{initial}</Text>
      </View>

      {/* Info */}
      <View style={{ flex: 1 }}>
        <Text style={memberStyles.memberName} numberOfLines={1}>{member.user_name}</Text>
        {member.user_email ? (
          <Text style={memberStyles.memberEmail} numberOfLines={1}>{member.user_email}</Text>
        ) : null}
        <View style={memberStyles.roleRow}>
          <View style={[memberStyles.roleBadge, isCoord ? memberStyles.roleBadgeCoord : memberStyles.roleBadgeMember]}>
            <Text style={[memberStyles.roleText, { color: isCoord ? colors.admin : colors.primary }]}>
              {isCoord ? 'Coordenador' : 'Membro'}
            </Text>
          </View>
        </View>
      </View>

      {/* Ações (só para admin) */}
      {canEdit && (
        <View style={memberStyles.actions}>
          {loading ? (
            <ActivityIndicator size="small" color={colors.admin} style={{ marginHorizontal: 8 }} />
          ) : (
            <>
              {/* Promover/rebaixar */}
              <TouchableOpacity
                style={memberStyles.actionIconBtn}
                onPress={() => onChangeRole(isCoord ? 'MEMBER' : 'COORDINATOR')}
              >
                <Ionicons
                  name={isCoord ? 'arrow-down-circle-outline' : 'arrow-up-circle-outline'}
                  size={24}
                  color={isCoord ? colors.gray : colors.admin}
                />
              </TouchableOpacity>
              {/* Remover */}
              <TouchableOpacity style={memberStyles.actionIconBtn} onPress={onRemove}>
                <Ionicons name="person-remove-outline" size={24} color={colors.danger} />
              </TouchableOpacity>
            </>
          )}
        </View>
      )}
    </View>
  );
}

const memberStyles = StyleSheet.create({
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 16,
    marginBottom: 8,
    paddingHorizontal: 2,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.admin,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  memberCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fafafa',
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    gap: 10,
    borderWidth: 1,
    borderColor: colors.lightGray,
  },
  avatar: {
    width: 42, height: 42, borderRadius: 21,
    backgroundColor: colors.primary,
    alignItems: 'center', justifyContent: 'center',
    flexShrink: 0,
  },
  avatarCoord: {
    backgroundColor: colors.admin,
  },
  avatarText: {
    color: colors.white,
    fontWeight: '700',
    fontSize: 17,
  },
  memberName: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },
  memberEmail: {
    fontSize: 12,
    color: colors.gray,
    marginTop: 1,
  },
  roleRow: {
    flexDirection: 'row',
    marginTop: 5,
  },
  roleBadge: {
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderWidth: 1,
  },
  roleBadgeCoord: {
    backgroundColor: colors.adminLight,
    borderColor: colors.admin,
  },
  roleBadgeMember: {
    backgroundColor: '#e0f2fe',
    borderColor: colors.primary,
  },
  roleText: {
    fontSize: 11,
    fontWeight: '600',
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    flexShrink: 0,
  },
  actionIconBtn: {
    padding: 6,
  },
});

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

  // Confirmação de remoção
  confirmOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center', justifyContent: 'center', padding: 24,
  },
  confirmBox: {
    backgroundColor: colors.white, borderRadius: 16,
    padding: 24, width: '100%', maxWidth: 340, alignItems: 'center',
  },
  confirmIcon: {
    width: 56, height: 56, borderRadius: 28,
    alignItems: 'center', justifyContent: 'center', marginBottom: 14,
  },
  confirmTitle: { fontSize: 17, fontWeight: '700', color: colors.text, marginBottom: 8 },
  confirmMsg: { fontSize: 14, color: colors.gray, textAlign: 'center', marginBottom: 20, lineHeight: 20 },
  confirmActions: { flexDirection: 'row', gap: 12, width: '100%' },
  confirmBtn: {
    flex: 1, borderRadius: 10, paddingVertical: 13, alignItems: 'center',
  },
  confirmBtnCancel: { borderWidth: 1.5, borderColor: colors.lightGray },
  confirmBtnCancelText: { color: colors.text, fontWeight: '600', fontSize: 14 },
  confirmBtnText: { color: colors.white, fontWeight: '700', fontSize: 14 },
});
