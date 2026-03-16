/**
 * Profile Screen
 * ==============
 * Exibe todos os dados do perfil e permite editar qualquer campo.
 * Edição via modal completo com todos os campos (texto, data, UF, catálogos, toggles).
 */

import { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Modal, TextInput, ActivityIndicator, FlatList,
  RefreshControl, Alert, Image, Switch, Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { signOut } from 'firebase/auth';
import { auth } from '@/config/firebase';
import { profileService } from '@/services';
import type { CatalogItem, Profile } from '@/types';

// =============================================================================
// CONSTANTES
// =============================================================================

const PRIMARY = '#1A859B';
const WHITE = '#ffffff';
const GRAY = '#6b7280';
const BG = '#f3f4f6';

const BR_STATES = [
  'AC','AL','AP','AM','BA','CE','DF','ES','GO',
  'MA','MT','MS','MG','PA','PB','PR','PE','PI',
  'RJ','RN','RS','RO','RR','SC','SP','SE','TO',
];

// =============================================================================
// HELPERS
// =============================================================================

/** ISO (YYYY-MM-DD) → DD/MM/AAAA. Retorna '' se nulo. */
const isoToDisplay = (iso: string | null | undefined): string => {
  if (!iso) return '';
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
};

/** E.164 (+5511999999999) → (11) 99999-9999. Retorna '' se nulo. */
const e164ToDisplay = (e164: string | null | undefined): string => {
  if (!e164) return '';
  const digits = e164.replace(/\D/g, '');
  const local = digits.startsWith('55') ? digits.slice(2) : digits;
  if (local.length === 11) return `(${local.slice(0,2)}) ${local.slice(2,7)}-${local.slice(7)}`;
  if (local.length === 10) return `(${local.slice(0,2)}) ${local.slice(2,6)}-${local.slice(6)}`;
  return e164;
};

/** Formata telefone à medida que o usuário digita. */
const formatPhone = (v: string): string => {
  const d = v.replace(/\D/g, '').slice(0, 11);
  if (d.length <= 2) return d;
  if (d.length <= 6) return `(${d.slice(0,2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0,2)}) ${d.slice(2,6)}-${d.slice(6)}`;
  return `(${d.slice(0,2)}) ${d.slice(2,7)}-${d.slice(7)}`;
};

/** Formata data à medida que o usuário digita (DD/MM/AAAA). */
const formatDate = (v: string): string => {
  const d = v.replace(/\D/g, '').slice(0, 8);
  if (d.length <= 2) return d;
  if (d.length <= 4) return `${d.slice(0,2)}/${d.slice(2)}`;
  return `${d.slice(0,2)}/${d.slice(2,4)}/${d.slice(4)}`;
};

// =============================================================================
// TELA PRINCIPAL
// =============================================================================

export default function ProfileScreen() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);

  // Catálogos
  const [lifeStates, setLifeStates] = useState<CatalogItem[]>([]);
  const [maritalStatuses, setMaritalStatuses] = useState<CatalogItem[]>([]);
  const [vocationalRealities, setVocationalRealities] = useState<CatalogItem[]>([]);

  // Modal principal de edição
  const [editVisible, setEditVisible] = useState(false);

  // Campos do formulário de edição
  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editBirthDate, setEditBirthDate] = useState('');
  const [editUF, setEditUF] = useState('');
  const [editCity, setEditCity] = useState('');
  const [editLifeState, setEditLifeState] = useState<CatalogItem | null>(null);
  const [editMarital, setEditMarital] = useState<CatalogItem | null>(null);
  const [editVocational, setEditVocational] = useState<CatalogItem | null>(null);
  const [editHasAccomp, setEditHasAccomp] = useState(false);
  const [editAccompName, setEditAccompName] = useState('');
  const [editInterestedMinistry, setEditInterestedMinistry] = useState(false);
  const [editMinistryNotes, setEditMinistryNotes] = useState('');
  const [editErrors, setEditErrors] = useState<Record<string, string>>({});

  // Sub-modais (UF e catálogo)
  const [ufModalVisible, setUfModalVisible] = useState(false);
  const [catalogModalVisible, setCatalogModalVisible] = useState(false);
  const [catalogOptions, setCatalogOptions] = useState<CatalogItem[]>([]);
  const [catalogTitle, setCatalogTitle] = useState('');
  const [catalogOnSelect, setCatalogOnSelect] = useState<(item: CatalogItem) => void>(() => () => {});

  useEffect(() => {
    loadProfile();
    loadCatalogs();
  }, []);

  const loadProfile = async () => {
    try {
      await auth.authStateReady();
      setEmail(auth.currentUser?.email ?? '');
      const data = await profileService.getProfile();
      setProfile(data as Profile);
    } catch (e: any) {
      if (e?.response?.status !== 404) console.log('Erro ao carregar perfil:', e);
    } finally {
      setLoading(false);
    }
  };

  const loadCatalogs = async () => {
    try {
      const catalogs = await profileService.getCatalogs();
      const find = (code: string) => catalogs.find(c => c.code === code)?.items ?? [];
      setLifeStates(find('LIFE_STATE'));
      setMaritalStatuses(find('MARITAL_STATUS'));
      setVocationalRealities(find('VOCATIONAL_REALITY'));
    } catch {
      // silencioso — campos ficam desabilitados
    }
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadProfile();
    setRefreshing(false);
  }, []);

  // ---------------------------------------------------------------------------
  // Abre o modal populando todos os campos com os dados atuais
  // ---------------------------------------------------------------------------
  const openEditModal = () => {
    if (!profile) return;
    setEditName(profile.full_name ?? '');
    setEditPhone(e164ToDisplay(profile.phone_e164));
    setEditBirthDate(isoToDisplay(profile.birth_date));
    setEditUF(profile.state ?? '');
    setEditCity(profile.city ?? '');
    setEditLifeState(lifeStates.find(i => i.id === profile.life_state_item_id) ?? null);
    setEditMarital(maritalStatuses.find(i => i.id === profile.marital_status_item_id) ?? null);
    setEditVocational(vocationalRealities.find(i => i.id === profile.vocational_reality_item_id) ?? null);
    setEditHasAccomp(profile.has_vocational_accompaniment ?? false);
    setEditAccompName(profile.vocational_accompanist_name ?? '');
    setEditInterestedMinistry(profile.interested_in_ministry ?? false);
    setEditMinistryNotes(profile.ministry_interest_notes ?? '');
    setEditErrors({});
    setEditVisible(true);
  };

  // ---------------------------------------------------------------------------
  // Abre modal de catálogo
  // ---------------------------------------------------------------------------
  const openCatalogModal = (
    title: string,
    options: CatalogItem[],
    onSelect: (item: CatalogItem) => void,
  ) => {
    setCatalogTitle(title);
    setCatalogOptions(options);
    setCatalogOnSelect(() => onSelect);
    setCatalogModalVisible(true);
  };

  // ---------------------------------------------------------------------------
  // Valida e salva
  // ---------------------------------------------------------------------------
  const validateEdit = (): boolean => {
    const e: Record<string, string> = {};
    if (editName.trim().length < 2) e.name = 'Nome obrigatório (mín. 2 caracteres)';
    if (editPhone.replace(/\D/g, '').length < 10) e.phone = 'Telefone inválido';
    const parts = editBirthDate.split('/');
    if (parts.length !== 3 || (parts[2] ?? '').length !== 4) e.birthDate = 'Data inválida (DD/MM/AAAA)';
    if (!editUF) e.uf = 'Selecione o estado';
    if (editCity.trim().length < 2) e.city = 'Cidade obrigatória';
    if (editHasAccomp && !editAccompName.trim()) e.accompName = 'Informe o nome do acompanhador';
    if (editInterestedMinistry && !editMinistryNotes.trim()) e.ministryNotes = 'Descreva o interesse';
    setEditErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSaveProfile = async () => {
    if (!validateEdit()) return;
    setSaving(true);
    try {
      const [dd, mm, yyyy] = editBirthDate.split('/');
      const phoneDigits = editPhone.replace(/\D/g, '');
      await profileService.updateProfile({
        full_name: editName.trim(),
        birth_date: `${yyyy}-${mm}-${dd}`,
        phone_e164: `+55${phoneDigits}`,
        city: editCity.trim(),
        state: editUF,
        photo_url: profile?.photo_url ?? null,
        life_state_item_id: editLifeState?.id ?? null,
        marital_status_item_id: editMarital?.id ?? null,
        vocational_reality_item_id: editVocational?.id ?? null,
        has_vocational_accompaniment: editHasAccomp,
        vocational_accompanist_name: editHasAccomp ? editAccompName.trim() : null,
        interested_in_ministry: editInterestedMinistry,
        ministry_interest_notes: editInterestedMinistry ? editMinistryNotes.trim() : null,
      });
      await loadProfile();
      setEditVisible(false);
    } catch (err: any) {
      const msg = err?.response?.data?.detail?.message ?? 'Não foi possível salvar.';
      Alert.alert('Erro ao salvar', msg);
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = () => {
    if (Platform.OS === 'web') {
      // Alert.alert não funciona no web — usa confirm nativo do browser
      if (window.confirm('Deseja realmente sair da sua conta?')) {
        signOut(auth).then(() => router.replace('/(auth)/login'));
      }
    } else {
      Alert.alert('Sair', 'Deseja realmente sair da sua conta?', [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Sair',
          style: 'destructive',
          onPress: async () => {
            await signOut(auth);
            router.replace('/(auth)/login');
          },
        },
      ]);
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={PRIMARY} />
      </View>
    );
  }

  const isComplete = profile?.status === 'COMPLETE';

  return (
    <View style={{ flex: 1 }}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[PRIMARY]} />}
      >
        {/* ── Header ──────────────────────────────────────────────── */}
        <View style={styles.headerCard}>
          <View style={styles.avatarContainer}>
            {profile?.photo_url ? (
              <Image source={{ uri: profile.photo_url }} style={styles.avatar} />
            ) : (
              <View style={styles.avatarPlaceholder}>
                <Ionicons name="person" size={48} color={WHITE} />
              </View>
            )}
          </View>

          <Text style={styles.userName}>{profile?.full_name || 'Nome não informado'}</Text>
          <Text style={styles.userEmail}>{email}</Text>

          <View style={[styles.statusChip, isComplete ? styles.statusComplete : styles.statusPending]}>
            <Text style={[styles.statusText, { color: isComplete ? '#16a34a' : '#d97706' }]}>
              {isComplete ? '✓ Perfil Completo' : '⏳ Perfil Incompleto'}
            </Text>
          </View>

          <TouchableOpacity style={styles.editProfileButton} onPress={openEditModal}>
            <Ionicons name="create-outline" size={18} color={PRIMARY} />
            <Text style={styles.editProfileButtonText}>Editar Perfil</Text>
          </TouchableOpacity>
        </View>

        {/* ── Dados Pessoais ──────────────────────────────────────── */}
        <SectionTitle>Dados Pessoais</SectionTitle>
        <View style={styles.card}>
          <InfoRow icon="person-outline" label="Nome" value={profile?.full_name} />
          <InfoRow icon="calendar-outline" label="Nascimento" value={isoToDisplay(profile?.birth_date) || undefined} />
          <InfoRow icon="call-outline" label="Telefone" value={e164ToDisplay(profile?.phone_e164) || undefined} />
          <InfoRow icon="map-outline" label="Estado" value={profile?.state} />
          <InfoRow icon="location-outline" label="Cidade" value={profile?.city} last />
        </View>

        {/* ── Informações da Comunidade ────────────────────────────── */}
        <SectionTitle>Informações da Comunidade</SectionTitle>
        <View style={styles.card}>
          <InfoRow icon="heart-outline" label="Estado de Vida" value={profile?.life_state_label} />
          <InfoRow icon="people-outline" label="Estado Civil" value={profile?.marital_status_label} />
          <InfoRow icon="star-outline" label="Realidade Vocacional" value={profile?.vocational_reality_label} last />
        </View>

        {/* ── Acompanhamento Vocacional ────────────────────────────── */}
        <SectionTitle>Acompanhamento Vocacional</SectionTitle>
        <View style={styles.card}>
          <InfoRow
            icon="hand-left-outline"
            label="Possui acompanhamento"
            value={
              profile?.has_vocational_accompaniment == null
                ? undefined
                : profile.has_vocational_accompaniment ? 'Sim' : 'Não'
            }
          />
          {profile?.has_vocational_accompaniment ? (
            <InfoRow
              icon="person-circle-outline"
              label="Acompanhador"
              value={profile.vocational_accompanist_display_name ?? profile.vocational_accompanist_name}
              last
            />
          ) : (
            <View style={{ height: 2 }} />
          )}
        </View>

        {/* ── Interesse em Ministério ──────────────────────────────── */}
        <SectionTitle>Interesse em Ministério</SectionTitle>
        <View style={styles.card}>
          <InfoRow
            icon="flag-outline"
            label="Tem interesse"
            value={
              profile?.interested_in_ministry == null
                ? undefined
                : profile.interested_in_ministry ? 'Sim' : 'Não'
            }
          />
          {profile?.interested_in_ministry && profile?.ministry_interest_notes ? (
            <InfoRow
              icon="document-text-outline"
              label="Observações"
              value={profile.ministry_interest_notes}
              last
            />
          ) : (
            <View style={{ height: 2 }} />
          )}
        </View>

        {/* ── Sair ────────────────────────────────────────────────── */}
        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
          <Ionicons name="log-out-outline" size={20} color="#ef4444" />
          <Text style={styles.logoutText}>Sair da Conta</Text>
        </TouchableOpacity>

        <Text style={styles.version}>Lumen+ v1.0.0</Text>
      </ScrollView>

      {/* ══════════════════════════════════════════════════════════
          Modal: Editar Perfil (fullscreen)
      ══════════════════════════════════════════════════════════ */}
      <Modal
        visible={editVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => !saving && setEditVisible(false)}
      >
        <View style={styles.editModal}>
          {/* Header */}
          <View style={styles.editHeader}>
            <TouchableOpacity onPress={() => !saving && setEditVisible(false)} style={styles.editHeaderBack}>
              <Ionicons name="arrow-back" size={24} color="#171717" />
            </TouchableOpacity>
            <Text style={styles.editHeaderTitle}>Editar Perfil</Text>
            <View style={{ width: 40 }} />
          </View>

          <ScrollView
            style={styles.editBody}
            contentContainerStyle={styles.editBodyContent}
            keyboardShouldPersistTaps="handled"
          >
            {/* ─ Dados Pessoais ─ */}
            <Text style={styles.editSection}>Dados Pessoais</Text>

            <Text style={styles.editLabel}>Nome completo *</Text>
            <TextInput
              style={[styles.editInput, editErrors.name ? styles.editInputError : null]}
              value={editName}
              onChangeText={t => { setEditName(t); setEditErrors(p => ({ ...p, name: '' })); }}
              placeholder="Nome completo"
              autoCapitalize="words"
            />
            {editErrors.name ? <Text style={styles.editError}>{editErrors.name}</Text> : null}

            <Text style={styles.editLabel}>Telefone (WhatsApp) *</Text>
            <TextInput
              style={[styles.editInput, editErrors.phone ? styles.editInputError : null]}
              value={editPhone}
              onChangeText={t => { setEditPhone(formatPhone(t)); setEditErrors(p => ({ ...p, phone: '' })); }}
              placeholder="(11) 99999-9999"
              keyboardType="phone-pad"
            />
            {editErrors.phone ? <Text style={styles.editError}>{editErrors.phone}</Text> : null}

            <Text style={styles.editLabel}>Data de nascimento *</Text>
            <TextInput
              style={[styles.editInput, editErrors.birthDate ? styles.editInputError : null]}
              value={editBirthDate}
              onChangeText={t => { setEditBirthDate(formatDate(t)); setEditErrors(p => ({ ...p, birthDate: '' })); }}
              placeholder="DD/MM/AAAA"
              keyboardType="numeric"
            />
            {editErrors.birthDate ? <Text style={styles.editError}>{editErrors.birthDate}</Text> : null}

            <Text style={styles.editLabel}>Estado (UF) *</Text>
            <TouchableOpacity
              style={[styles.editSelector, editErrors.uf ? styles.editInputError : null]}
              onPress={() => setUfModalVisible(true)}
            >
              <Text style={editUF ? styles.editSelectorValue : styles.editSelectorPlaceholder}>
                {editUF || 'Selecione o estado'}
              </Text>
              <Ionicons name="chevron-down" size={18} color={GRAY} />
            </TouchableOpacity>
            {editErrors.uf ? <Text style={styles.editError}>{editErrors.uf}</Text> : null}

            <Text style={styles.editLabel}>Cidade *</Text>
            <TextInput
              style={[styles.editInput, editErrors.city ? styles.editInputError : null]}
              value={editCity}
              onChangeText={t => { setEditCity(t); setEditErrors(p => ({ ...p, city: '' })); }}
              placeholder="Sua cidade"
              autoCapitalize="words"
            />
            {editErrors.city ? <Text style={styles.editError}>{editErrors.city}</Text> : null}

            {/* ─ Informações da Comunidade ─ */}
            <Text style={[styles.editSection, { marginTop: 8 }]}>Informações da Comunidade</Text>

            <Text style={styles.editLabel}>Estado de Vida</Text>
            <TouchableOpacity
              style={styles.editSelector}
              onPress={() => openCatalogModal('Estado de Vida', lifeStates, item => {
                setEditLifeState(item);
                setCatalogModalVisible(false);
              })}
            >
              <Text style={editLifeState ? styles.editSelectorValue : styles.editSelectorPlaceholder}>
                {editLifeState?.label || 'Selecionar'}
              </Text>
              <Ionicons name="chevron-down" size={18} color={GRAY} />
            </TouchableOpacity>

            <Text style={styles.editLabel}>Estado Civil</Text>
            <TouchableOpacity
              style={styles.editSelector}
              onPress={() => openCatalogModal('Estado Civil', maritalStatuses, item => {
                setEditMarital(item);
                setCatalogModalVisible(false);
              })}
            >
              <Text style={editMarital ? styles.editSelectorValue : styles.editSelectorPlaceholder}>
                {editMarital?.label || 'Selecionar'}
              </Text>
              <Ionicons name="chevron-down" size={18} color={GRAY} />
            </TouchableOpacity>

            <Text style={styles.editLabel}>Realidade Vocacional</Text>
            <TouchableOpacity
              style={styles.editSelector}
              onPress={() => openCatalogModal('Realidade Vocacional', vocationalRealities, item => {
                setEditVocational(item);
                setCatalogModalVisible(false);
              })}
            >
              <Text style={editVocational ? styles.editSelectorValue : styles.editSelectorPlaceholder}>
                {editVocational?.label || 'Selecionar'}
              </Text>
              <Ionicons name="chevron-down" size={18} color={GRAY} />
            </TouchableOpacity>

            {/* ─ Acompanhamento Vocacional ─ */}
            <Text style={[styles.editSection, { marginTop: 8 }]}>Acompanhamento Vocacional</Text>

            <View style={styles.toggleRow}>
              <Text style={styles.toggleLabel}>Possui acompanhamento vocacional?</Text>
              <Switch
                value={editHasAccomp}
                onValueChange={v => {
                  setEditHasAccomp(v);
                  if (!v) setEditErrors(p => ({ ...p, accompName: '' }));
                }}
                trackColor={{ false: '#d1d5db', true: `${PRIMARY}80` }}
                thumbColor={editHasAccomp ? PRIMARY : '#9ca3af'}
              />
            </View>

            {editHasAccomp && (
              <>
                <Text style={styles.editLabel}>Nome do acompanhador *</Text>
                <TextInput
                  style={[styles.editInput, editErrors.accompName ? styles.editInputError : null]}
                  value={editAccompName}
                  onChangeText={t => { setEditAccompName(t); setEditErrors(p => ({ ...p, accompName: '' })); }}
                  placeholder="Nome completo do acompanhador"
                  autoCapitalize="words"
                />
                {editErrors.accompName ? <Text style={styles.editError}>{editErrors.accompName}</Text> : null}
              </>
            )}

            {/* ─ Interesse em Ministério ─ */}
            <Text style={[styles.editSection, { marginTop: 8 }]}>Interesse em Ministério</Text>

            <View style={styles.toggleRow}>
              <Text style={styles.toggleLabel}>Tem interesse em ministério?</Text>
              <Switch
                value={editInterestedMinistry}
                onValueChange={v => {
                  setEditInterestedMinistry(v);
                  if (!v) setEditErrors(p => ({ ...p, ministryNotes: '' }));
                }}
                trackColor={{ false: '#d1d5db', true: `${PRIMARY}80` }}
                thumbColor={editInterestedMinistry ? PRIMARY : '#9ca3af'}
              />
            </View>

            {editInterestedMinistry && (
              <>
                <Text style={styles.editLabel}>Descreva o interesse *</Text>
                <TextInput
                  style={[
                    styles.editInput,
                    styles.editInputMultiline,
                    editErrors.ministryNotes ? styles.editInputError : null,
                  ]}
                  value={editMinistryNotes}
                  onChangeText={t => { setEditMinistryNotes(t); setEditErrors(p => ({ ...p, ministryNotes: '' })); }}
                  placeholder="Em qual(is) ministério(s) tem interesse e por quê..."
                  multiline
                  numberOfLines={4}
                />
                {editErrors.ministryNotes ? <Text style={styles.editError}>{editErrors.ministryNotes}</Text> : null}
              </>
            )}

            {/* ─ Salvar ─ */}
            <TouchableOpacity
              style={[styles.saveButton, saving ? styles.saveButtonDisabled : null]}
              onPress={handleSaveProfile}
              disabled={saving}
            >
              {saving
                ? <ActivityIndicator color={WHITE} />
                : <Text style={styles.saveButtonText}>Salvar Perfil</Text>
              }
            </TouchableOpacity>
          </ScrollView>
        </View>
      </Modal>

      {/* ══════════════════════════════════════════════════════════
          Sub-modal: Seletor de UF
      ══════════════════════════════════════════════════════════ */}
      <Modal
        visible={ufModalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setUfModalVisible(false)}
      >
        <View style={styles.subOverlay}>
          <View style={styles.subSheet}>
            <View style={styles.subHeader}>
              <Text style={styles.subTitle}>Estado (UF)</Text>
              <TouchableOpacity onPress={() => setUfModalVisible(false)}>
                <Ionicons name="close" size={24} color={GRAY} />
              </TouchableOpacity>
            </View>
            <FlatList
              data={BR_STATES}
              keyExtractor={item => item}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[styles.subItem, editUF === item ? styles.subItemSelected : null]}
                  onPress={() => {
                    setEditUF(item);
                    setEditErrors(p => ({ ...p, uf: '' }));
                    setUfModalVisible(false);
                  }}
                >
                  <Text style={[styles.subItemText, editUF === item ? styles.subItemTextSelected : null]}>
                    {item}
                  </Text>
                  {editUF === item && <Ionicons name="checkmark" size={20} color={PRIMARY} />}
                </TouchableOpacity>
              )}
            />
          </View>
        </View>
      </Modal>

      {/* ══════════════════════════════════════════════════════════
          Sub-modal: Seletor de Catálogo
      ══════════════════════════════════════════════════════════ */}
      <Modal
        visible={catalogModalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setCatalogModalVisible(false)}
      >
        <View style={styles.subOverlay}>
          <View style={styles.subSheet}>
            <View style={styles.subHeader}>
              <Text style={styles.subTitle}>{catalogTitle}</Text>
              <TouchableOpacity onPress={() => setCatalogModalVisible(false)}>
                <Ionicons name="close" size={24} color={GRAY} />
              </TouchableOpacity>
            </View>
            <FlatList
              data={catalogOptions}
              keyExtractor={item => item.id}
              renderItem={({ item }) => {
                const isSelected =
                  (catalogTitle === 'Estado de Vida' && editLifeState?.id === item.id) ||
                  (catalogTitle === 'Estado Civil' && editMarital?.id === item.id) ||
                  (catalogTitle === 'Realidade Vocacional' && editVocational?.id === item.id);
                return (
                  <TouchableOpacity
                    style={[styles.subItem, isSelected ? styles.subItemSelected : null]}
                    onPress={() => catalogOnSelect(item)}
                  >
                    <Text style={[styles.subItemText, isSelected ? styles.subItemTextSelected : null]}>
                      {item.label}
                    </Text>
                    {isSelected && <Ionicons name="checkmark" size={20} color={PRIMARY} />}
                  </TouchableOpacity>
                );
              }}
            />
          </View>
        </View>
      </Modal>
    </View>
  );
}

