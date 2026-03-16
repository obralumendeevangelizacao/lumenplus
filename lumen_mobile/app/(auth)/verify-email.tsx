/**
 * Verify Email Screen
 * ===================
 * Verificação de e-mail via token.
 * Em DEV: confirma automaticamente usando o debug_token retornado pela API.
 * Em PROD: o usuário receberia um link por e-mail (não implementado ainda).
 */

import { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { verificationService } from '@/services';

const colors = {
  primary: '#1a365d',
  white: '#ffffff',
  gray: '#6b7280',
  lightGray: '#f3f4f6',
  error: '#ef4444',
  success: '#22c55e',
  warning: '#f59e0b',
  devBg: '#fefce8',
  devBorder: '#fde047',
};

export default function VerifyEmailScreen() {
  const params = useLocalSearchParams<{ email: string }>();
  const email = params.email || '';

  const [isLoading, setIsLoading] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [debugToken, setDebugToken] = useState<string | null>(null);
  const [verificationStarted, setVerificationStarted] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (email) {
      sendVerificationEmail();
    }
  }, []);

  const sendVerificationEmail = async () => {
    if (!email) {
      setError('E-mail não informado');
      return;
    }
    if (isSending) return;

    try {
      setIsSending(true);
      setError('');
      const response = await verificationService.startEmail(email);
      setVerificationStarted(true);

      if (response.debug_token) {
        // DEV: token retornado diretamente
        setDebugToken(response.debug_token);
      }
    } catch (err: any) {
      const msg = err.response?.data?.detail?.message || 'Erro ao enviar verificação';
      if (err.response?.data?.detail?.error === 'already_verified') {
        setConfirmed(true);
        return;
      }
      setError(msg);
    } finally {
      setIsSending(false);
    }
  };

  const handleAutoConfirm = async () => {
    if (!debugToken) return;
    try {
      setIsLoading(true);
      setError('');
      await verificationService.confirmEmail(debugToken);
      setConfirmed(true);
    } catch (err: any) {
      const msg = err.response?.data?.detail?.message || 'Erro ao confirmar e-mail';
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  };

  const handleContinue = () => {
    router.replace('/(tabs)/home');
  };

  // ─── TELA DE SUCESSO ────────────────────────────────────────────────────────
  if (confirmed) {
    return (
      <View style={styles.container}>
        <View style={styles.content}>
          <View style={styles.iconContainer}>
            <Text style={styles.icon}>✅</Text>
          </View>
          <Text style={styles.title}>E-mail verificado!</Text>
          <Text style={styles.subtitle}>
            Seu e-mail <Text style={styles.emailHighlight}>{email}</Text> foi verificado com sucesso.
          </Text>
          <TouchableOpacity style={styles.primaryButton} onPress={handleContinue}>
            <Text style={styles.primaryButtonText}>Continuar</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // ─── TELA PRINCIPAL ─────────────────────────────────────────────────────────
  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={styles.content}>
        {/* Voltar */}
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.backButtonText}>← Voltar</Text>
        </TouchableOpacity>

        {/* Ícone */}
        <View style={styles.iconContainer}>
          <Text style={styles.icon}>📧</Text>
        </View>

        <Text style={styles.title}>Verificar E-mail</Text>
        <Text style={styles.subtitle}>
          {verificationStarted
            ? 'Enviamos um link de verificação para:'
            : 'Vamos verificar seu e-mail:'}
        </Text>
        <Text style={styles.emailHighlight}>{email}</Text>

        {/* Erro */}
        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        {/* Loading inicial */}
        {isSending && (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={styles.loadingText}>Enviando verificação...</Text>
          </View>
        )}

        {/* Card DEV */}
        {debugToken && !confirmed && (
          <View style={styles.devCard}>
            <Text style={styles.devTitle}>🛠️ Modo DEV</Text>
            <Text style={styles.devText}>
              Em produção, o usuário receberia um link por e-mail. No ambiente de
              desenvolvimento, confirme diretamente:
            </Text>
            <TouchableOpacity
              style={[styles.devButton, isLoading && styles.buttonDisabled]}
              onPress={handleAutoConfirm}
              disabled={isLoading}
            >
              {isLoading ? (
                <ActivityIndicator size="small" color={colors.primary} />
              ) : (
                <Text style={styles.devButtonText}>✓ Confirmar E-mail Automaticamente</Text>
              )}
            </TouchableOpacity>
          </View>
        )}

        {/* Produção: aguardar link */}
        {verificationStarted && !debugToken && !error && (
          <View style={styles.infoCard}>
            <Text style={styles.infoText}>
              Verifique sua caixa de entrada e clique no link que enviamos.{'\n\n'}
              O link expira em 30 minutos.
            </Text>
          </View>
        )}

        {/* Reenviar */}
        {verificationStarted && !isSending && (
          <TouchableOpacity
            onPress={sendVerificationEmail}
            style={styles.resendButton}
            disabled={isSending}
          >
            <Text style={styles.resendText}>Reenviar verificação</Text>
          </TouchableOpacity>
        )}

        {/* Pular por enquanto */}
        <TouchableOpacity onPress={handleContinue} style={styles.skipButton}>
          <Text style={styles.skipText}>Verificar depois</Text>
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
    marginBottom: 8,
  },
  emailHighlight: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.primary,
    textAlign: 'center',
    marginBottom: 24,
  },
  errorText: {
    color: colors.error,
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 16,
  },
  loadingContainer: {
    alignItems: 'center',
    marginVertical: 32,
    gap: 12,
  },
  loadingText: {
    fontSize: 16,
    color: colors.gray,
  },
  // DEV Card
  devCard: {
    backgroundColor: colors.devBg,
    borderWidth: 1,
    borderColor: colors.devBorder,
    borderRadius: 12,
    padding: 20,
    marginBottom: 20,
  },
  devTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#854d0e',
    marginBottom: 8,
  },
  devText: {
    fontSize: 14,
    color: '#78350f',
    lineHeight: 20,
    marginBottom: 16,
  },
  devButton: {
    backgroundColor: colors.white,
    borderWidth: 2,
    borderColor: colors.devBorder,
    borderRadius: 8,
    padding: 14,
    alignItems: 'center',
  },
  devButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#854d0e',
  },
  // Info produção
  infoCard: {
    backgroundColor: colors.lightGray,
    borderRadius: 12,
    padding: 20,
    marginBottom: 20,
  },
  infoText: {
    fontSize: 15,
    color: colors.gray,
    textAlign: 'center',
    lineHeight: 22,
  },
  // Botões
  primaryButton: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    padding: 18,
    alignItems: 'center',
    marginTop: 32,
  },
  primaryButtonText: {
    color: colors.white,
    fontSize: 18,
    fontWeight: '600',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  resendButton: {
    alignItems: 'center',
    paddingVertical: 12,
    marginBottom: 8,
  },
  resendText: {
    fontSize: 16,
    color: colors.primary,
    fontWeight: '500',
  },
  skipButton: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  skipText: {
    fontSize: 14,
    color: colors.gray,
    textDecorationLine: 'underline',
  },
});
