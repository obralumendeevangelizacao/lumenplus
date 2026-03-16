/**
 * Profile Screen (Onboarding)
 * ===========================
 * Formulário completo de preenchimento do perfil.
 * 
 * Inclui:
 * - Foto de perfil
 * - Dados pessoais
 * - Localização
 * - Estado de Vida, Civil e Realidade Vocacional
 * - Ano de consagração (se Consagrado Filho da Luz)
 * - Acompanhamento Vocacional (sim/não + quem)
 * - Interesse em Ministério (sim/não + qual)
 */

import { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  TouchableOpacity,
  Image,
  TextInput,
  Switch,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { router, useLocalSearchParams } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
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
  border: '#e5e5e5',
  background: '#f9fafb',
};

interface CatalogItem {
  id: string;
  code: string;
  label: string;
  sort_order?: number;
}

interface CatalogResponse {
  code: string;
  name: string;
  items: CatalogItem[];
}

interface Ministry {
  id: string;
  name: string;
}

interface ExistingProfile {
  full_name?: string;
  birth_date?: string;
  cpf?: string;
  rg?: string;
  phone_e164?: string;
  city?: string;
  state?: string;
  life_state_item_id?: string;
  marital_status_item_id?: string;
  vocational_reality_item_id?: string;
  consecration_year?: number;
  has_vocational_accompaniment?: boolean;
  vocational_accompanist_name?: string;
  interested_in_ministry?: boolean;
  interested_ministry_id?: string;
  ministry_interest_notes?: string;
}

