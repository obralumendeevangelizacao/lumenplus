/**
 * Register Screen
 * ===============
 * Tela de cadastro com todos os campos necessários.
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
  Alert,
} from 'react-native';
import { router } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import api from '@/services/api';

const colors = {
  primary: '#1a365d',
  white: '#ffffff',
  gray: '#6b7280',
  lightGray: '#f3f4f6',
  error: '#ef4444',
  success: '#22c55e',
};

export default function RegisterScreen() {
  const [step, setStep] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Step 1: Dados básicos
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // Step 2: Telefone
  const [phone, setPhone] = useState('');
  const [verificationMethod, setVerificationMethod] = useState<'WHATSAPP' | 'SMS'>('WHATSAPP');

  const validateStep1 = () => {
    const newErrors: Record<string, string> = {};

    if (!fullName.trim() || fullName.trim().length < 3) {
      newErrors.fullName = 'Nome deve ter pelo menos 3 caracteres';
    }

    if (!email.includes('@') || !email.includes('.')) {
      newErrors.email = 'Email inválido';
    }

    if (password.length < 6) {
      newErrors.password = 'Senha deve ter pelo menos 6 caracteres';
    }

    if (password !== confirmPassword) {
      newErrors.confirmPassword = 'Senhas não conferem';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const validateStep2 = () => {
    const newErrors: Record<string, string> = {};
    const phoneDigits = phone.replace(/\D/g, '');

    if (phoneDigits.length < 10 || phoneDigits.length > 11) {
      newErrors.phone = 'Telefone inválido';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const formatPhone = (value: string) => {
    const digits = value.replace(/\D/g, '').slice(0, 11);
    
    if (digits.length <= 2) return digits;
    if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
    if (digits.length <= 10) return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
  };

  const handleNextStep = () => {
    if (step === 1 && validateStep1()) {
      setStep(2);
    }
  };

  const handleRegister = async () => {
    if (!validateStep2()) return;

    try {
      setIsLoading(true);

      // Formata telefone para E.164
      const phoneDigits = phone.replace(/\D/g, '');
      const phoneE164 = `+55${phoneDigits}`;

      // Registra usuário
      const response = await api.post<{ access_token: string; user_id: string }>('/auth/register', {
        email: email.trim().toLowerCase(),
        password,
        full_name: fullName.trim(),
      });

      // Salva token
      await SecureStore.setItemAsync('auth_token', response.access_token);

      // Navega para verificação de telefone
      router.push({
        pathname: '/(auth)/verify-phone',
        params: { phone: phoneE164, method: verificationMethod },
      });
    } catch (err: any) {
      const message = err.response?.data?.detail?.message || 'Erro ao criar conta';
      Alert.alert('Erro', message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDevRegister = async () => {
    // DEV mode - pula verificações
    if (!validateStep1()) return;

    try {
      setIsLoading(true);

      const devToken = `dev:${email.split('@')[0]}:${email.trim().toLowerCase()}`;
      await SecureStore.setItemAsync('auth_token', devToken);

      // Navega para completar perfil
      router.replace('/(onboarding)/profile');
    } catch (err) {
      Alert.alert('Erro', 'Erro ao criar conta');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => step > 1 ? setStep(step - 1) : router.back()}>
            <Text style={styles.backButton}>← Voltar</Text>
          </TouchableOpacity>
          <Text style={styles.stepIndicator}>Passo {step} de 2</Text>
        </View>

        <Text style={styles.title}>
          {step === 1 ? 'Criar Conta' : 'Verificar Telefone'}
        </Text>
        <Text style={styles.subtitle}>
          {step === 1 
            ? 'Preencha seus dados para começar'
            : 'Precisamos verificar seu número'}
        </Text>

        {/* Step 1: Dados básicos */}
        {step === 1 && (
          <View style={styles.form}>
            <Text style={styles.label}>Nome completo</Text>
            <TextInput
              style={[styles.input, errors.fullName && styles.inputError]}
              placeholder="Seu nome completo"
              value={fullName}
              onChangeText={(text) => {
                setFullName(text);
                setErrors({ ...errors, fullName: '' });
              }}
              autoCapitalize="words"
              placeholderTextColor={colors.gray}
            />
            {errors.fullName && <Text style={styles.errorText}>{errors.fullName}</Text>}

            <Text style={styles.label}>Email</Text>
            <TextInput
              style={[styles.input, errors.email && styles.inputError]}
              placeholder="seu@email.com"
              value={email}
              onChangeText={(text) => {
                setEmail(text);
                setErrors({ ...errors, email: '' });
              }}
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
              placeholderTextColor={colors.gray}
            />
            {errors.email && <Text style={styles.errorText}>{errors.email}</Text>}

            <Text style={styles.label}>Senha</Text>
            <TextInput
              style={[styles.input, errors.password && styles.inputError]}
              placeholder="Mínimo 6 caracteres"
              value={password}
              onChangeText={(text) => {
                setPassword(text);
                setErrors({ ...errors, password: '' });
              }}
              secureTextEntry
              placeholderTextColor={colors.gray}
            />
            {errors.password && <Text style={styles.errorText}>{errors.password}</Text>}

            <Text style={styles.label}>Confirmar senha</Text>
            <TextInput
              style={[styles.input, errors.confirmPassword && styles.inputError]}
              placeholder="Digite a senha novamente"
              value={confirmPassword}
              onChangeText={(text) => {
                setConfirmPassword(text);
                setErrors({ ...errors, confirmPassword: '' });
              }}
              secureTextEntry
              placeholderTextColor={colors.gray}
            />
            {errors.confirmPassword && <Text style={styles.errorText}>{errors.confirmPassword}</Text>}

            <TouchableOpacity
              style={styles.primaryButton}
              onPress={handleNextStep}
            >
              <Text style={styles.primaryButtonText}>Continuar</Text>
            </TouchableOpacity>

            {/* DEV mode shortcut */}
            <TouchableOpacity
              style={styles.devButton}
              onPress={handleDevRegister}
              disabled={isLoading}
            >
              {isLoading ? (
                <ActivityIndicator color={colors.primary} />
              ) : (
                <Text style={styles.devButtonText}>🛠️ DEV: Pular verificações</Text>
              )}
            </TouchableOpacity>
          </View>
        )}

        {/* Step 2: Telefone */}
        {step === 2 && (
          <View style={styles.form}>
            <Text style={styles.label}>Telefone (WhatsApp)</Text>
            <TextInput
              style={[styles.input, errors.phone && styles.inputError]}
              placeholder="(00) 00000-0000"
              value={phone}
              onChangeText={(text) => {
                setPhone(formatPhone(text));
                setErrors({ ...errors, phone: '' });
              }}
              keyboardType="phone-pad"
              placeholderTextColor={colors.gray}
            />
            {errors.phone && <Text style={styles.errorText}>{errors.phone}</Text>}

            <Text style={styles.label}>Como deseja receber o código?</Text>
            <View style={styles.methodButtons}>
              <TouchableOpacity
                style={[
                  styles.methodButton,
                  verificationMethod === 'WHATSAPP' && styles.methodButtonActive,
                ]}
                onPress={() => setVerificationMethod('WHATSAPP')}
              >
                <Text style={[
                  styles.methodButtonText,
                  verificationMethod === 'WHATSAPP' && styles.methodButtonTextActive,
                ]}>
                  📱 WhatsApp
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.methodButton,
                  verificationMethod === 'SMS' && styles.methodButtonActive,
                ]}
                onPress={() => setVerificationMethod('SMS')}
              >
                <Text style={[
                  styles.methodButtonText,
                  verificationMethod === 'SMS' && styles.methodButtonTextActive,
                ]}>
                  💬 SMS
                </Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={[styles.primaryButton, isLoading && styles.buttonDisabled]}
              onPress={handleRegister}
              disabled={isLoading}
            >
              {isLoading ? (
                <ActivityIndicator color={colors.white} />
              ) : (
                <Text style={styles.primaryButtonText}>Enviar Código</Text>
              )}
            </TouchableOpacity>
          </View>
        )}

        {/* Link para login */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>Já tem uma conta? </Text>
          <TouchableOpacity onPress={() => router.push('/(auth)/login')}>
            <Text style={styles.footerLink}>Entrar</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.white,
  },
  scrollContent: {
    flexGrow: 1,
    padding: 24,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 32,
    paddingTop: 20,
  },
  backButton: {
    fontSize: 16,
    color: colors.primary,
    fontWeight: '500',
  },
  stepIndicator: {
    fontSize: 14,
    color: colors.gray,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#171717',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: colors.gray,
    marginBottom: 32,
  },
  form: {
    flex: 1,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#171717',
    marginBottom: 8,
    marginTop: 16,
  },
  input: {
    backgroundColor: colors.lightGray,
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#e5e5e5',
  },
  inputError: {
    borderColor: colors.error,
  },
  errorText: {
    color: colors.error,
    fontSize: 13,
    marginTop: 4,
  },
  primaryButton: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    padding: 18,
    alignItems: 'center',
    marginTop: 32,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  primaryButtonText: {
    color: colors.white,
    fontSize: 18,
    fontWeight: '600',
  },
  devButton: {
    padding: 16,
    alignItems: 'center',
    marginTop: 16,
    backgroundColor: '#fef3c7',
    borderRadius: 12,
  },
  devButtonText: {
    color: colors.gray,
    fontSize: 14,
  },
  methodButtons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  methodButton: {
    flex: 1,
    padding: 16,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#e5e5e5',
    alignItems: 'center',
  },
  methodButtonActive: {
    borderColor: colors.primary,
    backgroundColor: '#eff6ff',
  },
  methodButtonText: {
    fontSize: 16,
    color: colors.gray,
    fontWeight: '500',
  },
  methodButtonTextActive: {
    color: colors.primary,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    paddingVertical: 24,
  },
  footerText: {
    fontSize: 14,
    color: colors.gray,
  },
  footerLink: {
    fontSize: 14,
    color: colors.primary,
    fontWeight: '600',
  },
});