// =============================================================================
// SUB-COMPONENTES
// =============================================================================

function SectionTitle({ children }: { children: string }) {
  return <Text style={styles.sectionTitle}>{children}</Text>;
}

function InfoRow({
  icon, label, value, last,
}: {
  icon: string;
  label: string;
  value?: string | null;
  last?: boolean;
}) {
  return (
    <View style={[styles.row, last ? styles.rowLast : null]}>
      <Ionicons name={icon as any} size={20} color={GRAY} />
      <View style={styles.rowContent}>
        <Text style={styles.rowLabel}>{label}</Text>
        <Text style={styles.rowValue}>{value || 'Não informado'}</Text>
      </View>
    </View>
  );
}

// =============================================================================
// ESTILOS
// =============================================================================

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG },
  content: { padding: 16, paddingBottom: 48 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: BG },

  // Header card
  headerCard: { backgroundColor: WHITE, borderRadius: 16, padding: 24, alignItems: 'center', marginBottom: 12 },
  avatarContainer: { marginBottom: 14 },
  avatar: { width: 96, height: 96, borderRadius: 48 },
  avatarPlaceholder: {
    width: 96, height: 96, borderRadius: 48,
    backgroundColor: PRIMARY, alignItems: 'center', justifyContent: 'center',
  },
  userName: { fontSize: 22, fontWeight: 'bold', color: '#171717', marginBottom: 4 },
  userEmail: { fontSize: 14, color: GRAY, marginBottom: 12 },
  statusChip: { paddingHorizontal: 16, paddingVertical: 6, borderRadius: 20, marginBottom: 14 },
  statusComplete: { backgroundColor: 'rgba(34,197,94,0.1)' },
  statusPending: { backgroundColor: 'rgba(245,158,11,0.1)' },
  statusText: { fontSize: 13, fontWeight: '600' },
  editProfileButton: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 20, paddingVertical: 10,
    borderRadius: 20, borderWidth: 1.5, borderColor: PRIMARY,
  },
  editProfileButtonText: { color: PRIMARY, fontSize: 15, fontWeight: '600' },

  // Sections (read-only)
  sectionTitle: { fontSize: 13, fontWeight: '600', color: GRAY, marginTop: 12, marginBottom: 6, paddingHorizontal: 2 },
  card: { backgroundColor: WHITE, borderRadius: 12, marginBottom: 4, overflow: 'hidden' },
  row: {
    flexDirection: 'row', alignItems: 'center', padding: 14,
    borderBottomWidth: 1, borderBottomColor: '#f3f4f6',
  },
  rowLast: { borderBottomWidth: 0 },
  rowContent: { flex: 1, marginLeft: 12 },
  rowLabel: { fontSize: 11, color: GRAY },
  rowValue: { fontSize: 15, color: '#171717', marginTop: 2 },

  // Logout
  logoutButton: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    marginTop: 24, padding: 16, borderRadius: 12,
    borderWidth: 2, borderColor: '#ef4444', gap: 8,
  },
  logoutText: { color: '#ef4444', fontSize: 16, fontWeight: '600' },
  version: { textAlign: 'center', fontSize: 12, color: GRAY, marginTop: 16 },

  // Edit Modal
  editModal: { flex: 1, backgroundColor: BG },
  editHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: WHITE, paddingHorizontal: 16,
    paddingTop: 56, paddingBottom: 16,
    borderBottomWidth: 1, borderBottomColor: '#e5e7eb',
  },
  editHeaderBack: { padding: 4 },
  editHeaderTitle: { fontSize: 18, fontWeight: '600', color: '#171717' },
  editBody: { flex: 1 },
  editBodyContent: { padding: 16, paddingBottom: 48 },

  editSection: {
    fontSize: 13, fontWeight: '700', color: PRIMARY,
    marginBottom: 10, marginTop: 4,
    textTransform: 'uppercase', letterSpacing: 0.5,
  },
  editLabel: { fontSize: 13, color: GRAY, marginBottom: 4, marginLeft: 2 },
  editInput: {
    backgroundColor: WHITE, borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 13,
    fontSize: 15, color: '#171717', marginBottom: 12,
    borderWidth: 1, borderColor: '#e5e7eb',
  },
  editInputError: { borderColor: '#ef4444', marginBottom: 4 },
  editInputMultiline: { height: 110, textAlignVertical: 'top', paddingTop: 12 },
  editSelector: {
    backgroundColor: WHITE, borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 13,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginBottom: 12, borderWidth: 1, borderColor: '#e5e7eb',
  },
  editSelectorValue: { fontSize: 15, color: '#171717', flex: 1 },
  editSelectorPlaceholder: { fontSize: 15, color: '#9ca3af', flex: 1 },
  editError: { color: '#ef4444', fontSize: 12, marginBottom: 10, marginLeft: 4 },
  toggleRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: WHITE, borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 12,
    marginBottom: 12, borderWidth: 1, borderColor: '#e5e7eb',
  },
  toggleLabel: { fontSize: 15, color: '#171717', flex: 1, marginRight: 12 },
  saveButton: {
    backgroundColor: PRIMARY, borderRadius: 12,
    paddingVertical: 16, alignItems: 'center', marginTop: 20,
  },
  saveButtonDisabled: { opacity: 0.6 },
  saveButtonText: { color: WHITE, fontSize: 16, fontWeight: '700' },

  // Sub-modals (UF + catálogo)
  subOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  subSheet: { backgroundColor: WHITE, borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '70%' },
  subHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    padding: 16, borderBottomWidth: 1, borderBottomColor: '#e5e5e5',
  },
  subTitle: { fontSize: 18, fontWeight: '600', color: '#171717' },
  subItem: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 14, paddingHorizontal: 20,
    borderBottomWidth: 1, borderBottomColor: '#f3f4f6',
  },
  subItemSelected: { backgroundColor: 'rgba(26,133,155,0.07)' },
  subItemText: { fontSize: 16, color: '#171717' },
  subItemTextSelected: { color: PRIMARY, fontWeight: '600' },
});
