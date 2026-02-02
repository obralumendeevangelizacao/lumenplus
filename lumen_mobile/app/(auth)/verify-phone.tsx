/**
 * Verify Phone Screen
 * ===================
 * Tela de verificação de telefone via WhatsApp ou SMS.
 */

import { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import api from '@/services/api';

const colors = {
  primary: '#1a365d',
  white: '#ffffff',
  gray: '#6b7280',
  lightGray: '#f3f4f6',
  error: '#ef4444',
  success: '#22c55e',
};

export default function VerifyPhoneScreen() {
  const params = useLocalSearchParams<{ phone: string; method: string }>();
  const [code, setCode] = useState(['', '', '', '', '', '']);
  const [isLoading, setIsLoading] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [verificationId, setVerificationId] = useState<string | null>(null);
  const [countdown, setCountdown] = useState(0);
  const [error, setError] = useState('');
  
  const inputRefs = useRef<(TextInput | null)[]>([]);

  useEffect(() => {
    // Envia código automaticamente ao entrar na tela
    sendVerificationCode();
  }, []);

  useEffect(() => {
    // Countdown para reenviar
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [countdown]);

  const sendVerificationCode = async () => {
    if (isSending || countdown > 0) return;

    try {
      setIsSending(true);
      setError('');

      const response = await api.post<{ verification_id: string; debug_code?: string }>(
        '/verify/phone/start',
        {
          phone_e164: params.phone,
          channel: params.method || 'WHATSAPP',
        }
      );

      setVerificationId(response.verification_id);
      setCountdown(60);

      // DEV mode: mostra código
      if (response.debug_code) {
        Alert.alert('DEV Mode', `Código: ${response.debug_code}`);
      }
    } catch (err: any) {
      const message = err.response?.data?.detail?.message || 'Erro ao enviar código';
      setError(message);
    } finally {
      setIsSending(false);
    }
  };

  const handleCodeChange = (index: number, value: string) => {
    if (value.length > 1) {
      // Colou um código completo
      const digits = value.replace(/\D/g, '').slice(0, 6);
      const newCode = [...code];
      for (let i = 0; i < 6; i++) {
        newCode[i] = digits[i] || '';
      }
      setCode(newCode);
      if (digits.length === 6) {
        inputRefs.current[5]?.blur();
        verifyCode(newCode.join(''));
      }
      return;
    }

    const newCode = [...code];
    newCode[index] = value;
    setCode(newCode);
    setError('');

    // Move para próximo input
    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }

    // Verifica automaticamente quando completo
    if (value && index === 5) {
      const fullCode = newCode.join('');
      if (fullCode.length === 6) {
        verifyCode(fullCode);
      }
    }
  };

  const handleKeyPress = (index: number, key: string) => {
    if (key === 'Backspace' && !code[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const verifyCode = async (fullCode: string) => {
    if (!verificationId) {
      setError('Envie o código primeiro');
      return;
    }

    try {
      setIsLoading(true);
      setError('');

      await api.post('/verify/phone/confirm', {
        verification_id: verificationId,
        code: fullCode,
      });

      // Sucesso! Navega para completar perfil
      Alert.alert('Sucesso!', 'Telefone verificado com sucesso!', [
        { text: 'Continuar', onPress: () => router.replace('/(onboarding)/profile') },
      ]);
    } catch (err: any) {
      const message = err.response?.data?.detail?.message || 'Código inválido';
      setError(message);
      setCode(['', '', '', '', '', '']);
      inputRefs.current[0]?.focus();
    } finally {
      setIsLoading(false);
    }
  };

  const formatPhone = (phone: string) => {
    if (!phone) return '';
    const digits = phone.replace(/\D/g, '');
    if (digits.startsWith('55') && digits.length >= 12) {
      const ddd = digits.slice(2, 4);
      const number = digits.slice(4);
      if (number.length === 9) {
        return `(${ddd}) ${number.slice(0, 5)}-${number.slice(5)}`;
      }
      return `(${ddd}) ${number.slice(0, 4)}-${number.slice(4)}`;
    }
    return phone;
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={styles.content}>
        {/* Header */}
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.backButtonText}>← Voltar</Text>
        </TouchableOpacity>

        {/* Icon */}
        <View style={styles.iconContainer}>
          <Text style={styles.icon}>📱</Text>
        </View>

        <Text style={styles.title}>Verificar Telefone</Text>
        <Text style={styles.subtitle}>
          Enviamos um código de 6 dígitos para{'\n'}
          <Text style={styles.phone}>{formatPhone(params.phone || '')}</Text>
          {'\n'}via {params.method === 'SMS' ? 'SMS' : 'WhatsApp'}
        </Text>

        {/* Code inputs */}
        <View style={styles.codeContainer}>
          {code.map((digit, index) => (
            <TextInput
              key={index}
              ref={(ref) => (inputRefs.current[index] = ref)}
              style={[
                styles.codeInput,
                digit && styles.codeInputFilled,
                error && styles.codeInputError,
              ]}
              value={digit}
              onChangeText={(value) => handleCodeChange(index, value)}
              onKeyPress={({ nativeEvent }) => handleKeyPress(index, nativeEvent.key)}
              keyboardType="number-pad"
              maxLength={1}
              selectTextOnFocus
            />
          ))}
        </View>

        {error && <Text style={styles.errorText}>{error}</Text>}

        {isLoading && (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={styles.loadingText}>Verificando...</Text>
          </View>
        )}

        {/* Resend */}
        <View style={styles.resendContainer}>
          {countdown > 0 ? (
            <Text style={styles.countdownText}>
              Reenviar código em {countdown}s
            </Text>
          ) : (
            <TouchableOpacity onPress={sendVerificationCode} disabled={isSending}>
              <Text style={styles.resendText}>
                {isSending ? 'Enviando...' : 'Reenviar código'}
              </Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Change method */}
        <TouchableOpacity
          style={styles.changeMethodButton}
          onPress={() => router.back()}
        >
          <Text style={styles.changeMethodText}>
            Usar outro número ou método
          </Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.white,
  },
  content: {
    flex: 1,
    padding: 24,
    paddingTop: 60,
  },
  backButton: {
    marginBottom: 32,
  },
  backButtonText: {
    fontSize: 16,
    color: colors.primary,
    fontWeight: '500',
  },
  iconContainer: {
    alignItems: 'center',
    marginBottom: 24,
  },
  icon: {
    fontSize: 64,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#171717',
    textAlign: 'center',
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 16,
    color: colors.gray,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 32,
  },
  phone: {
    fontWeight: '600',
    color: '#171717',
  },
  codeContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 24,
  },
  codeInput: {
    width: 48,
    height: 56,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#e5e5e5',
    backgroundColor: colors.lightGray,
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    color: '#171717',
  },
  codeInputFilled: {
    borderColor: colors.primary,
    backgroundColor: '#eff6ff',
  },
  codeInputError: {
    borderColor: colors.error,
    backgroundColor: '#fef2f2',
  },
  errorText: {
    color: colors.error,
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 16,
  },
  loadingContainer: {
    alignItems: 'center',
    marginVertical: 24,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: colors.gray,
  },
  resendContainer: {
    alignItems: 'center',
    marginTop: 32,
  },
  countdownText: {
    fontSize: 14,
    color: colors.gray,
  },
  resendText: {
    fontSize: 16,
    color: colors.primary,
    fontWeight: '600',
  },
  changeMethodButton: {
    alignItems: 'center',
    marginTop: 24,
  },
  changeMethodText: {
    fontSize: 14,
    color: colors.gray,
    textDecorationLine: 'underline',
  },
});
