/**
 * Community Screen
 * ================
 * Exibe a árvore organizacional e permite criar novas entidades.
 */

import { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Alert,
  Modal,
  TextInput,
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
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
};

interface OrgUnit {
  id: string;
  type: string;
  group_type: string | null;
  name: string;
  slug: string;
  description: string | null;
  visibility: string;
  is_active: boolean;
  parent_id: string | null;
  created_at: string;
  children: OrgUnit[];
  member_count: number;
}

interface TreeResponse {
  root: OrgUnit | null;
}

interface Membership {
  id: string;
  org_unit_id: string;
  org_unit_name: string;
  org_unit_type: string;
  role: string;
  joined_at: string;
}

const TYPE_ICONS: Record<string, string> = {
  CONSELHO_GERAL: '🏛️',
  CONSELHO_EXECUTIVO: '⚙️',
  SETOR: '📂',
  MINISTERIO: '⛪',
  GRUPO: '👥',
};

const TYPE_LABELS: Record<string, string> = {
  CONSELHO_GERAL: 'Conselho Geral',
  CONSELHO_EXECUTIVO: 'Conselho Executivo',
  SETOR: 'Setor',
  MINISTERIO: 'Ministério',
  GRUPO: 'Grupo',
};

const GROUP_TYPE_LABELS: Record<string, string> = {
  ACOLHIDA: 'Grupo de Acolhida',
  APROFUNDAMENTO: 'Grupo de Aprofundamento',
  VOCACIONAL: 'Grupo Vocacional',
  CASAIS: 'Grupo de Casais',
  CURSO: 'Curso',
  PROJETO: 'Projeto',
};

const CHILD_TYPE_OPTIONS: Record<string, { label: string; value: string; groupType?: string }[]> = {
  CONSELHO_GERAL: [
    { label: 'Conselho Executivo', value: 'CONSELHO_EXECUTIVO' },
  ],
  CONSELHO_EXECUTIVO: [
    { label: 'Setor', value: 'SETOR' },
  ],
  SETOR: [
    { label: 'Ministério', value: 'MINISTERIO' },
    { label: 'Grupo de Acolhida', value: 'GRUPO', groupType: 'ACOLHIDA' },
    { label: 'Grupo de Aprofundamento', value: 'GRUPO', groupType: 'APROFUNDAMENTO' },
    { label: 'Grupo Vocacional', value: 'GRUPO', groupType: 'VOCACIONAL' },
    { label: 'Grupo de Casais', value: 'GRUPO', groupType: 'CASAIS' },
    { label: 'Curso', value: 'GRUPO', groupType: 'CURSO' },
    { label: 'Projeto', value: 'GRUPO', groupType: 'PROJETO' },
  ],
  MINISTERIO: [
    { label: 'Grupo de Acolhida', value: 'GRUPO', groupType: 'ACOLHIDA' },
    { label: 'Grupo de Aprofundamento', value: 'GRUPO', groupType: 'APROFUNDAMENTO' },
    { label: 'Grupo Vocacional', value: 'GRUPO', groupType: 'VOCACIONAL' },
    { label: 'Grupo de Casais', value: 'GRUPO', groupType: 'CASAIS' },
    { label: 'Curso', value: 'GRUPO', groupType: 'CURSO' },
    { label: 'Projeto', value: 'GRUPO', groupType: 'PROJETO' },
  ],
};

