/**
 * Verify Phone Screen
 * ===================
 * Verificação de telefone via SMS/WhatsApp.
 */

import { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
} from 'react-native';
import { router } from 'expo-router';
import { useAuthStore } from '@/stores';
import { verificationService, profileService } from '@/services';
import { Button, Loading, Card } from '@/components';
import theme from '@/theme';

type Channel = 'SMS' | 'WHATSAPP';

export default function VerifyPhoneScreen() {
  const { user, refreshUser } = useAuthStore();
  const [step, setStep] = useState<'select' | 'verify'>('select');
  const [channel, setChannel] = useState<Channel>('WHATSAPP');
  const [verificationId, setVerificationId] = useState('');
  const [code, setCode] = useState(['', '', '', '', '', '']);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [phone, setPhone] = useState('');
  const [debugCode, setDebugCode] = useState('');

  const inputRefs = useRef<(TextInput | null)[]>([]);

  useEffect(() => {
    loadPhone();
  }, []);

  const loadPhone = async () => {
    try {
      const profile = await profileService.getProfile();
      setPhone(profile.phone_e164 || '');
    } catch {
      setError('Erro ao carregar telefone');
    }
  };

  const handleStartVerification = async () => {
    if (!phone) {
      setError('Telefone não encontrado no perfil');
      return;
    }

    try {
      setIsLoading(true);
      setError('');
      const response = await verificationService.startPhone({
        phone_e164: phone,
        channel,
      });
      setVerificationId(response.verification_id);
      if (response.debug_code) {
        setDebugCode(response.debug_code);
      }
      setStep('verify');
    } catch (err: any) {
      setError(err.response?.data?.detail?.message || 'Erro ao enviar código');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCodeChange = (index: number, value: string) => {
    if (value.length > 1) {
      // Paste handling
      const digits = value.replace(/\D/g, '').slice(0, 6).split('');
      const newCode = [...code];
      digits.forEach((d, i) => {
        if (i < 6) newCode[i] = d;
      });
      setCode(newCode);
      const lastIndex = Math.min(digits.length, 5);
      inputRefs.current[lastIndex]?.focus();
      return;
    }

    const newCode = [...code];
    newCode[index] = value;
    setCode(newCode);

    // Auto-focus next input
    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyPress = (index: number, key: string) => {
    if (key === 'Backspace' && !code[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handleConfirm = async () => {
    const fullCode = code.join('');
    if (fullCode.length !== 6) {
      setError('Digite o código completo');
      return;
    }

    try {
      setIsLoading(true);
      setError('');
      await verificationService.confirmPhone({
        verification_id: verificationId,
        code: fullCode,
      });
      await refreshUser();
      router.replace('/');
    } catch (err: any) {
      setError(err.response?.data?.detail?.message || 'Código inválido');
      setCode(['', '', '', '', '', '']);
      inputRefs.current[0]?.focus();
    } finally {
      setIsLoading(false);
    }
  };

  if (step === 'select') {
    return (
      <View style={styles.container}>
        <View style={styles.content}>
          <Text style={styles.title}>Verificar Telefone</Text>
          <Text style={styles.subtitle}>
            Enviaremos um código de 6 dígitos para:
          </Text>
          <Text style={styles.phone}>{phone || 'Carregando...'}</Text>

          <Text style={styles.channelLabel}>Como deseja receber?</Text>

          <TouchableOpacity
            style={[styles.channelOption, channel === 'WHATSAPP' && styles.channelSelected]}
            onPress={() => setChannel('WHATSAPP')}
          >
            <Text style={styles.channelIcon}>💬</Text>
            <View>
              <Text style={styles.channelTitle}>WhatsApp</Text>
              <Text style={styles.channelDesc}>Receba via mensagem no WhatsApp</Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.channelOption, channel === 'SMS' && styles.channelSelected]}
            onPress={() => setChannel('SMS')}
          >
            <Text style={styles.channelIcon}>📱</Text>
            <View>
              <Text style={styles.channelTitle}>SMS</Text>
              <Text style={styles.channelDesc}>Receba via mensagem de texto</Text>
            </View>
          </TouchableOpacity>

          {error && <Text style={styles.error}>{error}</Text>}
        </View>

        <View style={styles.footer}>
          <Button
            title="Enviar Código"
            onPress={handleStartVerification}
            loading={isLoading}
            fullWidth
            size="lg"
          />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>Digite o código</Text>
        <Text style={styles.subtitle}>
          Enviamos um código de 6 dígitos via {channel === 'WHATSAPP' ? 'WhatsApp' : 'SMS'}
        </Text>

        <View style={styles.codeContainer}>
          {code.map((digit, index) => (
            <TextInput
              key={index}
              ref={(ref) => (inputRefs.current[index] = ref)}
              style={[styles.codeInput, digit && styles.codeInputFilled]}
              value={digit}
              onChangeText={(value) => handleCodeChange(index, value)}
              onKeyPress={({ nativeEvent }) => handleKeyPress(index, nativeEvent.key)}
              keyboardType="number-pad"
              maxLength={1}
              selectTextOnFocus
            />
          ))}
        </View>

        {debugCode && (
          <Card variant="filled" style={styles.debugCard}>
            <Text style={styles.debugText}>🛠️ Código de teste: {debugCode}</Text>
          </Card>
        )}

        {error && <Text style={styles.error}>{error}</Text>}

        <TouchableOpacity onPress={() => setStep('select')} style={styles.resend}>
          <Text style={styles.resendText}>Não recebeu? Tentar novamente</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.footer}>
        <Button
          title="Confirmar"
          onPress={handleConfirm}
          loading={isLoading}
          fullWidth
          size="lg"
          disabled={code.join('').length !== 6}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background.primary,
  },
  content: {
    flex: 1,
    padding: theme.spacing.lg,
  },
  title: {
    fontSize: theme.fontSize['2xl'],
    fontWeight: theme.fontWeight.bold,
    color: theme.colors.text.primary,
    marginBottom: theme.spacing.xs,
  },
  subtitle: {
    fontSize: theme.fontSize.md,
    color: theme.colors.text.secondary,
    marginBottom: theme.spacing.md,
  },
  phone: {
    fontSize: theme.fontSize.xl,
    fontWeight: theme.fontWeight.semibold,
    color: theme.colors.primary[800],
    marginBottom: theme.spacing.xl,
  },
  channelLabel: {
    fontSize: theme.fontSize.md,
    fontWeight: theme.fontWeight.medium,
    color: theme.colors.text.primary,
    marginBottom: theme.spacing.md,
  },
  channelOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: theme.spacing.md,
    backgroundColor: theme.colors.neutral[100],
    borderRadius: theme.borderRadius.lg,
    borderWidth: 2,
    borderColor: 'transparent',
    marginBottom: theme.spacing.sm,
  },
  channelSelected: {
    borderColor: theme.colors.primary[500],
    backgroundColor: theme.colors.primary[50],
  },
  channelIcon: {
    fontSize: 32,
    marginRight: theme.spacing.md,
  },
  channelTitle: {
    fontSize: theme.fontSize.md,
    fontWeight: theme.fontWeight.semibold,
    color: theme.colors.text.primary,
  },
  channelDesc: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.text.secondary,
  },
  codeContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: theme.spacing.sm,
    marginVertical: theme.spacing.xl,
  },
  codeInput: {
    width: 48,
    height: 56,
    borderRadius: theme.borderRadius.lg,
    backgroundColor: theme.colors.neutral[100],
    borderWidth: 2,
    borderColor: theme.colors.neutral[200],
    fontSize: theme.fontSize['2xl'],
    fontWeight: theme.fontWeight.bold,
    textAlign: 'center',
    color: theme.colors.text.primary,
  },
  codeInputFilled: {
    borderColor: theme.colors.primary[500],
    backgroundColor: theme.colors.white,
  },
  debugCard: {
    marginTop: theme.spacing.md,
  },
  debugText: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.text.secondary,
    textAlign: 'center',
  },
  error: {
    color: theme.colors.error.main,
    fontSize: theme.fontSize.sm,
    textAlign: 'center',
    marginTop: theme.spacing.md,
  },
  resend: {
    marginTop: theme.spacing.lg,
    alignItems: 'center',
  },
  resendText: {
    fontSize: theme.fontSize.md,
    color: theme.colors.primary[600],
  },
  footer: {
    padding: theme.spacing.lg,
    borderTopWidth: 1,
    borderTopColor: theme.colors.neutral[200],
  },
});
