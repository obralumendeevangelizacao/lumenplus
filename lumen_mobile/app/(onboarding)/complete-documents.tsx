/**
 * Complete Documents Screen
 * =========================
 * Tela para usuários existentes que ainda não preencheram CPF e RG.
 * Exibida automaticamente ao entrar no app se has_documents === false.
 */

import { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { profileService } from '@/services';

const colors = {
  primary: '#1A859B',
  white: '#ffffff',
  orange: '#F5A623',
  gray: '#6b7280',
  lightGray: '#f3f4f6',
  inputBg: '#ffffff',
  error: '#ef4444',
};

export default function CompleteDocumentsScreen() {
  const [cpf, setCpf] = useState('');
  const [rg, setRg] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saveError, setSaveError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const formatCpf = (v: string) => {
    const d = v.replace(/\D/g, '').slice(0, 11);
    if (d.length <= 3) return d;
    if (d.length <= 6) return `${d.slice(0,3)}.${d.slice(3)}`;
    if (d.length <= 9) return `${d.slice(0,3)}.${d.slice(3,6)}.${d.slice(6)}`;
    return `${d.slice(0,3)}.${d.slice(3,6)}.${d.slice(6,9)}-${d.slice(9)}`;
  };

  const validate = () => {
    const e: Record<string, string> = {};
    if (cpf.replace(/\D/g, '').length !== 11) e.cpf = 'CPF deve ter 11 dígitos';
    if (!rg.trim()) e.rg = 'RG obrigatório';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSave = async () => {
    setSaveError('');
    if (!validate()) return;

    setIsLoading(true);
    try {
      // Busca perfil atual para não perder outros campos obrigatórios
      const current = await profileService.getProfile();

      // Se o perfil básico não foi preenchido (cadastro incompleto),
      // redireciona para o formulário completo em vez de falhar com 422
      if (!current.full_name || !current.birth_date || !current.phone_e164 || !current.city || !current.state) {
        router.replace('/(onboarding)/profile');
        return;
      }

      await profileService.updateProfile({
        full_name: current.full_name,
        birth_date: current.birth_date,
        phone_e164: current.phone_e164,
        city: current.city,
        state: current.state,
        cpf: cpf.replace(/\D/g, ''),
        rg: rg.trim(),
        life_state_item_id: current.life_state_item_id ?? undefined,
        marital_status_item_id: current.marital_status_item_id ?? undefined,
        vocational_reality_item_id: current.vocational_reality_item_id ?? undefined,
      });

      router.replace('/(tabs)/home');
    } catch (err: any) {
      const detail = err?.response?.data?.detail;
      let msg = 'Não foi possível salvar. Tente novamente.';
      if (typeof detail === 'string') msg = detail;
      else if (detail?.message) msg = detail.message;
      else if (Array.isArray(detail) && detail[0]?.msg) msg = `Dado inválido: ${detail[0].msg}`;
      setSaveError(msg);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>

        {/* Ícone */}
        <View style={styles.iconContainer}>
          <Ionicons name="id-card-outline" size={64} color={colors.primary} />
        </View>

        {/* Título */}
        <Text style={styles.title}>Complete seu cadastro</Text>
        <Text style={styles.subtitle}>
          Precisamos do seu CPF e RG para participação em retiros e eventos da comunidade.
        </Text>

        {/* Campos */}
        <View style={styles.form}>
          <Text style={styles.label}>CPF</Text>
          <TextInput
            style={[styles.input, errors.cpf && styles.inputError]}
            placeholder="000.000.000-00"
            value={cpf}
            placeholderTextColor={colors.gray}
            onChangeText={t => { setCpf(formatCpf(t)); setErrors({ ...errors, cpf: '' }); }}
            keyboardType="numeric"
          />
          {errors.cpf ? <Text style={styles.errorText}>{errors.cpf}</Text> : null}

          <Text style={styles.label}>RG</Text>
          <TextInput
            style={[styles.input, errors.rg && styles.inputError]}
            placeholder="Número do RG"
            value={rg}
            placeholderTextColor={colors.gray}
            onChangeText={t => { setRg(t); setErrors({ ...errors, rg: '' }); }}
            autoCapitalize="characters"
          />
          {errors.rg ? <Text style={styles.errorText}>{errors.rg}</Text> : null}

          {saveError ? (
            <View style={styles.errorBox}>
              <Text style={styles.errorBoxText}>⚠️ {saveError}</Text>
            </View>
          ) : null}

          <TouchableOpacity
            style={[styles.primaryButton, isLoading && styles.buttonDisabled]}
            onPress={handleSave}
            disabled={isLoading}
          >
            {isLoading
              ? <ActivityIndicator color={colors.white} />
              : <Text style={styles.primaryButtonText}>Salvar e continuar</Text>
            }
          </TouchableOpacity>

          <TouchableOpacity style={styles.skipButton} onPress={() => router.replace('/(tabs)/home')}>
            <Text style={styles.skipText}>Preencher mais tarde</Text>
          </TouchableOpacity>
        </View>

      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.white },
  scrollContent: { flexGrow: 1, padding: 28, paddingTop: 60 },

  iconContainer: {
    width: 120, height: 120, borderRadius: 60,
    backgroundColor: `${colors.primary}15`,
    alignItems: 'center', justifyContent: 'center',
    alignSelf: 'center', marginBottom: 24,
  },
  title: { fontSize: 24, fontWeight: '700', color: '#171717', textAlign: 'center', marginBottom: 12 },
  subtitle: { fontSize: 15, color: colors.gray, textAlign: 'center', lineHeight: 22, marginBottom: 32 },

  form: { flex: 1 },
  label: { fontSize: 13, fontWeight: '600', color: '#374151', marginBottom: 6, marginLeft: 4 },
  input: {
    backgroundColor: colors.lightGray,
    borderRadius: 12,
    paddingHorizontal: 16, paddingVertical: 14,
    fontSize: 16, marginBottom: 6, color: '#333',
    borderWidth: 1, borderColor: '#e5e7eb',
  },
  inputError: { borderColor: colors.error, borderWidth: 1.5 },
  errorText: { color: colors.error, fontSize: 13, marginBottom: 12, marginLeft: 4 },

  errorBox: {
    backgroundColor: '#FEE2E2', borderRadius: 8, padding: 12,
    marginBottom: 12, borderWidth: 1, borderColor: '#FECACA',
  },
  errorBoxText: { color: '#B91C1C', fontSize: 13, textAlign: 'center' },

  primaryButton: {
    backgroundColor: colors.primary, borderRadius: 12, paddingVertical: 16,
    alignItems: 'center', marginTop: 16,
  },
  buttonDisabled: { opacity: 0.6 },
  primaryButtonText: { color: colors.white, fontSize: 16, fontWeight: '600' },

  skipButton: { alignItems: 'center', marginTop: 16, padding: 8 },
  skipText: { fontSize: 14, color: colors.gray, textDecorationLine: 'underline' },
});