export default function CommunityScreen() {
  const [tree, setTree] = useState<OrgUnit | null>(null);
  const [myMemberships, setMyMemberships] = useState<Membership[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  
  // Modal de detalhes
  const [selectedUnit, setSelectedUnit] = useState<OrgUnit | null>(null);
  const [showDetails, setShowDetails] = useState(false);
  
  // Modal de criação
  const [showCreate, setShowCreate] = useState(false);
  const [parentUnit, setParentUnit] = useState<OrgUnit | null>(null);
  const [createForm, setCreateForm] = useState({
    name: '',
    description: '',
    visibility: 'PUBLIC',
    selectedType: '',
  });
  const [isCreating, setIsCreating] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const [treeData, membershipsData] = await Promise.all([
        api.get<TreeResponse>('/org/tree'),
        api.get<Membership[]>('/org/my/memberships'),
      ]);
      
      setTree(treeData.root);
      setMyMemberships(membershipsData);
      
      if (treeData.root) {
        const initialExpanded = new Set<string>([treeData.root.id]);
        treeData.root.children.forEach(child => {
          initialExpanded.add(child.id);
        });
        setExpandedIds(initialExpanded);
      }
    } catch (err) {
      console.error('Erro ao carregar árvore:', err);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleRefresh = () => {
    setIsRefreshing(true);
    loadData();
  };

  const toggleExpand = (id: string) => {
    setExpandedIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  };

  const isCoordinator = (unitId: string) => {
    return myMemberships.some(
      m => m.org_unit_id === unitId && m.role === 'COORDINATOR'
    );
  };

  const isMember = (unitId: string) => {
    return myMemberships.some(m => m.org_unit_id === unitId);
  };

  const handleUnitPress = (unit: OrgUnit) => {
    setSelectedUnit(unit);
    setShowDetails(true);
  };

  const openCreateModal = (parent: OrgUnit) => {
    setParentUnit(parent);
    setCreateForm({ name: '', description: '', visibility: 'PUBLIC', selectedType: '' });
    setShowDetails(false);
    setShowCreate(true);
  };

  const handleCreate = async () => {
    if (!parentUnit || !createForm.name.trim() || !createForm.selectedType) {
      Alert.alert('Atenção', 'Preencha o nome e selecione o tipo');
      return;
    }

    const selectedOption = CHILD_TYPE_OPTIONS[parentUnit.type]?.find(
      opt => `${opt.value}-${opt.groupType || ''}` === createForm.selectedType
    );

    if (!selectedOption) {
      Alert.alert('Erro', 'Tipo inválido');
      return;
    }

    try {
      setIsCreating(true);

      await api.post(`/org/units/${parentUnit.id}/children`, {
        name: createForm.name.trim(),
        description: createForm.description.trim() || null,
        visibility: createForm.visibility,
        group_type: selectedOption.groupType || null,
      });

      Alert.alert('Sucesso!', 'Entidade criada com sucesso!');
      setShowCreate(false);
      loadData();
    } catch (err: any) {
      const message = err.response?.data?.detail?.message || 'Erro ao criar entidade';
      Alert.alert('Erro', message);
    } finally {
      setIsCreating(false);
    }
  };

  const renderUnit = (unit: OrgUnit, level: number = 0) => {
    const isExpanded = expandedIds.has(unit.id);
    const hasChildren = unit.children && unit.children.length > 0;
    const isCoord = isCoordinator(unit.id);
    const isMemberOfUnit = isMember(unit.id);
    const icon = TYPE_ICONS[unit.type] || '📁';
    const typeLabel = unit.group_type 
      ? GROUP_TYPE_LABELS[unit.group_type] || unit.group_type
      : TYPE_LABELS[unit.type] || unit.type;

    return (
      <View key={unit.id}>
        <TouchableOpacity
          style={[
            styles.unitRow,
            { marginLeft: level * 16 },
            isMemberOfUnit && styles.unitRowMember,
          ]}
          onPress={() => handleUnitPress(unit)}
        >
          {hasChildren ? (
            <TouchableOpacity
              style={styles.expandButton}
              onPress={() => toggleExpand(unit.id)}
            >
              <Ionicons
                name={isExpanded ? 'chevron-down' : 'chevron-forward'}
                size={18}
                color={colors.gray}
              />
            </TouchableOpacity>
          ) : (
            <View style={styles.expandPlaceholder} />
          )}

          <Text style={styles.unitIcon}>{icon}</Text>

          <View style={styles.unitInfo}>
            <Text style={styles.unitName} numberOfLines={1}>{unit.name}</Text>
            <Text style={styles.unitType}>{typeLabel}</Text>
          </View>

          <View style={styles.badges}>
            {isCoord && (
              <View style={styles.coordBadge}>
                <Ionicons name="star" size={12} color={colors.white} />
              </View>
            )}
            {unit.visibility === 'RESTRICTED' && (
              <Ionicons name="lock-closed" size={14} color={colors.gray} />
            )}
            <Text style={styles.memberCount}>{unit.member_count}</Text>
            <Ionicons name="people" size={14} color={colors.gray} />
          </View>
        </TouchableOpacity>

        {hasChildren && isExpanded && (
          <View>
            {unit.children.map(child => renderUnit(child, level + 1))}
          </View>
        )}
      </View>
    );
  };

  const renderDetailsModal = () => {
    if (!selectedUnit) return null;

    const isCoord = isCoordinator(selectedUnit.id);
    const isMemberOfUnit = isMember(selectedUnit.id);
    const typeLabel = selectedUnit.group_type
      ? GROUP_TYPE_LABELS[selectedUnit.group_type]
      : TYPE_LABELS[selectedUnit.type];
    const canCreateChild = isCoord && selectedUnit.type !== 'GRUPO';

    return (
      <Modal
        visible={showDetails}
        animationType="slide"
        transparent
        onRequestClose={() => setShowDetails(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalIcon}>{TYPE_ICONS[selectedUnit.type]}</Text>
              <View style={styles.modalTitleContainer}>
                <Text style={styles.modalTitle}>{selectedUnit.name}</Text>
                <Text style={styles.modalSubtitle}>{typeLabel}</Text>
              </View>
              <TouchableOpacity style={styles.closeButton} onPress={() => setShowDetails(false)}>
                <Ionicons name="close" size={24} color={colors.gray} />
              </TouchableOpacity>
            </View>

            <View style={styles.modalInfo}>
              {selectedUnit.description && (
                <Text style={styles.description}>{selectedUnit.description}</Text>
              )}
              
              <View style={styles.infoRow}>
                <Ionicons name="people" size={18} color={colors.primary} />
                <Text style={styles.infoText}>
                  {selectedUnit.member_count} membro{selectedUnit.member_count !== 1 ? 's' : ''}
                </Text>
              </View>

              <View style={styles.infoRow}>
                <Ionicons
                  name={selectedUnit.visibility === 'PUBLIC' ? 'globe' : 'lock-closed'}
                  size={18}
                  color={colors.primary}
                />
                <Text style={styles.infoText}>
                  {selectedUnit.visibility === 'PUBLIC' ? 'Público' : 'Restrito'}
                </Text>
              </View>

              {isMemberOfUnit && (
                <View style={[styles.infoRow, styles.memberBadgeRow]}>
                  <Ionicons name="checkmark-circle" size={18} color={colors.success} />
                  <Text style={[styles.infoText, { color: colors.success }]}>
                    {isCoord ? 'Você é coordenador' : 'Você é membro'}
                  </Text>
                </View>
              )}
            </View>

            <View style={styles.modalActions}>
              {canCreateChild && (
                <TouchableOpacity
                  style={styles.primaryButton}
                  onPress={() => openCreateModal(selectedUnit)}
                >
                  <Ionicons name="add" size={20} color={colors.white} />
                  <Text style={styles.primaryButtonText}>Criar Entidade Filha</Text>
                </TouchableOpacity>
              )}

              {isCoord && (
                <TouchableOpacity 
                  style={styles.secondaryButton}
                  onPress={() => {
                    setShowDetails(false);
                    router.push({
                      pathname: '/members',
                      params: { 
                        org_unit_id: selectedUnit.id,
                        org_unit_name: selectedUnit.name,
                      },
                    });
                  }}
                >
                  <Ionicons name="people" size={20} color={colors.primary} />
                  <Text style={styles.secondaryButtonText}>Gerenciar Membros</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        </View>
      </Modal>
    );
  };

  const renderCreateModal = () => {
    if (!parentUnit) return null;

    const options = CHILD_TYPE_OPTIONS[parentUnit.type] || [];

    return (
      <Modal
        visible={showCreate}
        animationType="slide"
        transparent
        onRequestClose={() => setShowCreate(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalIcon}>➕</Text>
              <View style={styles.modalTitleContainer}>
                <Text style={styles.modalTitle}>Nova Entidade</Text>
                <Text style={styles.modalSubtitle}>Filha de "{parentUnit.name}"</Text>
              </View>
              <TouchableOpacity style={styles.closeButton} onPress={() => setShowCreate(false)}>
                <Ionicons name="close" size={24} color={colors.gray} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.formContainer}>
              <Text style={styles.label}>Tipo *</Text>
              <View style={styles.picker}>
                <Picker
                  selectedValue={createForm.selectedType}
                  onValueChange={(v) => setCreateForm(f => ({ ...f, selectedType: v }))}
                >
                  <Picker.Item label="Selecione o tipo..." value="" />
                  {options.map((opt, idx) => (
                    <Picker.Item
                      key={idx}
                      label={opt.label}
                      value={`${opt.value}-${opt.groupType || ''}`}
                    />
                  ))}
                </Picker>
              </View>

              <Text style={styles.label}>Nome *</Text>
              <TextInput
                style={styles.input}
                placeholder="Nome da entidade"
                value={createForm.name}
                onChangeText={(v) => setCreateForm(f => ({ ...f, name: v }))}
                placeholderTextColor={colors.gray}
              />

              <Text style={styles.label}>Descrição</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                placeholder="Descrição (opcional)"
                value={createForm.description}
                onChangeText={(v) => setCreateForm(f => ({ ...f, description: v }))}
                multiline
                numberOfLines={3}
                placeholderTextColor={colors.gray}
              />

              <Text style={styles.label}>Visibilidade</Text>
              <View style={styles.visibilityOptions}>
                <TouchableOpacity
                  style={[
                    styles.visibilityOption,
                    createForm.visibility === 'PUBLIC' && styles.visibilityOptionActive,
                  ]}
                  onPress={() => setCreateForm(f => ({ ...f, visibility: 'PUBLIC' }))}
                >
                  <Ionicons name="globe" size={20} color={createForm.visibility === 'PUBLIC' ? colors.white : colors.primary} />
                  <Text style={[
                    styles.visibilityOptionText,
                    createForm.visibility === 'PUBLIC' && styles.visibilityOptionTextActive,
                  ]}>Público</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.visibilityOption,
                    createForm.visibility === 'RESTRICTED' && styles.visibilityOptionActive,
                  ]}
                  onPress={() => setCreateForm(f => ({ ...f, visibility: 'RESTRICTED' }))}
                >
                  <Ionicons name="lock-closed" size={20} color={createForm.visibility === 'RESTRICTED' ? colors.white : colors.primary} />
                  <Text style={[
                    styles.visibilityOptionText,
                    createForm.visibility === 'RESTRICTED' && styles.visibilityOptionTextActive,
                  ]}>Restrito</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.formActions}>
                <TouchableOpacity
                  style={[styles.primaryButton, isCreating && styles.buttonDisabled]}
                  onPress={handleCreate}
                  disabled={isCreating}
                >
                  {isCreating ? (
                    <ActivityIndicator color={colors.white} />
                  ) : (
                    <>
                      <Ionicons name="checkmark" size={20} color={colors.white} />
                      <Text style={styles.primaryButtonText}>Criar</Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    );
  };

  const renderEmpty = () => (
    <View style={styles.emptyContainer}>
      <Ionicons name="git-network-outline" size={64} color={colors.gray} />
      <Text style={styles.emptyTitle}>Estrutura não encontrada</Text>
      <Text style={styles.emptyText}>
        A árvore organizacional ainda não foi criada.
      </Text>
    </View>
  );

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Carregando estrutura...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} colors={[colors.primary]} />
        }
      >
        <View style={styles.legend}>
          <View style={styles.legendItem}>
            <View style={styles.coordBadge}>
              <Ionicons name="star" size={10} color={colors.white} />
            </View>
            <Text style={styles.legendText}>Coordenador</Text>
          </View>
          <View style={styles.legendItem}>
            <Ionicons name="lock-closed" size={14} color={colors.gray} />
            <Text style={styles.legendText}>Restrito</Text>
          </View>
        </View>

        {tree ? (
          <View style={styles.treeContainer}>
            {renderUnit(tree)}
          </View>
        ) : (
          renderEmpty()
        )}

        {myMemberships.length > 0 && (
          <View style={styles.summarySection}>
            <Text style={styles.summaryTitle}>📋 Meus Vínculos</Text>
            {myMemberships.map(m => (
              <View key={m.id} style={styles.summaryItem}>
                <Text style={styles.summaryName}>{m.org_unit_name}</Text>
                <Text style={styles.summaryRole}>
                  {m.role === 'COORDINATOR' ? '⭐ Coordenador' : 'Membro'}
                </Text>
              </View>
            ))}
          </View>
        )}
      </ScrollView>

      {renderDetailsModal()}
      {renderCreateModal()}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background },
  loadingText: { marginTop: 12, fontSize: 16, color: colors.gray },
  scrollView: { flex: 1 },
  scrollContent: { padding: 16, paddingBottom: 32 },
  legend: { flexDirection: 'row', gap: 16, marginBottom: 16, paddingHorizontal: 8 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendText: { fontSize: 12, color: colors.gray },
  treeContainer: { backgroundColor: colors.white, borderRadius: 16, padding: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 },
  unitRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, paddingHorizontal: 8, borderRadius: 8 },
  unitRowMember: { backgroundColor: '#f0fdf4' },
  expandButton: { width: 24, height: 24, justifyContent: 'center', alignItems: 'center' },
  expandPlaceholder: { width: 24 },
  unitIcon: { fontSize: 20, marginRight: 10 },
  unitInfo: { flex: 1 },
  unitName: { fontSize: 15, fontWeight: '500', color: '#171717' },
  unitType: { fontSize: 12, color: colors.gray, marginTop: 1 },
  badges: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  coordBadge: { backgroundColor: colors.primary, borderRadius: 10, width: 18, height: 18, justifyContent: 'center', alignItems: 'center' },
  memberCount: { fontSize: 12, color: colors.gray },
  summarySection: { marginTop: 24, backgroundColor: colors.white, borderRadius: 16, padding: 16 },
  summaryTitle: { fontSize: 16, fontWeight: '600', color: '#171717', marginBottom: 12 },
  summaryItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors.border },
  summaryName: { fontSize: 14, color: '#374151' },
  summaryRole: { fontSize: 13, color: colors.primary },
  emptyContainer: { alignItems: 'center', paddingVertical: 60, paddingHorizontal: 40 },
  emptyTitle: { fontSize: 18, fontWeight: '600', color: '#374151', marginTop: 16, marginBottom: 8 },
  emptyText: { fontSize: 14, color: colors.gray, textAlign: 'center', lineHeight: 20 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: colors.white, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, maxHeight: '85%' },
  modalHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 20 },
  modalIcon: { fontSize: 32, marginRight: 12 },
  modalTitleContainer: { flex: 1 },
  modalTitle: { fontSize: 20, fontWeight: '600', color: '#171717' },
  modalSubtitle: { fontSize: 14, color: colors.gray, marginTop: 2 },
  closeButton: { padding: 8 },
  modalInfo: { marginBottom: 24 },
  description: { fontSize: 15, color: '#374151', lineHeight: 22, marginBottom: 16 },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  infoText: { fontSize: 15, color: '#374151' },
  memberBadgeRow: { backgroundColor: '#f0fdf4', padding: 10, borderRadius: 8, marginTop: 8 },
  modalActions: { gap: 12 },
  primaryButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: colors.primary, padding: 16, borderRadius: 12 },
  primaryButtonText: { fontSize: 16, fontWeight: '600', color: colors.white },
  secondaryButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: colors.lightGray, padding: 14, borderRadius: 12 },
  secondaryButtonText: { fontSize: 15, fontWeight: '500', color: colors.primary },
  buttonDisabled: { opacity: 0.6 },
  formContainer: { maxHeight: 400 },
  label: { fontSize: 14, fontWeight: '600', color: '#374151', marginBottom: 8, marginTop: 16 },
  input: { backgroundColor: colors.lightGray, borderRadius: 12, padding: 16, fontSize: 16, borderWidth: 1, borderColor: colors.border, color: '#171717' },
  textArea: { minHeight: 80, textAlignVertical: 'top' },
  picker: { backgroundColor: colors.lightGray, borderRadius: 12, borderWidth: 1, borderColor: colors.border, overflow: 'hidden' },
  visibilityOptions: { flexDirection: 'row', gap: 12 },
  visibilityOption: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, padding: 14, borderRadius: 12, borderWidth: 2, borderColor: colors.primary },
  visibilityOptionActive: { backgroundColor: colors.primary },
  visibilityOptionText: { fontSize: 15, fontWeight: '500', color: colors.primary },
  visibilityOptionTextActive: { color: colors.white },
  formActions: { marginTop: 24, marginBottom: 16 },
});
