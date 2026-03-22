/**
 * Profile Screen
 * ==============
 * Exibe todos os dados do perfil e permite editar qualquer campo.
 * Inclui: dados pessoais, comunidade, vocacional, ministério,
 * informações extras (instagram, alimentação, saúde, acomodação, missão,
 * encontro Despertar) e contato de emergência.
 */

import { useState, useEffect, useCallback, memo } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Modal, TextInput, ActivityIndicator, FlatList,
  RefreshControl, Image, Switch, Platform, Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router, type Href } from 'expo-router';
import type { IoniconsName } from '@/types/icons';
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

const DESPERTAR_ENCOUNTERS = [
  'Água Viva','Juventude Livre','Fonte de Viver','Mir','Raios de Amor',
  'Chama Viva','Logos','Kyrios','Maria de Deus','Éfeta','Sanctus',
  'Gênesis','Ágape','Elyon','Khesed','Trinitas','Ixyus','Luz do Mundo',
  'Ruah','Mater Dei','Agnus Dei','Kaire','Adonai','Charitas','Ieshuah',
  'Kairós','Seraph','Kenosis','Parresia','Fides','Domus Dei','Magnificat',
  'Gaudium','Atrium','Ignis','Raboni','Pietá','Charis','Emanuel',
  'Totus Tuus','Fraternitas','Lazarus','Filho da Luz','Anawin',
  'Dilext Nos','Franciscus',
];

const ACCOMMODATION_OPTIONS = [
  { value: 'CAMA', label: 'Cama' },
  { value: 'REDE', label: 'Rede' },
  { value: 'COLCHAO_INFLAVEL', label: 'Colchão Inflável' },
];

const INSTRUMENTS = [
  'Violão', 'Guitarra', 'Bateria', 'Teclado', 'Voz',
  'Flauta', 'Saxofone', 'Trompete', 'Piano', 'Contrabaixo', 'Outro',
];

const DAYS = ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado', 'Domingo'];
const TURNS = ['Manhã', 'Tarde', 'Noite'];
const availKey = (day: string, turn: string) => `${day}-${turn}`;

// =============================================================================
// HELPERS
// =============================================================================

const isoToDisplay = (iso: string | null | undefined): string => {
  if (!iso) return '';
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
};

const e164ToDisplay = (e164: string | null | undefined): string => {
  if (!e164) return '';
  const digits = e164.replace(/\D/g, '');
  const local = digits.startsWith('55') ? digits.slice(2) : digits;
  if (local.length === 11) return `(${local.slice(0,2)}) ${local.slice(2,7)}-${local.slice(7)}`;
  if (local.length === 10) return `(${local.slice(0,2)}) ${local.slice(2,6)}-${local.slice(6)}`;
  return e164;
};

const formatPhone = (v: string): string => {
  const d = v.replace(/\D/g, '').slice(0, 11);
  if (d.length <= 2) return d;
  if (d.length <= 6) return `(${d.slice(0,2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0,2)}) ${d.slice(2,6)}-${d.slice(6)}`;
  return `(${d.slice(0,2)}) ${d.slice(2,7)}-${d.slice(7)}`;
};

const formatDate = (v: string): string => {
  const d = v.replace(/\D/g, '').slice(0, 8);
  if (d.length <= 2) return d;
  if (d.length <= 4) return `${d.slice(0,2)}/${d.slice(2)}`;
  return `${d.slice(0,2)}/${d.slice(2,4)}/${d.slice(4)}`;
};

const accommodationLabel = (val: string | null | undefined) =>
  ACCOMMODATION_OPTIONS.find(o => o.value === val)?.label ?? val ?? '';

// =============================================================================
// TELA PRINCIPAL
// =============================================================================

