/**
 * Create Aviso Screen
 * ===================
 * Tela para criar e enviar avisos.
 */

import { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Modal,
} from 'react-native';
import { router, Stack } from 'expo-router';
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
  { type: 'warning', label: 'Atenção', color: colors.warning, icon: 'warning' },
  { type: 'success', label: 'Confirmação', color: colors.success, icon: 'checkmark-circle' },
  { type: 'urgent', label: 'Urgente', color: colors.error, icon: 'alert-circle' },
];

export default function CreateAvisoScreen() {
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState<MessageType>('info');
  const [sendToAll, setSendToAll] = useState(true);
  
  const [filterOptions, setFilterOptions] = useState<FilterOptions | null>(null);
  const [selectedVocational, setSelectedVocational] = useState<string[]>([]);
  const [selectedLifeState, setSelectedLifeState] = useState<string[]>([]);
  const [selectedMarital, setSelectedMarital] = useState<string[]>([]);
  const [selectedStates, setSelectedStates] = useState<string[]>([]);
  const [selectedCities, setSelectedCities] = useState<string[]>([]);
  
  const [loading, setLoading] = useState(false);
  const [loadingFilters, setLoadingFilters] = useState(false);
  const [previewCount, setPreviewCount] = useState<number | null>(null);
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [activeFilter, setActiveFilter] = useState<string | null>(null);

  useEffect(() => {
    loadFilterOptions();
  }, []);

  useEffect(() => {
    if (!sendToAll) updatePreview();
  }, [sendToAll, selectedVocational, selectedLifeState, selectedMarital, selectedStates, selectedCities]);

  const loadFilterOptions = async () => {
    setLoadingFilters(true);
    try {
      const response = await api.get('/inbox/send/filters');
      setFilterOptions(response.data);
    } catch (error) {
      console.log('Erro ao carregar filtros:', error);
    } finally {
      setLoadingFilters(false);
    }
  };

  const updatePreview = async () => {
    try {
      const filters = buildFilters();
      const response = await api.post('/inbox/send/preview', {
        send_to_all: sendToAll,
        filters: sendToAll ? null : filters,
      });
      setPreviewCount(response.data.recipient_count);
    } catch (error) {
      console.log('Erro ao atualizar preview:', error);
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
    if (!title.trim()) return Alert.alert('Erro', 'Digite um título para o aviso');
    if (!message.trim()) return Alert.alert('Erro', 'Digite o texto do aviso');
    if (!sendToAll && !buildFilters()) return Alert.alert('Erro', 'Selecione pelo menos um filtro');

    Alert.alert(
      'Confirmar envio',
      `Enviar aviso para ${sendToAll ? 'todos os membros' : `${previewCount} membro(s)`}?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Enviar', onPress: sendAviso },
      ]
    );
  };

  const sendAviso = async () => {
    setLoading(true);
    try {
      const response = await api.post('/inbox/send', {
        title: title.trim(),
        message: message.trim(),
        type: messageType,
        send_to_all: sendToAll,
        filters: sendToAll ? null : buildFilters(),
      });
      Alert.alert('Aviso Enviado!', `Enviado para ${response.data.recipient_count} membro(s).`,
        [{ text: 'OK', onPress: () => router.back() }]
      );
    } catch (error: any) {
      Alert.alert('Erro', error.response?.data?.detail || 'Não foi possível enviar o aviso');
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

  return (
    <>
      <Stack.Screen options={{ title: 'Criar Aviso' }} />
      
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <Text style={styles.label}>Tipo do Aviso</Text>
        <View style={styles.typeContainer}>
          {messageTypes.map((mt) => (
            <TouchableOpacity
              key={mt.type}
              style={[styles.typeButton, messageType === mt.type && { borderColor: mt.color, backgroundColor: `${mt.color}15` }]}
              onPress={() => setMessageType(mt.type)}
            >
              <Ionicons name={mt.icon as any} size={20} color={mt.color} />
              <Text style={[styles.typeLabel, { color: messageType === mt.type ? mt.color : colors.gray }]}>{mt.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.label}>Título</Text>
        <TextInput style={styles.input} value={title} onChangeText={setTitle} placeholder="Ex: Reunião de Formação" maxLength={200} />

        <Text style={styles.label}>Texto do Aviso</Text>
        <TextInput style={[styles.input, styles.textArea]} value={message} onChangeText={setMessage} placeholder="Escreva o conteúdo..." multiline numberOfLines={6} textAlignVertical="top" maxLength={5000} />

        <Text style={styles.label}>Destinatários</Text>
        <View style={styles.destContainer}>
          <TouchableOpacity style={[styles.destOption, sendToAll && styles.destOptionActive]} onPress={() => setSendToAll(true)}>
            <Ionicons name={sendToAll ? "radio-button-on" : "radio-button-off"} size={20} color={sendToAll ? colors.admin : colors.gray} />
            <Text style={[styles.destText, sendToAll && styles.destTextActive]}>Todos os membros</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.destOption, !sendToAll && styles.destOptionActive]} onPress={() => setSendToAll(false)}>
            <Ionicons name={!sendToAll ? "radio-button-on" : "radio-button-off"} size={20} color={!sendToAll ? colors.admin : colors.gray} />
            <Text style={[styles.destText, !sendToAll && styles.destTextActive]}>Segmentado</Text>
          </TouchableOpacity>
        </View>

        {!sendToAll && (
          <View style={styles.filtersContainer}>
            <Text style={styles.filtersTitle}>Filtros de Segmentação</Text>
            {loadingFilters ? <ActivityIndicator color={colors.admin} /> : (
              <>
                <FilterBtn label="Realidade Vocacional" count={selectedVocational.length} onPress={() => openFilter('vocational')} />
                <FilterBtn label="Estado de Vida" count={selectedLifeState.length} onPress={() => openFilter('lifeState')} />
                <FilterBtn label="Estado Civil" count={selectedMarital.length} onPress={() => openFilter('marital')} />
                <FilterBtn label="Estado (UF)" count={selectedStates.length} onPress={() => openFilter('states')} />
                <FilterBtn label="Cidade" count={selectedCities.length} onPress={() => openFilter('cities')} />
              </>
            )}
            {previewCount !== null && (
              <View style={styles.previewBox}>
                <Ionicons name="people" size={20} color={colors.admin} />
                <Text style={styles.previewText}>{previewCount} membro(s) receberão este aviso</Text>
              </View>
            )}
          </View>
        )}

        <TouchableOpacity style={[styles.sendButton, loading && styles.sendButtonDisabled]} onPress={handleSend} disabled={loading}>
          {loading ? <ActivityIndicator color={colors.white} /> : (
            <>
              <Ionicons name="send" size={20} color={colors.white} />
              <Text style={styles.sendButtonText}>Enviar Aviso</Text>
            </>
          )}
        </TouchableOpacity>
      </ScrollView>

      <Modal visible={showFilterModal} animationType="slide" transparent onRequestClose={() => setShowFilterModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{filterData.title}</Text>
              <TouchableOpacity onPress={() => setShowFilterModal(false)}><Ionicons name="close" size={24} color={colors.gray} /></TouchableOpacity>
            </View>
            <ScrollView style={styles.modalScroll}>
              {filterData.options.map((opt) => (
                <TouchableOpacity key={opt.code} style={styles.filterOption} onPress={() => toggleSelection(opt.code, filterData.selected, filterData.setSelected)}>
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
  label: { fontSize: 14, fontWeight: '600', color: '#171717', marginBottom: 8, marginTop: 16 },
  input: { backgroundColor: colors.white, borderRadius: 12, padding: 14, fontSize: 16, borderWidth: 1, borderColor: '#e5e5e5' },
  textArea: { minHeight: 120 },
  typeContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  typeButton: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, borderWidth: 2, borderColor: '#e5e5e5', backgroundColor: colors.white, gap: 6 },
  typeLabel: { fontSize: 13, fontWeight: '500' },
  destContainer: { backgroundColor: colors.white, borderRadius: 12, overflow: 'hidden' },
  destOption: { flexDirection: 'row', alignItems: 'center', padding: 14, gap: 10, borderBottomWidth: 1, borderBottomColor: '#f3f4f6' },
  destOptionActive: { backgroundColor: `${colors.admin}08` },
  destText: { fontSize: 15, color: colors.gray },
  destTextActive: { color: '#171717', fontWeight: '500' },
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
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: colors.white, borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '70%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: '#e5e5e5' },
  modalTitle: { fontSize: 18, fontWeight: '600', color: '#171717' },
  modalScroll: { padding: 16 },
  filterOption: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#f3f4f6' },
  filterOptionText: { fontSize: 15, color: '#171717' },
  checkbox: { width: 24, height: 24, borderRadius: 6, borderWidth: 2, borderColor: '#d1d5db', alignItems: 'center', justifyContent: 'center' },
  checkboxChecked: { backgroundColor: colors.admin, borderColor: colors.admin },
  modalDoneButton: { margin: 16, padding: 16, backgroundColor: colors.admin, borderRadius: 12, alignItems: 'center' },
  modalDoneText: { color: colors.white, fontSize: 16, fontWeight: '600' },
});
