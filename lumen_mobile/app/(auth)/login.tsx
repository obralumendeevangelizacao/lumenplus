/**
 * Login Screen
 * ============
 * Autenticação via Firebase (email + senha).
 * Recuperação de senha via Firebase sendPasswordResetEmail.
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
  StatusBar,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import {
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
} from 'firebase/auth';
import { auth, IS_DEV_AUTH } from '@/config/firebase';
import api, { setDevToken } from '@/services/api';

const colors = {
  primary: '#1A859B',
  white: '#ffffff',
  orange: '#F5A623',
  gray: '#6b7280',
  inputBg: 'rgba(255, 255, 255, 0.9)',
};

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(false);

  const validate = () => {
    const newErrors: Record<string, string> = {};
    if (!email.includes('@')) newErrors.email = 'Email inválido';
    if (!IS_DEV_AUTH && !password) newErrors.password = 'Digite sua senha';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleLogin = async () => {
    if (!validate()) return;
    try {
      setIsLoading(true);

      if (IS_DEV_AUTH) {
        // Modo DEV: autentica diretamente no backend (sem Firebase)
        const res = await fetch(`${api.baseUrl}/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: email.trim().toLowerCase(), password: 'dev-password' }),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          const msg = err?.detail?.message ?? 'Usuário não encontrado. Crie uma conta primeiro.';
          Alert.alert('Erro ao entrar', msg);
          return;
        }
        const data = await res.json();
        await setDevToken(data.access_token);
        router.replace('/(tabs)/home');
        return;
      }

      await signInWithEmailAndPassword(auth, email.trim().toLowerCase(), password);
      router.replace('/(tabs)/home');
    } catch (err: unknown) {
      const code = (err as { code?: string }).code ?? '';
      let message = 'Email ou senha inválidos';
      if (code === 'auth/user-not-found') message = 'Usuário não encontrado';
      if (code === 'auth/wrong-password') message = 'Senha incorreta';
      if (code === 'auth/too-many-requests') message = 'Muitas tentativas. Aguarde e tente novamente';
      if (code === 'auth/invalid-credential') message = 'Email ou senha inválidos';
      Alert.alert('Erro ao entrar', message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    if (IS_DEV_AUTH) {
      Alert.alert('Modo DEV', 'Recuperação de senha não disponível em modo de desenvolvimento.');
      return;
    }
    if (!email.includes('@')) {
      setErrors({ email: 'Digite seu email acima primeiro' });
      return;
    }
    try {
      await sendPasswordResetEmail(auth, email.trim().toLowerCase());
      Alert.alert(
        'Email enviado',
        `Enviamos um link de redefinição de senha para ${email.trim().toLowerCase()}.`
      );
    } catch {
      Alert.alert('Erro', 'Não foi possível enviar o email. Verifique o endereço e tente novamente.');
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={colors.primary} />

      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Logo Section */}
          <View style={styles.logoSection}>
            <View style={styles.compassContainer}>
              <Ionicons name="compass-outline" size={80} color={colors.white} />
            </View>
            <Text style={styles.logoText}>
              LUMEN<Text style={styles.logoPlus}>+</Text>
            </Text>
            <Text style={styles.slogan}>
              Mais <Text style={styles.sloganBold}>Luz</Text> | Mais{' '}
              <Text style={styles.sloganBold}>Encontro</Text>
            </Text>
          </View>

          {/* Form */}
          <View style={styles.form}>
            <TextInput
              style={[styles.input, errors.email && styles.inputError]}
              placeholder="E-mail"
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
            {errors.email ? (
              <Text style={styles.errorText}>{errors.email}</Text>
            ) : null}

            <TextInput
              style={[styles.input, errors.password && styles.inputError]}
              placeholder="Senha"
              value={password}
              onChangeText={(text) => {
                setPassword(text);
                setErrors({ ...errors, password: '' });
              }}
              secureTextEntry
              placeholderTextColor={colors.gray}
            />
            {errors.password ? (
              <Text style={styles.errorText}>{errors.password}</Text>
            ) : null}

            <TouchableOpacity
              style={styles.forgotPassword}
              onPress={handleForgotPassword}
            >
              <Text style={styles.forgotPasswordText}>Esqueci a senha</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.primaryButton, isLoading && styles.buttonDisabled]}
              onPress={handleLogin}
              disabled={isLoading}
            >
              {isLoading ? (
                <ActivityIndicator color={colors.white} />
              ) : (
                <Text style={styles.primaryButtonText}>Entrar</Text>
              )}
            </TouchableOpacity>
          </View>

          {/* Footer */}
          <View style={styles.footer}>
            <Text style={styles.footerText}>Não tem uma conta? </Text>
            <TouchableOpacity onPress={() => router.push('/(auth)/register')}>
              <Text style={styles.footerLink}>Crie agora.</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.primary,
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 32,
    paddingTop: 60,
    paddingBottom: 40,
  },
  logoSection: {
    alignItems: 'center',
    marginBottom: 48,
  },
  compassContainer: {
    marginBottom: 16,
  },
  logoText: {
    fontSize: 36,
    fontWeight: 'bold',
    color: colors.white,
    letterSpacing: 2,
  },
  logoPlus: {
    fontSize: 36,
    fontWeight: 'normal',
  },
  slogan: {
    fontSize: 16,
    color: colors.white,
    opacity: 0.9,
    marginTop: 8,
  },
  sloganBold: {
    fontWeight: 'bold',
  },
  form: {
    flex: 1,
  },
  input: {
    backgroundColor: colors.inputBg,
    borderRadius: 25,
    paddingHorizontal: 20,
    paddingVertical: 16,
    fontSize: 16,
    marginBottom: 12,
    color: '#333',
  },
  inputError: {
    borderWidth: 2,
    borderColor: '#ef4444',
    marginBottom: 4,
  },
  errorText: {
    color: '#fecaca',
    fontSize: 13,
    marginBottom: 10,
    marginLeft: 16,
  },
  forgotPassword: {
    alignSelf: 'flex-end',
    marginBottom: 20,
  },
  forgotPasswordText: {
    fontSize: 14,
    color: colors.white,
    textDecorationLine: 'underline',
  },
  primaryButton: {
    backgroundColor: colors.orange,
    borderRadius: 25,
    paddingVertical: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  primaryButtonText: {
    color: colors.white,
    fontSize: 18,
    fontWeight: '600',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    paddingTop: 32,
  },
  footerText: {
    fontSize: 14,
    color: colors.white,
  },
  footerLink: {
    fontSize: 14,
    color: colors.white,
    fontWeight: 'bold',
    textDecorationLine: 'underline',
  },
});
