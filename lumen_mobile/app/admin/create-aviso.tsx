/**
 * Create Aviso Screen
 * ===================
 * Tela para criar e enviar avisos.
 * Suporta:
 *  - Envio global (CAN_SEND_INBOX) → "Todos os membros"
 *  - Envio por escopo (coordenador) → seleciona setor/grupo
 *  - Filtros de perfil adicionais (vocacional, civil, UF, cidade)
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
} from 'react-native';
import { router, Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import type { IoniconsName } from '@/types/icons';
import { inboxService } from '@/services';
import type { InboxPreviewResponse, InboxSendResponse, OrgScopeResponse, SendScopesResponse } from '@/types';

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

interface FilterOptions {
  vocational_realities: { code: string; label: string }[];
  life_states: { code: string; label: string }[];
  marital_statuses: { code: string; label: string }[];
  states: string[];
  cities: string[];
}

type MessageType = 'info' | 'warning' | 'success' | 'urgent';

const messageTypes: { type: MessageType; label: string; color: string; icon: string }[] = [
  { type: 'info', label: 'Informativo', color: colors.info, icon: 'information-circle' },
  { type: 'warning', label: 'Atencao', color: colors.warning, icon: 'warning' },
  { type: 'success', label: 'Confirmacao', color: colors.success, icon: 'checkmark-circle' },
  { type: 'urgent', label: 'Urgente', color: colors.error, icon: 'alert-circle' },
];

type DestMode = 'all' | 'scope' | 'filter';

export default function CreateAvisoScreen() {
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState<MessageType>('info');

  // Escopos disponíveis
  const [scopesData, setScopesData] = useState<SendScopesResponse | null>(null);
  const [loadingScopes, setLoadingScopes] = useState(true);

  // Modo de destinatários
  const [destMode, setDestMode] = useState<DestMode>('all');
  const [selectedScope, setSelectedScope] = useState<OrgScopeResponse | null>(null);

  // Filtros de perfil (modo 'filter')
  const [filterOptions, setFilterOptions] = useState<FilterOptions | null>(null);
  const [loadingFilters, setLoadingFilters] = useState(false);
  const [selectedVocational, setSelectedVocational] = useState<string[]>([]);
  const [selectedLifeState, setSelectedLifeState] = useState<string[]>([]);
  const [selectedMarital, setSelectedMarital] = useState<string[]>([]);
  const [selectedStates, setSelectedStates] = useState<string[]>([]);
  const [selectedCities, setSelectedCities] = useState<string[]>([]);

  const [loading, setLoading] = useState(false);
  const [previewCount, setPreviewCount] = useState<number | null>(null);
  const [showScopeModal, setShowScopeModal] = useState(false);
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [activeFilter, setActiveFilter] = useState<string | null>(null);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [sentCount, setSentCount] = useState(0);
  const [sendError, setSendError] = useState<string | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [scopeLoadError, setScopeLoadError] = useState<string | null>(null);

  useEffect(() => {
    loadScopes();
  }, []);

  useEffect(() => {
    if (destMode === 'filter' && !filterOptions) loadFilterOptions();
    updatePreview();
  }, [destMode, selectedScope, selectedVocational, selectedLifeState, selectedMarital, selectedStates, selectedCities]);

  const loadScopes = async () => {
    setLoadingScopes(true);
    try {
      const data = await inboxService.getSendableScopes();
      setScopesData(data);
      // Default: se não pode enviar para todos, mas tem escopos → modo scope
      if (!data.can_send_to_all && data.scopes.length > 0) {
        setDestMode('scope');
        if (data.scopes.length === 1) setSelectedScope(data.scopes[0]);
      }
    } catch (err: any) {
      const msg =
        err?.response?.data?.detail?.message ||
        err?.message ||
        'Sem permissão para enviar avisos.';
      setScopeLoadError(msg);
    } finally {
      setLoadingScopes(false);
    }
  };

  const loadFilterOptions = async () => {
    setLoadingFilters(true);
    try {
      const response = await inboxService.getFilterOptions<FilterOptions>();
      setFilterOptions(response);
    } catch {
      // silencioso — filtros são opcionais
    } finally {
      setLoadingFilters(false);
    }
  };

  const updatePreview = async () => {
    try {
      const filters = buildFilters();
      const payload: any = {
        send_to_all: destMode === 'all',
        scope_org_unit_id: destMode === 'scope' ? selectedScope?.id ?? null : null,
        filters: destMode === 'filter' ? filters : null,
      };
      const response = await inboxService.previewSend(payload);
      setPreviewCount(response.recipient_count);
    } catch {
      setPreviewCount(null);
    }
  };

  const buildFilters = () => {
    const filters: any = {};
    if (selectedVocational.length > 0) filters.vocational_reality_codes = selectedVocational;
    if (selectedLifeState.length > 0) filters.life_state_codes = selectedLifeState;
    if (selectedMarital.length > 0) filters.marital_status_codes = selectedMarital;
    if (selectedStates.length > 0) filters.states = selectedStates;
    if (selectedCities.length > 0) filters.cities = selectedCities;
    return Object.keys(filters).length > 0 ? filters : null;
  };

  const handleSend = async () => {
    setValidationError(null);
    setSendError(null);
    if (!title.trim()) { setValidationError('Digite um titulo para o aviso'); return; }
    if (title.trim().length < 3) { setValidationError('O titulo deve ter pelo menos 3 caracteres'); return; }
    if (!message.trim()) { setValidationError('Digite o texto do aviso'); return; }
    if (message.trim().length < 10) { setValidationError('O texto do aviso deve ter pelo menos 10 caracteres'); return; }
    if (destMode === 'scope' && !selectedScope) { setValidationError('Selecione um setor ou grupo'); return; }
    if (destMode === 'filter' && !buildFilters()) { setValidationError('Selecione pelo menos um filtro'); return; }
    setShowConfirmModal(true);
  };

  const sendAviso = async () => {
    setShowConfirmModal(false);
    setLoading(true);
    setSendError(null);
    try {
      const filters = destMode === 'filter' ? buildFilters() : null;
      const response = await inboxService.send({
        title: title.trim(),
        message: message.trim(),
        type: messageType,
        send_to_all: destMode === 'all',
        scope_org_unit_id: destMode === 'scope' ? (selectedScope?.id ?? null) : null,
        filters,
      });
      setSentCount(response.recipient_count);
      setShowSuccessModal(true);
    } catch (error: any) {
      const raw = error.response?.data?.detail;
      let msg = 'Nao foi possivel enviar o aviso';
      if (typeof raw === 'string') {
        msg = raw;
      } else if (raw?.message) {
        msg = raw.message;
      } else if (Array.isArray(raw) && raw.length > 0) {
        // Erro de validação Pydantic: [{ loc, msg, type }]
        msg = raw[0].msg || msg;
      }
      setSendError(msg);
    } finally {
      setLoading(false);
    }
  };

  const toggleSelection = (item: string, selected: string[], setSelected: (items: string[]) => void) => {
    setSelected(selected.includes(item) ? selected.filter(i => i !== item) : [...selected, item]);
  };

  const openFilter = (filter: string) => {
    setActiveFilter(filter);
    setShowFilterModal(true);
  };

  const getFilterData = () => {
    switch (activeFilter) {
      case 'vocational':
        return { options: filterOptions?.vocational_realities || [], selected: selectedVocational, setSelected: setSelectedVocational, title: 'Realidade Vocacional' };
      case 'lifeState':
        return { options: filterOptions?.life_states || [], selected: selectedLifeState, setSelected: setSelectedLifeState, title: 'Estado de Vida' };
      case 'marital':
        return { options: filterOptions?.marital_statuses || [], selected: selectedMarital, setSelected: setSelectedMarital, title: 'Estado Civil' };
      case 'states':
        return { options: filterOptions?.states.map(s => ({ code: s, label: s })) || [], selected: selectedStates, setSelected: setSelectedStates, title: 'Estado (UF)' };
      case 'cities':
        return { options: filterOptions?.cities.map(c => ({ code: c, label: c })) || [], selected: selectedCities, setSelected: setSelectedCities, title: 'Cidade' };
      default:
        return { options: [], selected: [], setSelected: () => {}, title: '' };
    }
  };

  const filterData = getFilterData();
  const canSendToAll = scopesData?.can_send_to_all ?? false;
  const hasScopes = (scopesData?.scopes.length ?? 0) > 0;

  if (loadingScopes) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.admin} />
      </View>
    );
  }

  if (scopeLoadError) {
    return (
      <>
        <Stack.Screen options={{ title: 'Criar Aviso' }} />
        <View style={styles.loadingContainer}>
          <Ionicons name="lock-closed-outline" size={48} color={colors.error} />
          <Text style={[styles.label, { textAlign: 'center', marginTop: 16, color: colors.error }]}>
            {scopeLoadError}
          </Text>
          <TouchableOpacity
            style={[styles.sendButton, { backgroundColor: colors.gray, marginTop: 24 }]}
            onPress={() => router.back()}
          >
            <Text style={styles.sendButtonText}>Voltar</Text>
          </TouchableOpacity>
        </View>
      </>
    );
  }

  return (
    <>
      <Stack.Screen options={{ title: 'Criar Aviso' }} />

      <ScrollView style={styles.container} contentContainerStyle={styles.content}>

        {/* Tipo */}
        <Text style={styles.label}>Tipo do Aviso</Text>
        <View style={styles.typeContainer}>
          {messageTypes.map((mt) => (
            <TouchableOpacity
              key={mt.type}
              style={[styles.typeButton, messageType === mt.type && { borderColor: mt.color, backgroundColor: `${mt.color}15` }]}
              onPress={() => setMessageType(mt.type)}
            >
              <Ionicons name={mt.icon as IoniconsName} size={20} color={mt.color} />
              <Text style={[styles.typeLabel, { color: messageType === mt.type ? mt.color : colors.gray }]}>{mt.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Titulo */}
        <Text style={styles.label}>Titulo</Text>
        <TextInput
          style={styles.input}
          value={title}
          onChangeText={setTitle}
          placeholder="Ex: Reuniao de Formacao"
          maxLength={200}
        />

        {/* Mensagem */}
        <Text style={styles.label}>Texto do Aviso</Text>
        <TextInput
          style={[styles.input, styles.textArea]}
          value={message}
          onChangeText={setMessage}
          placeholder="Escreva o conteudo..."
          multiline
          numberOfLines={6}
          textAlignVertical="top"
          maxLength={5000}
        />

        {/* Destinatarios */}
        <Text style={styles.label}>Destinatarios</Text>
        <View style={styles.destContainer}>

          {/* Todos os membros (apenas CAN_SEND_INBOX) */}
          {canSendToAll && (
            <TouchableOpacity
              style={[styles.destOption, destMode === 'all' && styles.destOptionActive]}
              onPress={() => setDestMode('all')}
            >
              <Ionicons
                name={destMode === 'all' ? 'radio-button-on' : 'radio-button-off'}
                size={20}
                color={destMode === 'all' ? colors.admin : colors.gray}
              />
              <View style={styles.destTextBlock}>
                <Text style={[styles.destText, destMode === 'all' && styles.destTextActive]}>Todos os membros</Text>
                <Text style={styles.destSubtext}>Envia para toda a comunidade</Text>
              </View>
            </TouchableOpacity>
          )}

          {/* Setor / Grupo (coordenadores) */}
          {hasScopes && (
            <TouchableOpacity
              style={[styles.destOption, destMode === 'scope' && styles.destOptionActive]}
              onPress={() => setDestMode('scope')}
            >
              <Ionicons
                name={destMode === 'scope' ? 'radio-button-on' : 'radio-button-off'}
                size={20}
                color={destMode === 'scope' ? colors.admin : colors.gray}
              />
              <View style={styles.destTextBlock}>
                <Text style={[styles.destText, destMode === 'scope' && styles.destTextActive]}>
                  {selectedScope ? selectedScope.name : 'Setor ou Grupo'}
                </Text>
                <Text style={styles.destSubtext}>
                  {selectedScope
                    ? `${selectedScope.member_count} membro(s)`
                    : 'Selecione um setor ou grupo'}
                </Text>
              </View>
              {destMode === 'scope' && scopesData && scopesData.scopes.length > 1 && (
                <TouchableOpacity onPress={() => setShowScopeModal(true)} style={styles.changeScopeBtn}>
                  <Text style={styles.changeScopeText}>Alterar</Text>
                </TouchableOpacity>
              )}
            </TouchableOpacity>
          )}

          {/* Por filtros de perfil (apenas CAN_SEND_INBOX) */}
          {canSendToAll && (
            <TouchableOpacity
              style={[styles.destOption, destMode === 'filter' && styles.destOptionActive]}
              onPress={() => setDestMode('filter')}
            >
              <Ionicons
                name={destMode === 'filter' ? 'radio-button-on' : 'radio-button-off'}
                size={20}
                color={destMode === 'filter' ? colors.admin : colors.gray}
              />
              <View style={styles.destTextBlock}>
                <Text style={[styles.destText, destMode === 'filter' && styles.destTextActive]}>Segmentado por perfil</Text>
                <Text style={styles.destSubtext}>Filtra por vocacao, estado civil, UF...</Text>
              </View>
            </TouchableOpacity>
          )}
        </View>

        {/* Seletor de escopo inline quando só há 1 escopo */}
        {destMode === 'scope' && !selectedScope && hasScopes && (
          <TouchableOpacity style={styles.pickScopeBtn} onPress={() => setShowScopeModal(true)}>
            <Ionicons name="people" size={20} color={colors.admin} />
            <Text style={styles.pickScopeText}>Escolher setor/grupo</Text>
            <Ionicons name="chevron-forward" size={18} color={colors.admin} />
          </TouchableOpacity>
        )}

        {/* Filtros de perfil (modo filter) */}
        {destMode === 'filter' && (
          <View style={styles.filtersContainer}>
            <Text style={styles.filtersTitle}>Filtros de Segmentacao</Text>
            {loadingFilters ? <ActivityIndicator color={colors.admin} /> : (
              <>
                <FilterBtn label="Realidade Vocacional" count={selectedVocational.length} onPress={() => openFilter('vocational')} />
                <FilterBtn label="Estado de Vida" count={selectedLifeState.length} onPress={() => openFilter('lifeState')} />
                <FilterBtn label="Estado Civil" count={selectedMarital.length} onPress={() => openFilter('marital')} />
                <FilterBtn label="Estado (UF)" count={selectedStates.length} onPress={() => openFilter('states')} />
                <FilterBtn label="Cidade" count={selectedCities.length} onPress={() => openFilter('cities')} />
              </>
            )}
          </View>
        )}

        {/* Preview de destinatarios */}
        {previewCount !== null && (
          <View style={styles.previewBox}>
            <Ionicons name="people" size={20} color={colors.admin} />
            <Text style={styles.previewText}>{previewCount} membro(s) receberao este aviso</Text>
          </View>
        )}

        {/* Erros inline */}
        {validationError && (
          <View style={styles.errorBox}>
            <Ionicons name="alert-circle" size={16} color={colors.error} />
            <Text style={styles.errorText}>{validationError}</Text>
          </View>
        )}
        {sendError && (
          <View style={styles.errorBox}>
            <Ionicons name="close-circle" size={16} color={colors.error} />
            <Text style={styles.errorText}>{sendError}</Text>
          </View>
        )}

        {/* Botao de envio */}
        <TouchableOpacity
          style={[styles.sendButton, loading && styles.sendButtonDisabled]}
          onPress={handleSend}
          disabled={loading}
        >
          {loading ? <ActivityIndicator color={colors.white} /> : (
            <>
              <Ionicons name="send" size={20} color={colors.white} />
              <Text style={styles.sendButtonText}>Enviar Aviso</Text>
            </>
          )}
        </TouchableOpacity>
      </ScrollView>

      {/* Modal de seleção de escopo */}
      <Modal visible={showScopeModal} animationType="slide" transparent onRequestClose={() => setShowScopeModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Selecionar Setor/Grupo</Text>
              <TouchableOpacity onPress={() => setShowScopeModal(false)}>
                <Ionicons name="close" size={24} color={colors.gray} />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.modalScroll}>
              {(scopesData?.scopes ?? []).map((scope) => (
                <TouchableOpacity
                  key={scope.id}
                  style={[styles.scopeOption, selectedScope?.id === scope.id && styles.scopeOptionSelected]}
                  onPress={() => { setSelectedScope(scope); setDestMode('scope'); setShowScopeModal(false); }}
                >
                  <View style={styles.scopeOptionLeft}>
                    <Text style={styles.scopeOptionName}>{scope.name}</Text>
                    <Text style={styles.scopeOptionMeta}>{scope.type} • {scope.member_count} membro(s)</Text>
                  </View>
                  {selectedScope?.id === scope.id && (
                    <Ionicons name="checkmark-circle" size={22} color={colors.admin} />
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
            <TouchableOpacity style={styles.modalDoneButton} onPress={() => setShowScopeModal(false)}>
              <Text style={styles.modalDoneText}>Concluir</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Modal de confirmação de envio */}
      <Modal visible={showConfirmModal} animationType="fade" transparent onRequestClose={() => setShowConfirmModal(false)}>
        <View style={styles.confirmOverlay}>
          <View style={styles.confirmBox}>
            <Ionicons name="send" size={32} color={colors.admin} style={{ marginBottom: 12 }} />
            <Text style={styles.confirmTitle}>Confirmar envio</Text>
            <Text style={styles.confirmMessage}>
              Enviar aviso para{' '}
              <Text style={{ fontWeight: '700' }}>
                {destMode === 'all'
                  ? 'todos os membros'
                  : destMode === 'scope'
                    ? (selectedScope?.name ?? '')
                    : `${previewCount ?? '?'} membro(s) filtrado(s)`}
              </Text>
              ?
            </Text>
            <View style={styles.confirmActions}>
              <TouchableOpacity
                style={styles.confirmCancelBtn}
                onPress={() => setShowConfirmModal(false)}
              >
                <Text style={styles.confirmCancelText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.confirmSendBtn}
                onPress={sendAviso}
              >
                <Ionicons name="send" size={16} color={colors.white} />
                <Text style={styles.confirmSendText}>Enviar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Modal de sucesso */}
      <Modal visible={showSuccessModal} animationType="fade" transparent onRequestClose={() => { setShowSuccessModal(false); router.back(); }}>
        <View style={styles.confirmOverlay}>
          <View style={styles.confirmBox}>
            <View style={styles.successIconCircle}>
              <Ionicons name="checkmark" size={40} color={colors.white} />
            </View>
            <Text style={styles.confirmTitle}>Aviso enviado!</Text>
            <Text style={styles.confirmMessage}>
              Seu aviso foi enviado para{' '}
              <Text style={{ fontWeight: '700', color: '#171717' }}>{sentCount} membro(s)</Text>
              {' '}com sucesso.
            </Text>
            <TouchableOpacity
              style={[styles.confirmSendBtn, { width: '100%' }]}
              onPress={() => { setShowSuccessModal(false); router.back(); }}
            >
              <Ionicons name="checkmark-circle" size={18} color={colors.white} />
              <Text style={styles.confirmSendText}>Concluir</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Modal de seleção de filtros de perfil */}
      <Modal visible={showFilterModal} animationType="slide" transparent onRequestClose={() => setShowFilterModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{filterData.title}</Text>
              <TouchableOpacity onPress={() => setShowFilterModal(false)}>
                <Ionicons name="close" size={24} color={colors.gray} />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.modalScroll}>
              {filterData.options.map((opt) => (
                <TouchableOpacity
                  key={opt.code}
                  style={styles.filterOption}
                  onPress={() => toggleSelection(opt.code, filterData.selected, filterData.setSelected)}
                >
                  <Text style={styles.filterOptionText}>{opt.label}</Text>
                  <View style={[styles.checkbox, filterData.selected.includes(opt.code) && styles.checkboxChecked]}>
                    {filterData.selected.includes(opt.code) && <Ionicons name="checkmark" size={16} color={colors.white} />}
                  </View>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <TouchableOpacity style={styles.modalDoneButton} onPress={() => setShowFilterModal(false)}>
              <Text style={styles.modalDoneText}>Concluir</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </>
  );
}

function FilterBtn({ label, count, onPress }: { label: string; count: number; onPress: () => void }) {
  return (
    <TouchableOpacity style={styles.filterButton} onPress={onPress}>
      <Text style={styles.filterButtonText}>{label}</Text>
      <View style={styles.filterButtonRight}>
        {count > 0 && <View style={styles.filterBadge}><Text style={styles.filterBadgeText}>{count}</Text></View>}
        <Ionicons name="chevron-forward" size={20} color={colors.gray} />
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.lightGray },
  content: { padding: 16, paddingBottom: 40 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.lightGray },
  label: { fontSize: 14, fontWeight: '600', color: '#171717', marginBottom: 8, marginTop: 16 },
  input: { backgroundColor: colors.white, borderRadius: 12, padding: 14, fontSize: 16, borderWidth: 1, borderColor: '#e5e5e5' },
  textArea: { minHeight: 120 },
  typeContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  typeButton: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, borderWidth: 2, borderColor: '#e5e5e5', backgroundColor: colors.white, gap: 6 },
  typeLabel: { fontSize: 13, fontWeight: '500' },
  destContainer: { backgroundColor: colors.white, borderRadius: 12, overflow: 'hidden' },
  destOption: { flexDirection: 'row', alignItems: 'center', padding: 14, gap: 10, borderBottomWidth: 1, borderBottomColor: '#f3f4f6' },
  destOptionActive: { backgroundColor: `${colors.admin}08` },
  destTextBlock: { flex: 1 },
  destText: { fontSize: 15, color: colors.gray },
  destTextActive: { color: '#171717', fontWeight: '500' },
  destSubtext: { fontSize: 12, color: colors.gray, marginTop: 2 },
  changeScopeBtn: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, backgroundColor: `${colors.admin}15` },
  changeScopeText: { fontSize: 12, color: colors.admin, fontWeight: '600' },
  pickScopeBtn: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: `${colors.admin}10`, borderRadius: 12, padding: 14, marginTop: 8 },
  pickScopeText: { flex: 1, fontSize: 15, color: colors.admin, fontWeight: '500' },
  filtersContainer: { backgroundColor: colors.white, borderRadius: 12, padding: 16, marginTop: 12 },
  filtersTitle: { fontSize: 14, fontWeight: '600', color: '#171717', marginBottom: 12 },
  filterButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#f3f4f6' },
  filterButtonText: { fontSize: 15, color: '#171717' },
  filterButtonRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  filterBadge: { backgroundColor: colors.admin, borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2 },
  filterBadgeText: { color: colors.white, fontSize: 12, fontWeight: '600' },
  previewBox: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 16, padding: 12, backgroundColor: `${colors.admin}10`, borderRadius: 8 },
  previewText: { fontSize: 14, color: colors.admin, fontWeight: '500' },
  sendButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: colors.admin, borderRadius: 12, padding: 16, marginTop: 24 },
  sendButtonDisabled: { opacity: 0.6 },
  sendButtonText: { color: colors.white, fontSize: 16, fontWeight: '600' },
  // Modais
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: colors.white, borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '70%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: '#e5e5e5' },
  modalTitle: { fontSize: 18, fontWeight: '600', color: '#171717' },
  modalScroll: { padding: 16 },
  scopeOption: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#f3f4f6' },
  scopeOptionSelected: { backgroundColor: `${colors.admin}08` },
  scopeOptionLeft: { flex: 1 },
  scopeOptionName: { fontSize: 15, fontWeight: '500', color: '#171717' },
  scopeOptionMeta: { fontSize: 12, color: colors.gray, marginTop: 2 },
  filterOption: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#f3f4f6' },
  filterOptionText: { fontSize: 15, color: '#171717' },
  checkbox: { width: 24, height: 24, borderRadius: 6, borderWidth: 2, borderColor: '#d1d5db', alignItems: 'center', justifyContent: 'center' },
  checkboxChecked: { backgroundColor: colors.admin, borderColor: colors.admin },
  modalDoneButton: { margin: 16, padding: 16, backgroundColor: colors.admin, borderRadius: 12, alignItems: 'center' },
  modalDoneText: { color: colors.white, fontSize: 16, fontWeight: '600' },
  // Erros inline
  errorBox: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12, padding: 12, backgroundColor: '#fef2f2', borderRadius: 10, borderWidth: 1, borderColor: '#fecaca' },
  errorText: { flex: 1, fontSize: 14, color: colors.error, fontWeight: '500' },
  // Modal de confirmação
  confirmOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'center', alignItems: 'center', padding: 24 },
  confirmBox: { backgroundColor: colors.white, borderRadius: 20, padding: 28, width: '100%', maxWidth: 380, alignItems: 'center' },
  confirmTitle: { fontSize: 20, fontWeight: '700', color: '#171717', marginBottom: 10 },
  confirmMessage: { fontSize: 15, color: colors.gray, textAlign: 'center', marginBottom: 24, lineHeight: 22 },
  confirmActions: { flexDirection: 'row', gap: 12, width: '100%' },
  confirmCancelBtn: { flex: 1, padding: 14, borderRadius: 12, borderWidth: 1.5, borderColor: '#e5e5e5', alignItems: 'center' },
  confirmCancelText: { fontSize: 15, fontWeight: '600', color: colors.gray },
  confirmSendBtn: { flex: 1, flexDirection: 'row', gap: 8, padding: 14, borderRadius: 12, backgroundColor: colors.admin, alignItems: 'center', justifyContent: 'center' },
  confirmSendText: { fontSize: 15, fontWeight: '600', color: colors.white },
  successIconCircle: { width: 72, height: 72, borderRadius: 36, backgroundColor: colors.success, alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
});