export default function ProfileScreen() {
  const params = useLocalSearchParams<{ fullName?: string; phone?: string }>();
  // Telefone verificado = veio do fluxo verify-phone via params
  const phoneVerified = !!params.phone;
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Catálogos
  const [lifeStates, setLifeStates] = useState<CatalogItem[]>([]);
  const [maritalStatuses, setMaritalStatuses] = useState<CatalogItem[]>([]);
  const [vocationalRealities, setVocationalRealities] = useState<CatalogItem[]>([]);
  const [ministries, setMinistries] = useState<Ministry[]>([]);

  // Form state
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [fullName, setFullName] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [cpf, setCpf] = useState('');
  const [rg, setRg] = useState('');
  const [phone, setPhone] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  
  // Catálogos selecionados
  const [lifeState, setLifeState] = useState('');
  const [maritalStatus, setMaritalStatus] = useState('');
  const [vocationalReality, setVocationalReality] = useState('');
  
  // Campos condicionais
  const [consecrationYear, setConsecrationYear] = useState('');
  const [hasAccompaniment, setHasAccompaniment] = useState(false);
  const [accompanistName, setAccompanistName] = useState('');
  const [interestedInMinistry, setInterestedInMinistry] = useState(false);
  const [selectedMinistry, setSelectedMinistry] = useState('');
  const [ministryNotes, setMinistryNotes] = useState('');

  // Verifica se é Consagrado Filho da Luz (vocationalReality guarda o UUID do item)
  const isConsagrado =
    vocationalRealities.find((i) => i.id === vocationalReality)?.code ===
    'CONSAGRADO_FILHO_DA_LUZ';

  const states = [
    'AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG',
    'PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO',
  ];

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      // Carrega catálogos e perfil existente em paralelo
      const [catalogs, existingProfile] = await Promise.all([
        api.get<CatalogResponse[]>('/profile/catalogs'),
        api.get<ExistingProfile>('/profile').catch(() => null),
      ]);

      const find = (code: string): CatalogItem[] =>
        catalogs.find((c) => c.code === code)?.items ?? [];

      setLifeStates(find('LIFE_STATE'));
      setMaritalStatuses(find('MARITAL_STATUS'));
      setVocationalRealities(find('VOCATIONAL_REALITY'));

      // Pré-popula campos com dados já existentes no backend
      if (existingProfile) {
        if (existingProfile.full_name) setFullName(existingProfile.full_name);
        if (existingProfile.birth_date) {
          // Converte YYYY-MM-DD para DD/MM/YYYY
          const parts = existingProfile.birth_date.split('-');
          if (parts.length === 3) setBirthDate(`${parts[2]}/${parts[1]}/${parts[0]}`);
        }
        if (existingProfile.cpf) setCpf(formatCPF(existingProfile.cpf));
        if (existingProfile.rg) setRg(existingProfile.rg);
        if (existingProfile.phone_e164) {
          // Converte E164 (+5511999999999) para formato BR
          const digits = existingProfile.phone_e164.replace(/\D/g, '').slice(2); // remove +55
          setPhone(formatPhone(digits));
        }
        if (existingProfile.city) setCity(existingProfile.city);
        if (existingProfile.state) setState(existingProfile.state);
        if (existingProfile.life_state_item_id) setLifeState(existingProfile.life_state_item_id);
        if (existingProfile.marital_status_item_id) setMaritalStatus(existingProfile.marital_status_item_id);
        if (existingProfile.vocational_reality_item_id) setVocationalReality(existingProfile.vocational_reality_item_id);
        if (existingProfile.consecration_year) setConsecrationYear(String(existingProfile.consecration_year));
        if (existingProfile.has_vocational_accompaniment != null) setHasAccompaniment(existingProfile.has_vocational_accompaniment);
        if (existingProfile.vocational_accompanist_name) setAccompanistName(existingProfile.vocational_accompanist_name);
        if (existingProfile.interested_in_ministry != null) setInterestedInMinistry(existingProfile.interested_in_ministry);
        if (existingProfile.interested_ministry_id) setSelectedMinistry(existingProfile.interested_ministry_id);
        if (existingProfile.ministry_interest_notes) setMinistryNotes(existingProfile.ministry_interest_notes);
      }

      // Parâmetros de rota têm prioridade sobre dados do backend
      // (são os dados que o usuário acabou de digitar no cadastro)
      if (params.fullName) setFullName(params.fullName);
      if (params.phone) {
        // phone vem em formato E164 (+5511999999999)
        const digits = params.phone.replace(/\D/g, '').slice(2); // remove 55
        if (digits) setPhone(formatPhone(digits));
      }

      // Carrega ministérios disponíveis
      try {
        const orgResponse = await api.get<{ ministries: Ministry[] }>('/org/ministries');
        setMinistries(orgResponse.ministries || []);
      } catch {
        // Ministérios podem não existir ainda
        setMinistries([]);
      }
    } catch (err) {
      Alert.alert('Erro', 'Não foi possível carregar os dados');
    } finally {
      setIsLoading(false);
    }
  };

  const pickImage = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Permissão necessária', 'Precisamos de acesso às suas fotos');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      setPhotoUri(result.assets[0].uri);
    }
  };

  const takePhoto = async () => {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Permissão necessária', 'Precisamos de acesso à câmera');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      setPhotoUri(result.assets[0].uri);
    }
  };

  const showPhotoOptions = () => {
    Alert.alert('Foto de Perfil', 'Escolha uma opção', [
      { text: 'Câmera', onPress: takePhoto },
      { text: 'Galeria', onPress: pickImage },
      { text: 'Cancelar', style: 'cancel' },
    ]);
  };

  const formatCPF = (value: string) => {
    const digits = value.replace(/\D/g, '').slice(0, 11);
    if (digits.length <= 3) return digits;
    if (digits.length <= 6) return `${digits.slice(0, 3)}.${digits.slice(3)}`;
    if (digits.length <= 9)
      return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`;
    return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
  };

  const formatPhone = (value: string) => {
    const digits = value.replace(/\D/g, '').slice(0, 11);
    if (digits.length <= 2) return digits;
    if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
    if (digits.length <= 10) return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
  };

  const formatDate = (value: string) => {
    const digits = value.replace(/\D/g, '').slice(0, 8);
    if (digits.length <= 2) return digits;
    if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
    return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
  };

  const parseDate = (formatted: string): string => {
    // Converte DD/MM/YYYY para YYYY-MM-DD
    const parts = formatted.split('/');
    if (parts.length === 3) {
      return `${parts[2]}-${parts[1]}-${parts[0]}`;
    }
    return '';
  };

  const validate = () => {
    const newErrors: Record<string, string> = {};

    if (!fullName.trim() || fullName.length < 3) {
      newErrors.fullName = 'Nome deve ter pelo menos 3 caracteres';
    }
    if (!birthDate || birthDate.length < 10) {
      newErrors.birthDate = 'Data de nascimento obrigatória';
    }
    if (cpf.replace(/\D/g, '').length !== 11) {
      newErrors.cpf = 'CPF inválido';
    }
    if (!rg.trim()) {
      newErrors.rg = 'RG obrigatório';
    }
    if (phone.replace(/\D/g, '').length < 10) {
      newErrors.phone = 'Telefone inválido';
    }
    if (!city.trim()) {
      newErrors.city = 'Cidade obrigatória';
    }
    if (!state) {
      newErrors.state = 'Estado obrigatório';
    }
    if (!lifeState) {
      newErrors.lifeState = 'Selecione o estado de vida';
    }
    if (!maritalStatus) {
      newErrors.maritalStatus = 'Selecione o estado civil';
    }
    if (!vocationalReality) {
      newErrors.vocationalReality = 'Selecione a realidade vocacional';
    }

    // Validações condicionais
    if (isConsagrado && !consecrationYear) {
      newErrors.consecrationYear = 'Ano de consagração obrigatório';
    }
    if (hasAccompaniment && !accompanistName.trim()) {
      newErrors.accompanistName = 'Informe quem é seu acompanhador';
    }
    if (interestedInMinistry && !selectedMinistry && !ministryNotes.trim()) {
      newErrors.ministry = 'Selecione um ministério ou descreva seu interesse';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) {
      Alert.alert('Atenção', 'Preencha todos os campos obrigatórios');
      return;
    }

    try {
      setIsSaving(true);

      const phoneDigits = phone.replace(/\D/g, '');
      const phoneE164 = `+55${phoneDigits}`;

      const data = {
        full_name: fullName.trim(),
        birth_date: parseDate(birthDate),
        cpf: cpf.replace(/\D/g, ''),
        rg: rg.trim(),
        phone_e164: phoneE164,
        city: city.trim(),
        state,
        // Backend espera UUIDs dos itens de catálogo
        life_state_item_id: lifeState,
        marital_status_item_id: maritalStatus,
        vocational_reality_item_id: vocationalReality,
        consecration_year: isConsagrado ? parseInt(consecrationYear) : null,
        has_vocational_accompaniment: hasAccompaniment,
        vocational_accompanist_name: hasAccompaniment ? accompanistName.trim() : null,
        interested_in_ministry: interestedInMinistry,
        interested_ministry_id: interestedInMinistry && selectedMinistry ? selectedMinistry : null,
        ministry_interest_notes: interestedInMinistry ? ministryNotes.trim() : null,
      };

      // Salva perfil
      await api.put('/profile', data);

      // Upload de foto se existir
      if (photoUri) {
        const formData = new FormData();
        formData.append('file', {
          uri: photoUri,
          type: 'image/jpeg',
          name: 'profile.jpg',
        } as any);

        try {
          await api.post('/profile/photo', formData, {
            headers: { 'Content-Type': 'multipart/form-data' },
          });
        } catch {
          // Foto é opcional, não bloqueia o cadastro
          console.warn('Erro ao enviar foto');
        }
      }

      Alert.alert('Sucesso!', 'Perfil salvo com sucesso!', [
        { text: 'Continuar', onPress: () => router.replace('/(tabs)/home') },
      ]);
    } catch (err: any) {
      const message = err.response?.data?.detail?.message || 'Erro ao salvar perfil';
      Alert.alert('Erro', message);
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Carregando...</Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.title}>Complete seu perfil</Text>
        <Text style={styles.subtitle}>
          Precisamos de algumas informações para finalizar seu cadastro.
        </Text>

        {/* ============================================ */}
        {/* FOTO DE PERFIL */}
        {/* ============================================ */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>📷 Foto de Perfil</Text>
          
          <TouchableOpacity style={styles.photoContainer} onPress={showPhotoOptions}>
            {photoUri ? (
              <Image source={{ uri: photoUri }} style={styles.photo} />
            ) : (
              <View style={styles.photoPlaceholder}>
                <Text style={styles.photoPlaceholderText}>+</Text>
              </View>
            )}
          </TouchableOpacity>
          <Text style={styles.photoHint}>Toque para adicionar uma foto</Text>
        </View>

        {/* ============================================ */}
        {/* DADOS PESSOAIS */}
        {/* ============================================ */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>👤 Dados Pessoais</Text>

          <Text style={styles.label}>Nome completo *</Text>
          <TextInput
            style={[styles.input, errors.fullName && styles.inputError]}
            placeholder="Seu nome completo"
            value={fullName}
            onChangeText={setFullName}
            autoCapitalize="words"
            placeholderTextColor={colors.gray}
          />
          {errors.fullName && <Text style={styles.errorText}>{errors.fullName}</Text>}

          <Text style={styles.label}>Data de nascimento *</Text>
          <TextInput
            style={[styles.input, errors.birthDate && styles.inputError]}
            placeholder="DD/MM/AAAA"
            value={birthDate}
            onChangeText={(v) => setBirthDate(formatDate(v))}
            keyboardType="numeric"
            maxLength={10}
            placeholderTextColor={colors.gray}
          />
          {errors.birthDate && <Text style={styles.errorText}>{errors.birthDate}</Text>}

          <Text style={styles.label}>CPF *</Text>
          <TextInput
            style={[styles.input, errors.cpf && styles.inputError]}
            placeholder="000.000.000-00"
            value={cpf}
            onChangeText={(v) => setCpf(formatCPF(v))}
            keyboardType="numeric"
            maxLength={14}
            placeholderTextColor={colors.gray}
          />
          {errors.cpf && <Text style={styles.errorText}>{errors.cpf}</Text>}

          <Text style={styles.label}>RG *</Text>
          <TextInput
            style={[styles.input, errors.rg && styles.inputError]}
            placeholder="Seu RG"
            value={rg}
            onChangeText={setRg}
            placeholderTextColor={colors.gray}
          />
          {errors.rg && <Text style={styles.errorText}>{errors.rg}</Text>}

          <Text style={styles.label}>Telefone (WhatsApp) *</Text>
          {phoneVerified ? (
            <View style={styles.lockedField}>
              <TextInput
                style={[styles.input, styles.inputLocked]}
                value={phone}
                editable={false}
                placeholderTextColor={colors.gray}
              />
              <View style={styles.lockedBadge}>
                <Ionicons name="lock-closed" size={14} color={colors.success} />
                <Text style={styles.lockedText}>Verificado</Text>
              </View>
            </View>
          ) : (
            <TextInput
              style={[styles.input, errors.phone && styles.inputError]}
              placeholder="(00) 00000-0000"
              value={phone}
              onChangeText={(v) => setPhone(formatPhone(v))}
              keyboardType="phone-pad"
              maxLength={15}
              placeholderTextColor={colors.gray}
            />
          )}
          {!phoneVerified && errors.phone && <Text style={styles.errorText}>{errors.phone}</Text>}
          {phoneVerified && (
            <Text style={styles.lockedHint}>
              Para alterar o telefone é necessário uma nova verificação.
            </Text>
          )}
        </View>

        {/* ============================================ */}
        {/* LOCALIZAÇÃO */}
        {/* ============================================ */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>📍 Localização</Text>

          <Text style={styles.label}>Cidade *</Text>
          <TextInput
            style={[styles.input, errors.city && styles.inputError]}
            placeholder="Sua cidade"
            value={city}
            onChangeText={setCity}
            placeholderTextColor={colors.gray}
          />
          {errors.city && <Text style={styles.errorText}>{errors.city}</Text>}

          <Text style={styles.label}>Estado *</Text>
          <View style={[styles.picker, errors.state && styles.pickerError]}>
            <Picker selectedValue={state} onValueChange={setState}>
              <Picker.Item label="Selecione..." value="" />
              {states.map((uf) => (
                <Picker.Item key={uf} label={uf} value={uf} />
              ))}
            </Picker>
          </View>
          {errors.state && <Text style={styles.errorText}>{errors.state}</Text>}
        </View>

        {/* ============================================ */}
        {/* INFORMAÇÕES DA COMUNIDADE */}
        {/* ============================================ */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>⛪ Informações da Comunidade</Text>

          <Text style={styles.label}>Estado de Vida *</Text>
          <View style={[styles.picker, errors.lifeState && styles.pickerError]}>
            <Picker selectedValue={lifeState} onValueChange={setLifeState}>
              <Picker.Item label="Selecione..." value="" />
              {lifeStates.map((item) => (
                <Picker.Item key={item.id} label={item.label} value={item.id} />
              ))}
            </Picker>
          </View>
          {errors.lifeState && <Text style={styles.errorText}>{errors.lifeState}</Text>}

          <Text style={styles.label}>Estado Civil *</Text>
          <View style={[styles.picker, errors.maritalStatus && styles.pickerError]}>
            <Picker selectedValue={maritalStatus} onValueChange={setMaritalStatus}>
              <Picker.Item label="Selecione..." value="" />
              {maritalStatuses.map((item) => (
                <Picker.Item key={item.id} label={item.label} value={item.id} />
              ))}
            </Picker>
          </View>
          {errors.maritalStatus && <Text style={styles.errorText}>{errors.maritalStatus}</Text>}

          <Text style={styles.label}>Realidade Vocacional *</Text>
          <View style={[styles.picker, errors.vocationalReality && styles.pickerError]}>
            <Picker selectedValue={vocationalReality} onValueChange={setVocationalReality}>
              <Picker.Item label="Selecione..." value="" />
              {vocationalRealities.map((item) => (
                <Picker.Item key={item.id} label={item.label} value={item.id} />
              ))}
            </Picker>
          </View>
          {errors.vocationalReality && <Text style={styles.errorText}>{errors.vocationalReality}</Text>}

          {/* ANO DE CONSAGRAÇÃO (condicional) */}
          {isConsagrado && (
            <>
              <Text style={styles.label}>Ano de Consagração *</Text>
              <TextInput
                style={[styles.input, errors.consecrationYear && styles.inputError]}
                placeholder="Ex: 2020"
                value={consecrationYear}
                onChangeText={setConsecrationYear}
                keyboardType="numeric"
                maxLength={4}
                placeholderTextColor={colors.gray}
              />
              {errors.consecrationYear && <Text style={styles.errorText}>{errors.consecrationYear}</Text>}
            </>
          )}
        </View>

        {/* ============================================ */}
        {/* ACOMPANHAMENTO VOCACIONAL */}
        {/* ============================================ */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>🙏 Acompanhamento Vocacional</Text>

          <View style={styles.switchRow}>
            <Text style={styles.switchLabel}>Você faz acompanhamento vocacional?</Text>
            <Switch
              value={hasAccompaniment}
              onValueChange={setHasAccompaniment}
              trackColor={{ false: colors.border, true: colors.primaryLight }}
              thumbColor={hasAccompaniment ? colors.primary : colors.lightGray}
            />
          </View>

          {hasAccompaniment && (
            <>
              <Text style={styles.label}>Quem é seu acompanhador? *</Text>
              <TextInput
                style={[styles.input, errors.accompanistName && styles.inputError]}
                placeholder="Nome do acompanhador"
                value={accompanistName}
                onChangeText={setAccompanistName}
                placeholderTextColor={colors.gray}
              />
              {errors.accompanistName && <Text style={styles.errorText}>{errors.accompanistName}</Text>}
            </>
          )}
        </View>

        {/* ============================================ */}
        {/* INTERESSE EM MINISTÉRIO */}
        {/* ============================================ */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>💼 Interesse em Ministério</Text>

          <View style={styles.switchRow}>
            <Text style={styles.switchLabel}>Você se sente chamado a servir em um ministério?</Text>
            <Switch
              value={interestedInMinistry}
              onValueChange={setInterestedInMinistry}
              trackColor={{ false: colors.border, true: colors.primaryLight }}
              thumbColor={interestedInMinistry ? colors.primary : colors.lightGray}
            />
          </View>

          {interestedInMinistry && (
            <>
              {ministries.length > 0 && (
                <>
                  <Text style={styles.label}>Qual ministério?</Text>
                  <View style={styles.picker}>
                    <Picker selectedValue={selectedMinistry} onValueChange={setSelectedMinistry}>
                      <Picker.Item label="Selecione..." value="" />
                      {ministries.map((m) => (
                        <Picker.Item key={m.id} label={m.name} value={m.id} />
                      ))}
                    </Picker>
                  </View>
                </>
              )}

              <Text style={styles.label}>Descreva seu interesse (opcional)</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                placeholder="Conte-nos mais sobre seu interesse..."
                value={ministryNotes}
                onChangeText={setMinistryNotes}
                multiline
                numberOfLines={3}
                placeholderTextColor={colors.gray}
              />
              {errors.ministry && <Text style={styles.errorText}>{errors.ministry}</Text>}
            </>
          )}
        </View>

        {/* ============================================ */}
        {/* BOTÃO SALVAR */}
        {/* ============================================ */}
        <TouchableOpacity
          style={[styles.submitButton, isSaving && styles.submitButtonDisabled]}
          onPress={handleSubmit}
          disabled={isSaving}
        >
          {isSaving ? (
            <ActivityIndicator color={colors.white} />
          ) : (
            <Text style={styles.submitButtonText}>Salvar e Continuar</Text>
          )}
        </TouchableOpacity>

        <View style={styles.spacer} />
      </ScrollView>
    </KeyboardAvoidingView>
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
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#171717',
    marginBottom: 8,
    marginTop: 20,
  },
  subtitle: {
    fontSize: 16,
    color: colors.gray,
    marginBottom: 24,
    lineHeight: 22,
  },
  section: {
    backgroundColor: colors.white,
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#171717',
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
    marginTop: 12,
  },
  input: {
    backgroundColor: colors.lightGray,
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    borderWidth: 1,
    borderColor: colors.border,
    color: '#171717',
  },
  inputError: {
    borderColor: colors.error,
  },
  textArea: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  errorText: {
    color: colors.error,
    fontSize: 13,
    marginTop: 4,
  },
  picker: {
    backgroundColor: colors.lightGray,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  pickerError: {
    borderColor: colors.error,
  },
  photoContainer: {
    alignSelf: 'center',
    marginBottom: 8,
  },
  photo: {
    width: 120,
    height: 120,
    borderRadius: 60,
  },
  photoPlaceholder: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: colors.lightGray,
    borderWidth: 2,
    borderColor: colors.border,
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
  },
  photoPlaceholderText: {
    fontSize: 40,
    color: colors.gray,
  },
  photoHint: {
    fontSize: 14,
    color: colors.gray,
    textAlign: 'center',
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  switchLabel: {
    fontSize: 15,
    color: '#374151',
    flex: 1,
    marginRight: 12,
  },
  submitButton: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    padding: 18,
    alignItems: 'center',
    marginTop: 8,
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitButtonText: {
    color: colors.white,
    fontSize: 18,
    fontWeight: '600',
  },
  spacer: {
    height: 40,
  },
  lockedField: {
    position: 'relative',
  },
  inputLocked: {
    backgroundColor: '#f0fdf4',
    borderColor: colors.success,
    borderWidth: 1,
    color: colors.gray,
  },
  lockedBadge: {
    position: 'absolute',
    right: 14,
    top: 0,
    bottom: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  lockedText: {
    fontSize: 12,
    color: colors.success,
    fontWeight: '600',
  },
  lockedHint: {
    fontSize: 12,
    color: colors.gray,
    marginTop: 4,
    marginLeft: 4,
    fontStyle: 'italic',
  },
});
