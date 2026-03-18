/**
 * Register Screen
 * ===============
 * Cadastro em 3 passos:
 *  1. Dados da conta (nome, email, senha)
 *  2. Dados pessoais (telefone, nascimento, UF, cidade)
 *  3. Dados vocacionais (estado de vida, estado civil, realidade vocacional)
 *
 * Após criação da conta Firebase, salva o perfil completo no backend.
 */

import { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  KeyboardAvoidingView, Platform, ScrollView,
  ActivityIndicator, StatusBar, Modal, FlatList,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { createUserWithEmailAndPassword, updateProfile } from 'firebase/auth';
import { auth } from '@/config/firebase';
import { profileService } from '@/services';
import type { CatalogItem } from '@/types';

const colors = {
  primary: '#1A859B',
  white: '#ffffff',
  orange: '#F5A623',
  gray: '#6b7280',
  inputBg: 'rgba(255, 255, 255, 0.9)',
  error: '#ef4444',
};

const BR_STATES = [
  'AC','AL','AP','AM','BA','CE','DF','ES','GO',
  'MA','MT','MS','MG','PA','PB','PR','PE','PI',
  'RJ','RN','RS','RO','RR','SC','SP','SE','TO',
];

export default function RegisterScreen() {
  const [step, setStep] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [firebaseError, setFirebaseError] = useState('');

  // Catálogos carregados do backend
  const [lifeStates, setLifeStates] = useState<CatalogItem[]>([]);
  const [maritalStatuses, setMaritalStatuses] = useState<CatalogItem[]>([]);
  const [vocationalRealities, setVocationalRealities] = useState<CatalogItem[]>([]);
  const [loadingCatalogs, setLoadingCatalogs] = useState(false);

  // Passo 1 — Conta
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // Passo 2 — Pessoal
  const [phone, setPhone] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [uf, setUf] = useState('');
  const [city, setCity] = useState('');
  const [cpf, setCpf] = useState('');
  const [rg, setRg] = useState('');

  // Passo 3 — Vocacional
  const [selectedLifeState, setSelectedLifeState] = useState<CatalogItem | null>(null);
  const [selectedMarital, setSelectedMarital] = useState<CatalogItem | null>(null);
  const [selectedVocational, setSelectedVocational] = useState<CatalogItem | null>(null);

  // Modais
  const [stateModalVisible, setStateModalVisible] = useState(false);
  const [catalogModalVisible, setCatalogModalVisible] = useState(false);
  const [catalogModalTitle, setCatalogModalTitle] = useState('');
  const [catalogModalOptions, setCatalogModalOptions] = useState<CatalogItem[]>([]);
  const [catalogModalOnSelect, setCatalogModalOnSelect] = useState<(item: CatalogItem) => void>(() => () => {});

  useEffect(() => {
    if (step === 3 && lifeStates.length === 0) loadCatalogs();
  }, [step]);

  const loadCatalogs = async () => {
    setLoadingCatalogs(true);
    try {
      const catalogs = await profileService.getCatalogs();
      const find = (code: string) => catalogs.find(c => c.code === code)?.items ?? [];
      setLifeStates(find('LIFE_STATE'));
      setMaritalStatuses(find('MARITAL_STATUS'));
      setVocationalRealities(find('VOCATIONAL_REALITY'));
    } catch {
      // silencioso — usuário pode preencher depois no perfil
    } finally {
      setLoadingCatalogs(false);
    }
  };

  const formatPhone = (v: string) => {
    const d = v.replace(/\D/g, '').slice(0, 11);
    if (d.length <= 2) return d;
    if (d.length <= 6) return `(${d.slice(0,2)}) ${d.slice(2)}`;
    if (d.length <= 10) return `(${d.slice(0,2)}) ${d.slice(2,6)}-${d.slice(6)}`;
    return `(${d.slice(0,2)}) ${d.slice(2,7)}-${d.slice(7)}`;
  };

  const formatDate = (v: string) => {
    const d = v.replace(/\D/g, '').slice(0, 8);
    if (d.length <= 2) return d;
    if (d.length <= 4) return `${d.slice(0,2)}/${d.slice(2)}`;
    return `${d.slice(0,2)}/${d.slice(2,4)}/${d.slice(4)}`;
  };

  const formatCpf = (v: string) => {
    const d = v.replace(/\D/g, '').slice(0, 11);
    if (d.length <= 3) return d;
    if (d.length <= 6) return `${d.slice(0,3)}.${d.slice(3)}`;
    if (d.length <= 9) return `${d.slice(0,3)}.${d.slice(3,6)}.${d.slice(6)}`;
    return `${d.slice(0,3)}.${d.slice(3,6)}.${d.slice(6,9)}-${d.slice(9)}`;
  };

  const openCatalogModal = (title: string, options: CatalogItem[], onSelect: (item: CatalogItem) => void) => {
    setCatalogModalTitle(title);
    setCatalogModalOptions(options);
    setCatalogModalOnSelect(() => onSelect);
    setCatalogModalVisible(true);
  };

  const validateStep1 = () => {
    const e: Record<string, string> = {};
    if (fullName.trim().length < 3) e.fullName = 'Nome deve ter pelo menos 3 caracteres';
    if (!email.includes('@') || !email.includes('.')) e.email = 'Email inválido';
    if (password.length < 6) e.password = 'Senha deve ter pelo menos 6 caracteres';
    if (password !== confirmPassword) e.confirmPassword = 'Senhas não conferem';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const validateStep2 = () => {
    const e: Record<string, string> = {};
    const phoneDigits = phone.replace(/\D/g, '');
    if (phoneDigits.length < 10) e.phone = 'Telefone inválido';
    const parts = birthDate.split('/');
    if (parts.length !== 3 || parts[2]?.length !== 4) e.birthDate = 'Data inválida (DD/MM/AAAA)';
    if (!uf) e.uf = 'Selecione o estado';
    if (city.trim().length < 2) e.city = 'Informe a cidade';
    const cpfDigits = cpf.replace(/\D/g, '');
    if (cpfDigits.length !== 11) e.cpf = 'CPF deve ter 11 dígitos';
    if (rg.trim().length < 4) e.rg = 'RG inválido';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleNext = () => {
    if (step === 1 && validateStep1()) setStep(2);
    else if (step === 2 && validateStep2()) setStep(3);
  };

  const handleRegister = async () => {
    setFirebaseError('');
    setIsLoading(true);
    try {
      // 1. Cria conta Firebase
      const credential = await createUserWithEmailAndPassword(
        auth, email.trim().toLowerCase(), password,
      );
      await updateProfile(credential.user, { displayName: fullName.trim() });

      // 2. Monta data ISO e telefone E.164
      const [dd, mm, yyyy] = birthDate.split('/');
      const birthIso = `${yyyy}-${mm}-${dd}`;
      const phoneE164 = `+55${phone.replace(/\D/g, '')}`;

      // 3. Salva perfil (Firebase já autenticou → token disponível)
      try {
        await profileService.updateProfile({
          full_name: fullName.trim(),
          birth_date: birthIso,
          phone_e164: phoneE164,
          city: city.trim(),
          state: uf,
          cpf: cpf.replace(/\D/g, ''),
          rg: rg.trim(),
          life_state_item_id: selectedLifeState?.id,
          marital_status_item_id: selectedMarital?.id,
          vocational_reality_item_id: selectedVocational?.id,
        });
      } catch {
        // Erro no perfil não impede o acesso ao app
      }

      router.replace('/(tabs)/home');
    } catch (err: unknown) {
      const code = (err as { code?: string }).code ?? '';
      if (code === 'auth/email-already-in-use') {
        setFirebaseError('Este email já está cadastrado. Tente fazer login.');
        setStep(1);
      } else if (code === 'auth/weak-password') {
        setFirebaseError('Senha fraca. Use pelo menos 6 caracteres.');
        setStep(1);
      } else if (code === 'auth/invalid-email') {
        setFirebaseError('Email inválido.');
        setStep(1);
      } else if (code === 'auth/network-request-failed') {
        setFirebaseError('Sem conexão. Verifique sua internet.');
      } else if (code) {
        setFirebaseError(`Erro ao criar conta: ${code}`);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const stepTitles = ['Criar Conta', 'Dados Pessoais', 'Dados Vocacionais'];
  const stepSubtitles = [
    'Preencha seus dados para começar',
    'Como podemos te encontrar?',
    'Sua realidade na comunidade',
  ];

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={colors.primary} />
      <KeyboardAvoidingView style={styles.keyboardView} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>

          {/* Header com indicador de passos */}
          <View style={styles.header}>
            <TouchableOpacity style={styles.backButton} onPress={() => step > 1 ? setStep(step - 1) : router.back()}>
              <Ionicons name="arrow-back" size={24} color={colors.white} />
            </TouchableOpacity>
            <View style={styles.stepIndicator}>
              {[1,2,3].map((s, i) => (
                <View key={s} style={styles.stepRow}>
                  <View style={[styles.stepDot, step >= s && styles.stepDotActive]} />
                  {i < 2 && <View style={[styles.stepLine, step > s && styles.stepLineActive]} />}
                </View>
              ))}
            </View>
          </View>

          {/* Logo e título */}
          <View style={styles.logoSection}>
            <Ionicons name="compass-outline" size={56} color={colors.white} />
            <Text style={styles.title}>{stepTitles[step - 1]}</Text>
            <Text style={styles.subtitle}>{stepSubtitles[step - 1]}</Text>
          </View>

          {/* ── PASSO 1: Conta ── */}
          {step === 1 && (
            <View style={styles.form}>
              <TextInput style={[styles.input, errors.fullName && styles.inputError]}
                placeholder="Nome completo" value={fullName} placeholderTextColor={colors.gray}
                onChangeText={t => { setFullName(t); setErrors({...errors, fullName: ''}); }}
                autoCapitalize="words" />
              {errors.fullName ? <Text style={styles.errorText}>{errors.fullName}</Text> : null}

              <TextInput style={[styles.input, errors.email && styles.inputError]}
                placeholder="E-mail" value={email} placeholderTextColor={colors.gray}
                onChangeText={t => { setEmail(t); setErrors({...errors, email: ''}); }}
                keyboardType="email-address" autoCapitalize="none" />
              {errors.email ? <Text style={styles.errorText}>{errors.email}</Text> : null}

              <TextInput style={[styles.input, errors.password && styles.inputError]}
                placeholder="Senha (mínimo 6 caracteres)" value={password} placeholderTextColor={colors.gray}
                onChangeText={t => { setPassword(t); setErrors({...errors, password: ''}); }}
                secureTextEntry />
              {errors.password ? <Text style={styles.errorText}>{errors.password}</Text> : null}

              <TextInput style={[styles.input, errors.confirmPassword && styles.inputError]}
                placeholder="Confirmar senha" value={confirmPassword} placeholderTextColor={colors.gray}
                onChangeText={t => { setConfirmPassword(t); setErrors({...errors, confirmPassword: ''}); }}
                secureTextEntry />
              {errors.confirmPassword ? <Text style={styles.errorText}>{errors.confirmPassword}</Text> : null}

              {firebaseError ? <View style={styles.errorBox}><Text style={styles.errorBoxText}>⚠️ {firebaseError}</Text></View> : null}

              <TouchableOpacity style={styles.primaryButton} onPress={handleNext}>
                <Text style={styles.primaryButtonText}>Continuar</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* ── PASSO 2: Pessoal ── */}
          {step === 2 && (
            <View style={styles.form}>
              <TextInput style={[styles.input, errors.phone && styles.inputError]}
                placeholder="Telefone (WhatsApp)" value={phone} placeholderTextColor={colors.gray}
                onChangeText={t => { setPhone(formatPhone(t)); setErrors({...errors, phone: ''}); }}
                keyboardType="phone-pad" />
              {errors.phone ? <Text style={styles.errorText}>{errors.phone}</Text> : null}

              <TextInput style={[styles.input, errors.birthDate && styles.inputError]}
                placeholder="Data de nascimento (DD/MM/AAAA)" value={birthDate} placeholderTextColor={colors.gray}
                onChangeText={t => { setBirthDate(formatDate(t)); setErrors({...errors, birthDate: ''}); }}
                keyboardType="numeric" />
              {errors.birthDate ? <Text style={styles.errorText}>{errors.birthDate}</Text> : null}

              <TouchableOpacity style={[styles.input, styles.selector, errors.uf && styles.inputError]}
                onPress={() => setStateModalVisible(true)}>
                <Text style={[styles.selectorText, !uf && styles.selectorPlaceholder]}>{uf || 'Estado (UF)'}</Text>
                <Ionicons name="chevron-down" size={18} color={colors.gray} />
              </TouchableOpacity>
              {errors.uf ? <Text style={styles.errorText}>{errors.uf}</Text> : null}

              <TextInput style={[styles.input, errors.city && styles.inputError]}
                placeholder="Cidade" value={city} placeholderTextColor={colors.gray}
                onChangeText={t => { setCity(t); setErrors({...errors, city: ''}); }}
                autoCapitalize="words" />
              {errors.city ? <Text style={styles.errorText}>{errors.city}</Text> : null}

              <TextInput style={[styles.input, errors.cpf && styles.inputError]}
                placeholder="CPF (000.000.000-00)" value={cpf} placeholderTextColor={colors.gray}
                onChangeText={t => { setCpf(formatCpf(t)); setErrors({...errors, cpf: ''}); }}
                keyboardType="numeric" />
              {errors.cpf ? <Text style={styles.errorText}>{errors.cpf}</Text> : null}

              <TextInput style={[styles.input, errors.rg && styles.inputError]}
                placeholder="RG" value={rg} placeholderTextColor={colors.gray}
                onChangeText={t => { setRg(t); setErrors({...errors, rg: ''}); }}
                autoCapitalize="characters" />
              {errors.rg ? <Text style={styles.errorText}>{errors.rg}</Text> : null}

              <TouchableOpacity style={styles.primaryButton} onPress={handleNext}>
                <Text style={styles.primaryButtonText}>Continuar</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* ── PASSO 3: Vocacional ── */}
          {step === 3 && (
            <View style={styles.form}>
              {loadingCatalogs ? (
                <ActivityIndicator color={colors.white} style={{ marginVertical: 24 }} />
              ) : (
                <>
                  <TouchableOpacity style={[styles.input, styles.selector]}
                    onPress={() => openCatalogModal('Estado de Vida', lifeStates, item => { setSelectedLifeState(item); setCatalogModalVisible(false); })}>
                    <Text style={[styles.selectorText, !selectedLifeState && styles.selectorPlaceholder]}>
                      {selectedLifeState?.label || 'Estado de Vida'}
                    </Text>
                    <Ionicons name="chevron-down" size={18} color={colors.gray} />
                  </TouchableOpacity>

                  <TouchableOpacity style={[styles.input, styles.selector]}
                    onPress={() => openCatalogModal('Estado Civil', maritalStatuses, item => { setSelectedMarital(item); setCatalogModalVisible(false); })}>
                    <Text style={[styles.selectorText, !selectedMarital && styles.selectorPlaceholder]}>
                      {selectedMarital?.label || 'Estado Civil'}
                    </Text>
                    <Ionicons name="chevron-down" size={18} color={colors.gray} />
                  </TouchableOpacity>

                  <TouchableOpacity style={[styles.input, styles.selector]}
                    onPress={() => openCatalogModal('Realidade Vocacional', vocationalRealities, item => { setSelectedVocational(item); setCatalogModalVisible(false); })}>
                    <Text style={[styles.selectorText, !selectedVocational && styles.selectorPlaceholder]}>
                      {selectedVocational?.label || 'Realidade Vocacional'}
                    </Text>
                    <Ionicons name="chevron-down" size={18} color={colors.gray} />
                  </TouchableOpacity>
                </>
              )}

              <Text style={styles.skipNote}>* Campos opcionais. Você pode preencher depois no perfil.</Text>

              {firebaseError ? <View style={styles.errorBox}><Text style={styles.errorBoxText}>⚠️ {firebaseError}</Text></View> : null}

              <TouchableOpacity style={[styles.primaryButton, isLoading && styles.buttonDisabled]}
                onPress={handleRegister} disabled={isLoading}>
                {isLoading
                  ? <ActivityIndicator color={colors.white} />
                  : <Text style={styles.primaryButtonText}>Criar Conta</Text>
                }
              </TouchableOpacity>
            </View>
          )}

          {/* Footer */}
          <View style={styles.footer}>
            <Text style={styles.footerText}>Já tem uma conta? </Text>
            <TouchableOpacity onPress={() => router.push('/(auth)/login')}>
              <Text style={styles.footerLink}>Entrar</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Modal — Seletor de UF */}
      <Modal visible={stateModalVisible} animationType="slide" transparent onRequestClose={() => setStateModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Estado (UF)</Text>
              <TouchableOpacity onPress={() => setStateModalVisible(false)}>
                <Ionicons name="close" size={24} color={colors.gray} />
              </TouchableOpacity>
            </View>
            <FlatList data={BR_STATES} keyExtractor={item => item}
              renderItem={({ item }) => (
                <TouchableOpacity style={[styles.modalItem, uf === item && styles.modalItemSelected]}
                  onPress={() => { setUf(item); setErrors({...errors, uf: ''}); setStateModalVisible(false); }}>
                  <Text style={[styles.modalItemText, uf === item && styles.modalItemTextSelected]}>{item}</Text>
                  {uf === item && <Ionicons name="checkmark" size={20} color={colors.primary} />}
                </TouchableOpacity>
              )}
            />
          </View>
        </View>
      </Modal>

      {/* Modal — Seletor de Catálogo */}
      <Modal visible={catalogModalVisible} animationType="slide" transparent onRequestClose={() => setCatalogModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{catalogModalTitle}</Text>
              <TouchableOpacity onPress={() => setCatalogModalVisible(false)}>
                <Ionicons name="close" size={24} color={colors.gray} />
              </TouchableOpacity>
            </View>
            <FlatList data={catalogModalOptions} keyExtractor={item => item.id}
              renderItem={({ item }) => {
                const isSelected =
                  (catalogModalTitle === 'Estado de Vida' && selectedLifeState?.id === item.id) ||
                  (catalogModalTitle === 'Estado Civil' && selectedMarital?.id === item.id) ||
                  (catalogModalTitle === 'Realidade Vocacional' && selectedVocational?.id === item.id);
                return (
                  <TouchableOpacity style={[styles.modalItem, isSelected && styles.modalItemSelected]}
                    onPress={() => catalogModalOnSelect(item)}>
                    <Text style={[styles.modalItemText, isSelected && styles.modalItemTextSelected]}>{item.label}</Text>
                    {isSelected && <Ionicons name="checkmark" size={20} color={colors.primary} />}
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

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.primary },
  keyboardView: { flex: 1 },
  scrollContent: { flexGrow: 1, paddingHorizontal: 28, paddingTop: 50, paddingBottom: 40 },
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: 20 },
  backButton: { padding: 8, marginLeft: -8 },
  stepIndicator: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingRight: 32 },
  stepRow: { flexDirection: 'row', alignItems: 'center' },
  stepDot: { width: 12, height: 12, borderRadius: 6, backgroundColor: 'rgba(255,255,255,0.3)' },
  stepDotActive: { backgroundColor: colors.white },
  stepLine: { width: 32, height: 2, backgroundColor: 'rgba(255,255,255,0.3)', marginHorizontal: 6 },
  stepLineActive: { backgroundColor: colors.white },
  logoSection: { alignItems: 'center', marginBottom: 28, gap: 8 },
  title: { fontSize: 26, fontWeight: 'bold', color: colors.white },
  subtitle: { fontSize: 15, color: colors.white, opacity: 0.85, textAlign: 'center' },
  form: { flex: 1 },
  input: {
    backgroundColor: colors.inputBg, borderRadius: 25,
    paddingHorizontal: 20, paddingVertical: 14,
    fontSize: 16, marginBottom: 12, color: '#333',
  },
  inputError: { borderWidth: 2, borderColor: colors.error, marginBottom: 4 },
  selector: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  selectorText: { fontSize: 16, color: '#333', flex: 1 },
  selectorPlaceholder: { color: colors.gray },
  errorText: { color: '#fecaca', fontSize: 13, marginBottom: 10, marginLeft: 16 },
  skipNote: { color: 'rgba(255,255,255,0.7)', fontSize: 12, textAlign: 'center', marginBottom: 12, marginTop: 4 },
  errorBox: { backgroundColor: '#FEE2E2', borderRadius: 8, padding: 12, marginBottom: 12, borderWidth: 1, borderColor: '#FECACA' },
  errorBoxText: { color: '#B91C1C', fontSize: 13, textAlign: 'center' },
  primaryButton: {
    backgroundColor: colors.orange, borderRadius: 25, paddingVertical: 16,
    alignItems: 'center', marginTop: 16,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.2, shadowRadius: 4, elevation: 3,
  },
  buttonDisabled: { opacity: 0.6 },
  primaryButtonText: { color: colors.white, fontSize: 18, fontWeight: '600' },
  footer: { flexDirection: 'row', justifyContent: 'center', paddingTop: 20 },
  footerText: { fontSize: 14, color: colors.white },
  footerLink: { fontSize: 14, color: colors.white, fontWeight: 'bold', textDecorationLine: 'underline' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: colors.white, borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '65%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: '#e5e5e5' },
  modalTitle: { fontSize: 18, fontWeight: '600', color: '#171717' },
  modalItem: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 14, paddingHorizontal: 20, borderBottomWidth: 1, borderBottomColor: '#f3f4f6' },
  modalItemSelected: { backgroundColor: 'rgba(26,133,155,0.08)' },
  modalItemText: { fontSize: 16, color: '#171717' },
  modalItemTextSelected: { color: colors.primary, fontWeight: '600' },
});