export default function ProfileScreen() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');

  // Catálogos
  const [lifeStates, setLifeStates] = useState<CatalogItem[]>([]);
  const [maritalStatuses, setMaritalStatuses] = useState<CatalogItem[]>([]);
  const [vocationalRealities, setVocationalRealities] = useState<CatalogItem[]>([]);

  // Modal principal de edição
  const [editVisible, setEditVisible] = useState(false);

  // Campos agrupados por seção
  const [editPersonal, setEditPersonal] = useState({ name: '', phone: '', birthDate: '', uf: '', city: '', instagram: '' });
  const [editCommunity, setEditCommunity] = useState({
    lifeState: null as CatalogItem | null, marital: null as CatalogItem | null,
    vocational: null as CatalogItem | null, despertar: '', hasAccomp: false,
    accompName: '', interestedMinistry: false, ministryNotes: '',
    isFromMission: false, missionName: '',
  });
  const [editExtra, setEditExtra] = useState({
    accommodation: '', dietaryRestriction: false, dietaryNotes: '',
    healthInsurance: false, healthInsuranceName: '',
  });
  const [editMusic, setEditMusic] = useState({
    playsInstrument: false, instrumentNames: [] as string[],
    availableForGroup: false, musicAvailability: [] as string[],
  });
  const [editEmergency, setEditEmergency] = useState({ name: '', relationship: '', phone: '' });

  const [editErrors, setEditErrors] = useState<Record<string, string>>({});

  // Sub-modais
  const [ufModalVisible, setUfModalVisible] = useState(false);
  const [catalogModalVisible, setCatalogModalVisible] = useState(false);
  const [catalogOptions, setCatalogOptions] = useState<CatalogItem[]>([]);
  const [catalogTitle, setCatalogTitle] = useState('');
  const [catalogOnSelect, setCatalogOnSelect] = useState<(item: CatalogItem) => void>(() => () => {});
  const [accommodationModalVisible, setAccommodationModalVisible] = useState(false);
  const [despertarModalVisible, setDespertarModalVisible] = useState(false);

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
    } catch { /* silencioso */ }
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadProfile();
    setRefreshing(false);
  }, []);

  // ---------------------------------------------------------------------------
  // Abre o modal populando todos os campos
  // ---------------------------------------------------------------------------
  const openEditModal = () => {
    if (!profile) return;
    setEditPersonal({
      name: profile.full_name ?? '',
      phone: e164ToDisplay(profile.phone_e164),
      birthDate: isoToDisplay(profile.birth_date),
      uf: profile.state ?? '',
      city: profile.city ?? '',
      instagram: profile.instagram ?? '',
    });
    setEditCommunity({
      lifeState: lifeStates.find(i => i.id === profile.life_state_item_id) ?? null,
      marital: maritalStatuses.find(i => i.id === profile.marital_status_item_id) ?? null,
      vocational: vocationalRealities.find(i => i.id === profile.vocational_reality_item_id) ?? null,
      despertar: profile.despertar_encounter ?? '',
      hasAccomp: profile.has_vocational_accompaniment ?? false,
      accompName: profile.vocational_accompanist_name ?? '',
      interestedMinistry: profile.interested_in_ministry ?? false,
      ministryNotes: profile.ministry_interest_notes ?? '',
      isFromMission: profile.is_from_mission ?? false,
      missionName: profile.mission_name ?? '',
    });
    setEditExtra({
      accommodation: profile.accommodation_preference ?? '',
      dietaryRestriction: profile.dietary_restriction ?? false,
      dietaryNotes: profile.dietary_restriction_notes ?? '',
      healthInsurance: profile.health_insurance ?? false,
      healthInsuranceName: profile.health_insurance_name ?? '',
    });
    setEditMusic({
      playsInstrument: profile.plays_instrument ?? false,
      instrumentNames: profile.instrument_names ?? [],
      availableForGroup: profile.available_for_group ?? false,
      musicAvailability: profile.music_availability ?? [],
    });
    const ec = profile.emergency_contacts?.[0];
    setEditEmergency({
      name: ec?.name ?? '',
      relationship: ec?.relationship ?? '',
      phone: ec ? e164ToDisplay(ec.phone_e164) : '',
    });
    setEditErrors({});
    setSaveError('');
    setEditVisible(true);
  };

  const openCatalogModal = (title: string, options: CatalogItem[], onSelect: (item: CatalogItem) => void) => {
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
    if (editPersonal.name.trim().length < 2) e.name = 'Nome obrigatório (mín. 2 caracteres)';
    if (editPersonal.phone.replace(/\D/g, '').length < 10) e.phone = 'Telefone inválido';
    const parts = editPersonal.birthDate.split('/');
    if (parts.length !== 3 || (parts[2] ?? '').length !== 4) e.birthDate = 'Data inválida (DD/MM/AAAA)';
    if (!editPersonal.uf) e.uf = 'Selecione o estado';
    if (editPersonal.city.trim().length < 2) e.city = 'Cidade obrigatória';
    if (editCommunity.hasAccomp && !editCommunity.accompName.trim()) e.accompName = 'Informe o nome do acompanhador';
    if (editCommunity.interestedMinistry && !editCommunity.ministryNotes.trim()) e.ministryNotes = 'Descreva o interesse';
    setEditErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSaveProfile = async () => {
    if (!validateEdit()) return;
    setSaving(true);
    setSaveError('');
    try {
      const [dd, mm, yyyy] = editPersonal.birthDate.split('/');
      const phoneDigits = editPersonal.phone.replace(/\D/g, '');
      await profileService.updateProfile({
        full_name: editPersonal.name.trim(),
        birth_date: `${yyyy}-${mm}-${dd}`,
        phone_e164: `+55${phoneDigits}`,
        city: editPersonal.city.trim(),
        state: editPersonal.uf,
        photo_url: profile?.photo_url ?? null,
        life_state_item_id: editCommunity.lifeState?.id ?? null,
        marital_status_item_id: editCommunity.marital?.id ?? null,
        vocational_reality_item_id: editCommunity.vocational?.id ?? null,
        has_vocational_accompaniment: editCommunity.hasAccomp,
        vocational_accompanist_name: editCommunity.hasAccomp ? editCommunity.accompName.trim() : null,
        interested_in_ministry: editCommunity.interestedMinistry,
        ministry_interest_notes: editCommunity.interestedMinistry ? editCommunity.ministryNotes.trim() : null,
        instagram: editPersonal.instagram.trim() || null,
        dietary_restriction: editExtra.dietaryRestriction,
        dietary_restriction_notes: editExtra.dietaryRestriction ? editExtra.dietaryNotes.trim() || null : null,
        health_insurance: editExtra.healthInsurance,
        health_insurance_name: editExtra.healthInsurance ? editExtra.healthInsuranceName.trim() || null : null,
        accommodation_preference: editExtra.accommodation || null,
        is_from_mission: editCommunity.isFromMission,
        mission_name: editCommunity.isFromMission ? editCommunity.missionName.trim() || null : null,
        despertar_encounter: editCommunity.despertar || null,
        plays_instrument: editMusic.playsInstrument,
        instrument_names: editMusic.playsInstrument ? editMusic.instrumentNames : null,
        available_for_group: editMusic.playsInstrument ? editMusic.availableForGroup : null,
        music_availability: editMusic.playsInstrument && editMusic.availableForGroup ? editMusic.musicAvailability : null,
      });

      // Salva contato de emergência se nome preenchido
      if (editEmergency.name.trim()) {
        await profileService.addEmergencyContact({
          name: editEmergency.name.trim(),
          phone_e164: `+55${editEmergency.phone.replace(/\D/g, '')}`,
          relationship: editEmergency.relationship.trim() || 'Não informado',
        });
      }

      await loadProfile();
      setEditVisible(false);
    } catch (err: any) {
      // Loga o erro completo para diagnóstico
      console.error('[handleSaveProfile] Erro ao salvar perfil:', JSON.stringify(err?.response?.data ?? err?.message ?? err));
      const status = err?.response?.status;
      const detail = err?.response?.data?.detail;
      let msg = 'Não foi possível salvar. Tente novamente.';
      if (typeof detail === 'string') msg = detail;
      else if (detail?.message) msg = detail.message;
      else if (Array.isArray(detail) && detail[0]?.msg) msg = `Dado inválido: ${detail[0].msg}`;
      else if (status === 409) msg = 'Conflito: telefone ou CPF já cadastrado.';
      else if (status === 503) msg = 'Serviço temporariamente indisponível.';
      setSaveError(msg);
      // Alert popup para garantir visibilidade do erro
      Alert.alert('Erro ao Salvar', msg, [{ text: 'OK' }]);
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = () => {
    if (Platform.OS === 'web') {
      if (window.confirm('Deseja realmente sair da sua conta?')) {
        signOut(auth).then(() => router.replace('/(auth)/login'));
      }
    } else {
      import('react-native').then(({ Alert }) => {
        Alert.alert('Sair', 'Deseja realmente sair da sua conta?', [
          { text: 'Cancelar', style: 'cancel' },
          { text: 'Sair', style: 'destructive', onPress: async () => { await signOut(auth); router.replace('/(auth)/login'); } },
        ]);
      });
    }
  };

  if (loading) {
    return <View style={styles.loadingContainer}><ActivityIndicator size="large" color={PRIMARY} /></View>;
  }

  const isComplete = profile?.status === 'COMPLETE';
  const ec = profile?.emergency_contacts?.[0];

  return (
    <View style={{ flex: 1 }}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[PRIMARY]} />}
      >
        {/* ── Header ── */}
        <View style={styles.headerCard}>
          <View style={styles.avatarContainer}>
            {profile?.photo_url
              ? <Image source={{ uri: profile.photo_url }} style={styles.avatar} />
              : <View style={styles.avatarPlaceholder}><Ionicons name="person" size={48} color={WHITE} /></View>
            }
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

        {/* ── Dados Pessoais ── */}
        <SectionTitle>Dados Pessoais</SectionTitle>
        <View style={styles.card}>
          <InfoRow icon="person-outline" label="Nome" value={profile?.full_name} />
          <InfoRow icon="calendar-outline" label="Nascimento" value={isoToDisplay(profile?.birth_date) || undefined} />
          <InfoRow icon="call-outline" label="Telefone" value={e164ToDisplay(profile?.phone_e164) || undefined} />
          <InfoRow icon="logo-instagram" label="Instagram" value={profile?.instagram} />
          <InfoRow icon="map-outline" label="Estado" value={profile?.state} />
          <InfoRow icon="location-outline" label="Cidade" value={profile?.city} last />
        </View>

        {/* ── Informações da Comunidade ── */}
        <SectionTitle>Informações da Comunidade</SectionTitle>
        <View style={styles.card}>
          <InfoRow icon="heart-outline" label="Estado de Vida" value={profile?.life_state_label} />
          <InfoRow icon="people-outline" label="Estado Civil" value={profile?.marital_status_label} />
          <InfoRow icon="star-outline" label="Realidade Vocacional" value={profile?.vocational_reality_label} />
          <InfoRow icon="flame-outline" label="Encontro Despertar" value={profile?.despertar_encounter} />
          <InfoRow icon="globe-outline" label="É de alguma Missão"
            value={profile?.is_from_mission == null ? undefined : profile.is_from_mission ? (profile.mission_name ?? 'Sim') : 'Não'} last />
        </View>

        {/* ── Retiros e Eventos ── */}
        <SectionTitle>Retiros e Eventos</SectionTitle>
        <View style={styles.card}>
          <InfoRow icon="bed-outline" label="Preferência de Acomodação"
            value={accommodationLabel(profile?.accommodation_preference) || undefined} />
          <InfoRow icon="restaurant-outline" label="Restrição Alimentar"
            value={profile?.dietary_restriction == null ? undefined
              : profile.dietary_restriction ? (profile.dietary_restriction_notes ?? 'Sim') : 'Não'} />
          <InfoRow icon="medkit-outline" label="Plano de Saúde"
            value={profile?.health_insurance == null ? undefined
              : profile.health_insurance ? (profile.health_insurance_name ?? 'Sim') : 'Não'} last />
        </View>

        {/* ── Acompanhamento Vocacional ── */}
        <SectionTitle>Acompanhamento Vocacional</SectionTitle>
        <View style={styles.card}>
          <InfoRow icon="hand-left-outline" label="Possui acompanhamento"
            value={profile?.has_vocational_accompaniment == null ? undefined
              : profile.has_vocational_accompaniment ? 'Sim' : 'Não'} />
          {profile?.has_vocational_accompaniment
            ? <InfoRow icon="person-circle-outline" label="Acompanhador"
                value={profile.vocational_accompanist_display_name ?? profile.vocational_accompanist_name} last />
            : <View style={{ height: 2 }} />
          }
        </View>

        {/* ── Interesse em Ministério ── */}
        <SectionTitle>Interesse em Ministério</SectionTitle>
        <View style={styles.card}>
          <InfoRow icon="flag-outline" label="Tem interesse"
            value={profile?.interested_in_ministry == null ? undefined
              : profile.interested_in_ministry ? 'Sim' : 'Não'} />
          {profile?.interested_in_ministry && profile?.ministry_interest_notes
            ? <InfoRow icon="document-text-outline" label="Observações" value={profile.ministry_interest_notes} last />
            : <View style={{ height: 2 }} />
          }
        </View>

        {/* ── Música e Ministério Musical ── */}
        <SectionTitle>Música e Ministério Musical</SectionTitle>
        <View style={styles.card}>
          <InfoRow icon="musical-notes-outline" label="Toca instrumento ou canta"
            value={profile?.plays_instrument == null ? undefined
              : profile.plays_instrument ? 'Sim' : 'Não'} />
          {profile?.plays_instrument && profile.instrument_names?.length ? (
            <InfoRow icon="musical-note-outline" label="Instrumento(s)"
              value={profile.instrument_names.join(', ')} />
          ) : null}
          {profile?.plays_instrument ? (
            <InfoRow icon="people-outline" label="Disponível para grupo"
              value={profile.available_for_group == null ? undefined
                : profile.available_for_group ? 'Sim' : 'Não'} />
          ) : null}
          {profile?.plays_instrument && profile.available_for_group && profile.music_availability?.length ? (
            <InfoRow icon="time-outline" label="Disponibilidade"
              value={profile.music_availability.join(', ')} last />
          ) : (
            <View style={{ height: 2 }} />
          )}
        </View>

        {/* ── Contato de Emergência ── */}
        <SectionTitle>Contato de Emergência</SectionTitle>
        <View style={styles.card}>
          <InfoRow icon="person-add-outline" label="Nome" value={ec?.name} />
          <InfoRow icon="heart-circle-outline" label="Parentesco" value={ec?.relationship} />
          <InfoRow icon="call-outline" label="Telefone" value={e164ToDisplay(ec?.phone_e164) || undefined} last />
        </View>

        {/* ── Sair ── */}
        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
          <Ionicons name="log-out-outline" size={20} color="#ef4444" />
          <Text style={styles.logoutText}>Sair da Conta</Text>
        </TouchableOpacity>
        <Text style={styles.version}>Lumen+ v1.0.0</Text>
      </ScrollView>

      {/* ══════════════════════════════════════════════════════════
          Modal: Editar Perfil
      ══════════════════════════════════════════════════════════ */}
      <Modal visible={editVisible} animationType="slide" presentationStyle="pageSheet"
        onRequestClose={() => !saving && setEditVisible(false)}>
        <View style={styles.editModal}>
          <View style={styles.editHeader}>
            <TouchableOpacity onPress={() => !saving && setEditVisible(false)} style={styles.editHeaderBack}>
              <Ionicons name="arrow-back" size={24} color="#171717" />
            </TouchableOpacity>
            <Text style={styles.editHeaderTitle}>Editar Perfil</Text>
            <View style={{ width: 40 }} />
          </View>

          <ScrollView style={styles.editBody} contentContainerStyle={styles.editBodyContent} keyboardShouldPersistTaps="handled">

            {/* ─ Dados Pessoais ─ */}
            <Text style={styles.editSection}>Dados Pessoais</Text>

            <Text style={styles.editLabel}>Nome completo *</Text>
            <TextInput style={[styles.editInput, editErrors.name ? styles.editInputError : null]}
              value={editPersonal.name} onChangeText={t => { setEditPersonal(p => ({ ...p, name: t })); setEditErrors(p => ({ ...p, name: '' })); }}
              placeholder="Nome completo" autoCapitalize="words" />
            {editErrors.name ? <Text style={styles.editError}>{editErrors.name}</Text> : null}

            <Text style={styles.editLabel}>Telefone (WhatsApp) *</Text>
            <TextInput style={[styles.editInput, editErrors.phone ? styles.editInputError : null]}
              value={editPersonal.phone} onChangeText={t => { setEditPersonal(p => ({ ...p, phone: formatPhone(t) })); setEditErrors(p => ({ ...p, phone: '' })); }}
              placeholder="(11) 99999-9999" keyboardType="phone-pad" />
            {editErrors.phone ? <Text style={styles.editError}>{editErrors.phone}</Text> : null}

            <Text style={styles.editLabel}>Data de nascimento *</Text>
            <TextInput style={[styles.editInput, editErrors.birthDate ? styles.editInputError : null]}
              value={editPersonal.birthDate} onChangeText={t => { setEditPersonal(p => ({ ...p, birthDate: formatDate(t) })); setEditErrors(p => ({ ...p, birthDate: '' })); }}
              placeholder="DD/MM/AAAA" keyboardType="numeric" />
            {editErrors.birthDate ? <Text style={styles.editError}>{editErrors.birthDate}</Text> : null}

            <Text style={styles.editLabel}>Estado (UF) *</Text>
            <TouchableOpacity style={[styles.editSelector, editErrors.uf ? styles.editInputError : null]}
              onPress={() => setUfModalVisible(true)}>
              <Text style={editPersonal.uf ? styles.editSelectorValue : styles.editSelectorPlaceholder}>
                {editPersonal.uf || 'Selecione o estado'}
              </Text>
              <Ionicons name="chevron-down" size={18} color={GRAY} />
            </TouchableOpacity>
            {editErrors.uf ? <Text style={styles.editError}>{editErrors.uf}</Text> : null}

            <Text style={styles.editLabel}>Cidade *</Text>
            <TextInput style={[styles.editInput, editErrors.city ? styles.editInputError : null]}
              value={editPersonal.city} onChangeText={t => { setEditPersonal(p => ({ ...p, city: t })); setEditErrors(p => ({ ...p, city: '' })); }}
              placeholder="Sua cidade" autoCapitalize="words" />
            {editErrors.city ? <Text style={styles.editError}>{editErrors.city}</Text> : null}

            <Text style={styles.editLabel}>Instagram</Text>
            <TextInput style={styles.editInput} value={editPersonal.instagram}
              onChangeText={t => setEditPersonal(p => ({ ...p, instagram: t }))}
              placeholder="@usuario" autoCapitalize="none" />

            {/* ─ Informações da Comunidade ─ */}
            <Text style={[styles.editSection, { marginTop: 8 }]}>Informações da Comunidade</Text>

            <Text style={styles.editLabel}>Estado de Vida</Text>
            <TouchableOpacity style={styles.editSelector}
              onPress={() => openCatalogModal('Estado de Vida', lifeStates, item => { setEditCommunity(p => ({ ...p, lifeState: item })); setCatalogModalVisible(false); })}>
              <Text style={editCommunity.lifeState ? styles.editSelectorValue : styles.editSelectorPlaceholder}>
                {editCommunity.lifeState?.label || 'Selecionar'}
              </Text>
              <Ionicons name="chevron-down" size={18} color={GRAY} />
            </TouchableOpacity>

            <Text style={styles.editLabel}>Estado Civil</Text>
            <TouchableOpacity style={styles.editSelector}
              onPress={() => openCatalogModal('Estado Civil', maritalStatuses, item => { setEditCommunity(p => ({ ...p, marital: item })); setCatalogModalVisible(false); })}>
              <Text style={editCommunity.marital ? styles.editSelectorValue : styles.editSelectorPlaceholder}>
                {editCommunity.marital?.label || 'Selecionar'}
              </Text>
              <Ionicons name="chevron-down" size={18} color={GRAY} />
            </TouchableOpacity>

            <Text style={styles.editLabel}>Realidade Vocacional</Text>
            <TouchableOpacity style={styles.editSelector}
              onPress={() => openCatalogModal('Realidade Vocacional', vocationalRealities, item => { setEditCommunity(p => ({ ...p, vocational: item })); setCatalogModalVisible(false); })}>
              <Text style={editCommunity.vocational ? styles.editSelectorValue : styles.editSelectorPlaceholder}>
                {editCommunity.vocational?.label || 'Selecionar'}
              </Text>
              <Ionicons name="chevron-down" size={18} color={GRAY} />
            </TouchableOpacity>

            <Text style={styles.editLabel}>Encontro Despertar</Text>
            <TouchableOpacity style={styles.editSelector} onPress={() => setDespertarModalVisible(true)}>
              <Text style={editCommunity.despertar ? styles.editSelectorValue : styles.editSelectorPlaceholder}>
                {editCommunity.despertar || 'Selecionar encontro'}
              </Text>
              <Ionicons name="chevron-down" size={18} color={GRAY} />
            </TouchableOpacity>

            <View style={styles.toggleRow}>
              <Text style={styles.toggleLabel}>É de alguma missão?</Text>
              <Switch value={editCommunity.isFromMission}
                onValueChange={v => setEditCommunity(p => ({ ...p, isFromMission: v, missionName: v ? p.missionName : '' }))}
                trackColor={{ false: '#d1d5db', true: `${PRIMARY}80` }}
                thumbColor={editCommunity.isFromMission ? PRIMARY : '#9ca3af'} />
            </View>
            {editCommunity.isFromMission && (
              <>
                <Text style={styles.editLabel}>Qual missão?</Text>
                <TextInput style={styles.editInput} value={editCommunity.missionName}
                  onChangeText={t => setEditCommunity(p => ({ ...p, missionName: t }))} placeholder="Nome da missão" />
              </>
            )}

            {/* ─ Acompanhamento Vocacional ─ */}
            <Text style={[styles.editSection, { marginTop: 8 }]}>Acompanhamento Vocacional</Text>

            <View style={styles.toggleRow}>
              <Text style={styles.toggleLabel}>Possui acompanhamento vocacional?</Text>
              <Switch value={editCommunity.hasAccomp}
                onValueChange={v => { setEditCommunity(p => ({ ...p, hasAccomp: v })); if (!v) setEditErrors(p => ({ ...p, accompName: '' })); }}
                trackColor={{ false: '#d1d5db', true: `${PRIMARY}80` }}
                thumbColor={editCommunity.hasAccomp ? PRIMARY : '#9ca3af'} />
            </View>
            {editCommunity.hasAccomp && (
              <>
                <Text style={styles.editLabel}>Nome do acompanhador *</Text>
                <TextInput style={[styles.editInput, editErrors.accompName ? styles.editInputError : null]}
                  value={editCommunity.accompName}
                  onChangeText={t => { setEditCommunity(p => ({ ...p, accompName: t })); setEditErrors(p => ({ ...p, accompName: '' })); }}
                  placeholder="Nome completo do acompanhador" autoCapitalize="words" />
                {editErrors.accompName ? <Text style={styles.editError}>{editErrors.accompName}</Text> : null}
              </>
            )}

            {/* ─ Interesse em Ministério ─ */}
            <Text style={[styles.editSection, { marginTop: 8 }]}>Interesse em Ministério</Text>

            <View style={styles.toggleRow}>
              <Text style={styles.toggleLabel}>Tem interesse em ministério?</Text>
              <Switch value={editCommunity.interestedMinistry}
                onValueChange={v => { setEditCommunity(p => ({ ...p, interestedMinistry: v })); if (!v) setEditErrors(p => ({ ...p, ministryNotes: '' })); }}
                trackColor={{ false: '#d1d5db', true: `${PRIMARY}80` }}
                thumbColor={editCommunity.interestedMinistry ? PRIMARY : '#9ca3af'} />
            </View>
            {editCommunity.interestedMinistry && (
              <>
                <Text style={styles.editLabel}>Descreva o interesse *</Text>
                <TextInput style={[styles.editInput, styles.editInputMultiline, editErrors.ministryNotes ? styles.editInputError : null]}
                  value={editCommunity.ministryNotes}
                  onChangeText={t => { setEditCommunity(p => ({ ...p, ministryNotes: t })); setEditErrors(p => ({ ...p, ministryNotes: '' })); }}
                  placeholder="Em qual(is) ministério(s) tem interesse e por quê..."
                  multiline numberOfLines={4} />
                {editErrors.ministryNotes ? <Text style={styles.editError}>{editErrors.ministryNotes}</Text> : null}
              </>
            )}

            {/* ─ Música e Ministério Musical ─ */}
            <Text style={[styles.editSection, { marginTop: 8 }]}>Música e Ministério Musical</Text>

            <View style={styles.toggleRow}>
              <Text style={styles.toggleLabel}>Toca instrumento ou canta?</Text>
              <Switch value={editMusic.playsInstrument}
                onValueChange={v => setEditMusic(p => ({
                  ...p,
                  playsInstrument: v,
                  instrumentNames: v ? p.instrumentNames : [],
                  availableForGroup: v ? p.availableForGroup : false,
                  musicAvailability: v ? p.musicAvailability : [],
                }))
                }
                trackColor={{ false: '#d1d5db', true: `${PRIMARY}80` }}
                thumbColor={editMusic.playsInstrument ? PRIMARY : '#9ca3af'} />
            </View>

            {editMusic.playsInstrument && (
              <>
                <Text style={styles.editLabel}>Qual(is) instrumento(s)?</Text>
                <View style={styles.chipsContainer}>
                  {INSTRUMENTS.map(inst => {
                    const selected = editMusic.instrumentNames.includes(inst);
                    return (
                      <TouchableOpacity
                        key={inst}
                        style={[styles.chip, selected && styles.chipSelected]}
                        onPress={() => setEditMusic(p => ({
                          ...p,
                          instrumentNames: selected
                            ? p.instrumentNames.filter(i => i !== inst)
                            : [...p.instrumentNames, inst],
                        }))}
                      >
                        <Text style={[styles.chipText, selected && styles.chipTextSelected]}>
                          {inst}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                <View style={[styles.toggleRow, { marginTop: 12 }]}>
                  <Text style={styles.toggleLabel}>Disponível para servir em grupo?</Text>
                  <Switch value={editMusic.availableForGroup}
                    onValueChange={v => setEditMusic(p => ({
                      ...p, availableForGroup: v, musicAvailability: v ? p.musicAvailability : [],
                    }))}
                    trackColor={{ false: '#d1d5db', true: `${PRIMARY}80` }}
                    thumbColor={editMusic.availableForGroup ? PRIMARY : '#9ca3af'} />
                </View>

                {editMusic.availableForGroup && (
                  <>
                    <Text style={styles.editLabel}>Quais dias e turnos?</Text>
                    <View style={styles.availGrid}>
                      <View style={styles.availHeaderRow}>
                        <View style={styles.availDayCell} />
                        {TURNS.map(turn => (
                          <Text key={turn} style={styles.availTurnHeader}>{turn}</Text>
                        ))}
                      </View>
                      {DAYS.map(day => (
                        <View key={day} style={styles.availRow}>
                          <Text style={styles.availDayLabel}>{day}</Text>
                          {TURNS.map(turn => {
                            const key = availKey(day, turn);
                            const checked = editMusic.musicAvailability.includes(key);
                            return (
                              <TouchableOpacity
                                key={turn}
                                style={[styles.availCell, checked && styles.availCellChecked]}
                                onPress={() => setEditMusic(p => ({
                                  ...p,
                                  musicAvailability: checked
                                    ? p.musicAvailability.filter(k => k !== key)
                                    : [...p.musicAvailability, key],
                                }))}
                              >
                                {checked && <Ionicons name="checkmark" size={14} color={WHITE} />}
                              </TouchableOpacity>
                            );
                          })}
                        </View>
                      ))}
                    </View>
                  </>
                )}
              </>
            )}

            {/* ─ Retiros e Eventos ─ */}
            <Text style={[styles.editSection, { marginTop: 8 }]}>Retiros e Eventos</Text>

            <Text style={styles.editLabel}>Preferência de Acomodação</Text>
            <TouchableOpacity style={styles.editSelector} onPress={() => setAccommodationModalVisible(true)}>
              <Text style={editExtra.accommodation ? styles.editSelectorValue : styles.editSelectorPlaceholder}>
                {ACCOMMODATION_OPTIONS.find(o => o.value === editExtra.accommodation)?.label || 'Selecionar'}
              </Text>
              <Ionicons name="chevron-down" size={18} color={GRAY} />
            </TouchableOpacity>

            <View style={styles.toggleRow}>
              <Text style={styles.toggleLabel}>Restrição alimentar?</Text>
              <Switch value={editExtra.dietaryRestriction}
                onValueChange={v => setEditExtra(p => ({ ...p, dietaryRestriction: v, dietaryNotes: v ? p.dietaryNotes : '' }))}
                trackColor={{ false: '#d1d5db', true: `${PRIMARY}80` }}
                thumbColor={editExtra.dietaryRestriction ? PRIMARY : '#9ca3af'} />
            </View>
            {editExtra.dietaryRestriction && (
              <>
                <Text style={styles.editLabel}>Quais restrições?</Text>
                <TextInput style={styles.editInput} value={editExtra.dietaryNotes}
                  onChangeText={t => setEditExtra(p => ({ ...p, dietaryNotes: t }))} placeholder="Ex: Vegano, Sem glúten..." />
              </>
            )}

            <View style={styles.toggleRow}>
              <Text style={styles.toggleLabel}>Possui plano de saúde?</Text>
              <Switch value={editExtra.healthInsurance}
                onValueChange={v => setEditExtra(p => ({ ...p, healthInsurance: v, healthInsuranceName: v ? p.healthInsuranceName : '' }))}
                trackColor={{ false: '#d1d5db', true: `${PRIMARY}80` }}
                thumbColor={editExtra.healthInsurance ? PRIMARY : '#9ca3af'} />
            </View>
            {editExtra.healthInsurance && (
              <>
                <Text style={styles.editLabel}>Qual plano?</Text>
                <TextInput style={styles.editInput} value={editExtra.healthInsuranceName}
                  onChangeText={t => setEditExtra(p => ({ ...p, healthInsuranceName: t }))} placeholder="Ex: Unimed, Bradesco Saúde..." />
              </>
            )}

            {/* ─ Contato de Emergência ─ */}
            <Text style={[styles.editSection, { marginTop: 8 }]}>Contato de Emergência</Text>

            <Text style={styles.editLabel}>Nome</Text>
            <TextInput style={styles.editInput} value={editEmergency.name}
              onChangeText={t => setEditEmergency(p => ({ ...p, name: t }))} placeholder="Nome do contato" autoCapitalize="words" />

            <Text style={styles.editLabel}>Parentesco</Text>
            <TextInput style={styles.editInput} value={editEmergency.relationship}
              onChangeText={t => setEditEmergency(p => ({ ...p, relationship: t }))} placeholder="Ex: Mãe, Pai, Cônjuge" autoCapitalize="words" />

            <Text style={styles.editLabel}>Telefone</Text>
            <TextInput style={styles.editInput} value={editEmergency.phone}
              onChangeText={t => setEditEmergency(p => ({ ...p, phone: formatPhone(t) }))}
              placeholder="(11) 99999-9999" keyboardType="phone-pad" />

            {saveError ? (
              <View style={styles.saveErrorBox}>
                <Text style={styles.saveErrorText}>⚠️ {saveError}</Text>
              </View>
            ) : null}

            <TouchableOpacity style={[styles.saveButton, saving ? styles.saveButtonDisabled : null]}
              onPress={handleSaveProfile} disabled={saving}>
              {saving
                ? <ActivityIndicator color={WHITE} />
                : <Text style={styles.saveButtonText}>Salvar Perfil</Text>
              }
            </TouchableOpacity>
          </ScrollView>
        </View>
      </Modal>

      {/* ══ Sub-modal: UF ══ */}
      <Modal visible={ufModalVisible} animationType="slide" transparent onRequestClose={() => setUfModalVisible(false)}>
        <View style={styles.subOverlay}>
          <View style={styles.subSheet}>
            <View style={styles.subHeader}>
              <Text style={styles.subTitle}>Estado (UF)</Text>
              <TouchableOpacity onPress={() => setUfModalVisible(false)}>
                <Ionicons name="close" size={24} color={GRAY} />
              </TouchableOpacity>
            </View>
            <FlatList data={BR_STATES} keyExtractor={item => item}
              renderItem={({ item }) => (
                <TouchableOpacity style={[styles.subItem, editPersonal.uf === item ? styles.subItemSelected : null]}
                  onPress={() => { setEditPersonal(p => ({ ...p, uf: item })); setEditErrors(p => ({ ...p, uf: '' })); setUfModalVisible(false); }}>
                  <Text style={[styles.subItemText, editPersonal.uf === item ? styles.subItemTextSelected : null]}>{item}</Text>
                  {editPersonal.uf === item && <Ionicons name="checkmark" size={20} color={PRIMARY} />}
                </TouchableOpacity>
              )}
            />
          </View>
        </View>
      </Modal>

      {/* ══ Sub-modal: Catálogo ══ */}
      <Modal visible={catalogModalVisible} animationType="slide" transparent onRequestClose={() => setCatalogModalVisible(false)}>
        <View style={styles.subOverlay}>
          <View style={styles.subSheet}>
            <View style={styles.subHeader}>
              <Text style={styles.subTitle}>{catalogTitle}</Text>
              <TouchableOpacity onPress={() => setCatalogModalVisible(false)}>
                <Ionicons name="close" size={24} color={GRAY} />
              </TouchableOpacity>
            </View>
            <FlatList data={catalogOptions} keyExtractor={item => item.id}
              renderItem={({ item }) => {
                const isSelected =
                  (catalogTitle === 'Estado de Vida' && editCommunity.lifeState?.id === item.id) ||
                  (catalogTitle === 'Estado Civil' && editCommunity.marital?.id === item.id) ||
                  (catalogTitle === 'Realidade Vocacional' && editCommunity.vocational?.id === item.id);
                return (
                  <TouchableOpacity style={[styles.subItem, isSelected ? styles.subItemSelected : null]}
                    onPress={() => catalogOnSelect(item)}>
                    <Text style={[styles.subItemText, isSelected ? styles.subItemTextSelected : null]}>{item.label}</Text>
                    {isSelected && <Ionicons name="checkmark" size={20} color={PRIMARY} />}
                  </TouchableOpacity>
                );
              }}
            />
          </View>
        </View>
      </Modal>

      {/* ══ Sub-modal: Acomodação ══ */}
      <Modal visible={accommodationModalVisible} animationType="slide" transparent onRequestClose={() => setAccommodationModalVisible(false)}>
        <View style={styles.subOverlay}>
          <View style={styles.subSheet}>
            <View style={styles.subHeader}>
              <Text style={styles.subTitle}>Preferência de Acomodação</Text>
              <TouchableOpacity onPress={() => setAccommodationModalVisible(false)}>
                <Ionicons name="close" size={24} color={GRAY} />
              </TouchableOpacity>
            </View>
            {ACCOMMODATION_OPTIONS.map(opt => (
              <TouchableOpacity key={opt.value}
                style={[styles.subItem, editExtra.accommodation === opt.value ? styles.subItemSelected : null]}
                onPress={() => { setEditExtra(p => ({ ...p, accommodation: opt.value })); setAccommodationModalVisible(false); }}>
                <Text style={[styles.subItemText, editExtra.accommodation === opt.value ? styles.subItemTextSelected : null]}>{opt.label}</Text>
                {editExtra.accommodation === opt.value && <Ionicons name="checkmark" size={20} color={PRIMARY} />}
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </Modal>

      {/* ══ Sub-modal: Despertar ══ */}
      <Modal visible={despertarModalVisible} animationType="slide" transparent onRequestClose={() => setDespertarModalVisible(false)}>
        <View style={styles.subOverlay}>
          <View style={styles.subSheet}>
            <View style={styles.subHeader}>
              <Text style={styles.subTitle}>Encontro Despertar</Text>
              <TouchableOpacity onPress={() => setDespertarModalVisible(false)}>
                <Ionicons name="close" size={24} color={GRAY} />
              </TouchableOpacity>
            </View>
            <FlatList data={DESPERTAR_ENCOUNTERS} keyExtractor={item => item}
              renderItem={({ item }) => (
                <TouchableOpacity style={[styles.subItem, editCommunity.despertar === item ? styles.subItemSelected : null]}
                  onPress={() => { setEditCommunity(p => ({ ...p, despertar: item })); setDespertarModalVisible(false); }}>
                  <Text style={[styles.subItemText, editCommunity.despertar === item ? styles.subItemTextSelected : null]}>{item}</Text>
                  {editCommunity.despertar === item && <Ionicons name="checkmark" size={20} color={PRIMARY} />}
                </TouchableOpacity>
              )}
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

const SectionTitle = memo(function SectionTitle({ children }: { children: string }) {
  return <Text style={styles.sectionTitle}>{children}</Text>;
});

const InfoRow = memo(function InfoRow({ icon, label, value, last }: {
  icon: string; label: string; value?: string | null; last?: boolean;
}) {
  return (
    <View style={[styles.row, last ? styles.rowLast : null]}>
      <Ionicons name={icon as IoniconsName} size={20} color={GRAY} />
      <View style={styles.rowContent}>
        <Text style={styles.rowLabel}>{label}</Text>
        <Text style={styles.rowValue}>{value || 'Não informado'}</Text>
      </View>
    </View>
  );
});

// =============================================================================
// ESTILOS
// =============================================================================

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG },
  content: { padding: 16, paddingBottom: 48 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: BG },

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

  sectionTitle: { fontSize: 13, fontWeight: '600', color: GRAY, marginTop: 12, marginBottom: 6, paddingHorizontal: 2 },
  card: { backgroundColor: WHITE, borderRadius: 12, marginBottom: 4, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', padding: 14, borderBottomWidth: 1, borderBottomColor: '#f3f4f6' },
  rowLast: { borderBottomWidth: 0 },
  rowContent: { flex: 1, marginLeft: 12 },
  rowLabel: { fontSize: 11, color: GRAY },
  rowValue: { fontSize: 15, color: '#171717', marginTop: 2 },

  logoutButton: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    marginTop: 24, padding: 16, borderRadius: 12,
    borderWidth: 2, borderColor: '#ef4444', gap: 8,
  },
  logoutText: { color: '#ef4444', fontSize: 16, fontWeight: '600' },
  version: { textAlign: 'center', fontSize: 12, color: GRAY, marginTop: 16 },

  editModal: { flex: 1, backgroundColor: BG },
  editHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: WHITE, paddingHorizontal: 16, paddingTop: 56, paddingBottom: 16,
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
  saveButton: { backgroundColor: PRIMARY, borderRadius: 12, paddingVertical: 16, alignItems: 'center', marginTop: 20 },
  saveButtonDisabled: { opacity: 0.6 },
  saveButtonText: { color: WHITE, fontSize: 16, fontWeight: '700' },
  saveErrorBox: {
    backgroundColor: '#FEE2E2', borderRadius: 8, padding: 12,
    marginTop: 12, borderWidth: 1, borderColor: '#FECACA',
  },
  saveErrorText: { color: '#B91C1C', fontSize: 13, textAlign: 'center' },

  // Chips de instrumento
  chipsContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  chip: {
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20,
    borderWidth: 1.5, borderColor: '#d1d5db', backgroundColor: WHITE,
  },
  chipSelected: { borderColor: PRIMARY, backgroundColor: `${PRIMARY}15` },
  chipText: { fontSize: 14, color: GRAY, fontWeight: '500' },
  chipTextSelected: { color: PRIMARY, fontWeight: '700' },

  // Grade de disponibilidade
  availGrid: {
    backgroundColor: WHITE, borderRadius: 10, borderWidth: 1, borderColor: '#e5e7eb',
    marginBottom: 12, overflow: 'hidden',
  },
  availHeaderRow: { flexDirection: 'row', backgroundColor: '#f9fafb', paddingVertical: 8, paddingHorizontal: 10 },
  availTurnHeader: { flex: 1, textAlign: 'center', fontSize: 12, fontWeight: '700', color: GRAY },
  availRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 6, paddingHorizontal: 10, borderTopWidth: 1, borderTopColor: '#f3f4f6' },
  availDayCell: { width: 62 },
  availDayLabel: { width: 62, fontSize: 12, color: '#374151', fontWeight: '500' },
  availCell: {
    flex: 1, height: 28, borderRadius: 6, alignItems: 'center', justifyContent: 'center',
    marginHorizontal: 3, borderWidth: 1, borderColor: '#e5e7eb', backgroundColor: '#f9fafb',
  },
  availCellChecked: { backgroundColor: PRIMARY, borderColor: PRIMARY },

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
