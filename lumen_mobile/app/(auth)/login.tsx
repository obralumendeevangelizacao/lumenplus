/**
 * Login Screen
 * ============
 * Tela de login com email e senha.
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
};

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(false);

  const validate = () => {
    const newErrors: Record<string, string> = {};

    if (!email.includes('@')) {
      newErrors.email = 'Email inválido';
    }

    if (!password) {
      newErrors.password = 'Digite sua senha';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleLogin = async () => {
    if (!validate()) return;

    try {
      setIsLoading(true);

      const response = await api.post<{ access_token: string; user_id: string }>('/auth/login', {
        email: email.trim().toLowerCase(),
        password,
      });

      await SecureStore.setItemAsync('auth_token', response.access_token);
      router.replace('/(tabs)/home');
    } catch (err: any) {
      const message = err.response?.data?.detail?.message || 'Email ou senha inválidos';
      Alert.alert('Erro', message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDevLogin = async () => {
    if (!email.includes('@')) {
      setErrors({ email: 'Email inválido' });
      return;
    }

    try {
      setIsLoading(true);
      const devToken = `dev:${email.split('@')[0]}:${email.trim().toLowerCase()}`;
      await SecureStore.setItemAsync('auth_token', devToken);
      router.replace('/(tabs)/home');
    } catch (err) {
      Alert.alert('Erro', 'Erro ao fazer login');
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
          <TouchableOpacity onPress={() => router.back()}>
            <Text style={styles.backButton}>← Voltar</Text>
          </TouchableOpacity>
        </View>

        {/* Logo */}
        <View style={styles.logoSection}>
          <View style={styles.logoContainer}>
            <Text style={styles.logoText}>✝</Text>
          </View>
          <Text style={styles.title}>Lumen+</Text>
        </View>

        {/* Form */}
        <View style={styles.form}>
          <Text style={styles.welcomeText}>Bem-vindo de volta!</Text>
          <Text style={styles.instructionText}>
            Entre com suas credenciais
          </Text>

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
            placeholder="Sua senha"
            value={password}
            onChangeText={(text) => {
              setPassword(text);
              setErrors({ ...errors, password: '' });
            }}
            secureTextEntry
            placeholderTextColor={colors.gray}
          />
          {errors.password && <Text style={styles.errorText}>{errors.password}</Text>}

          <TouchableOpacity style={styles.forgotPassword}>
            <Text style={styles.forgotPasswordText}>Esqueci minha senha</Text>
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

          {/* DEV mode shortcut */}
          <TouchableOpacity
            style={styles.devButton}
            onPress={handleDevLogin}
            disabled={isLoading}
          >
            <Text style={styles.devButtonText}>🛠️ DEV: Login sem senha</Text>
          </TouchableOpacity>
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>Não tem uma conta? </Text>
          <TouchableOpacity onPress={() => router.push('/(auth)/register')}>
            <Text style={styles.footerLink}>Criar conta</Text>
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
    paddingTop: 20,
    marginBottom: 20,
  },
  backButton: {
    fontSize: 16,
    color: colors.primary,
    fontWeight: '500',
  },
  logoSection: {
    alignItems: 'center',
    marginBottom: 32,
  },
  logoContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  logoText: {
    fontSize: 40,
    color: colors.white,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: colors.primary,
  },
  form: {
    flex: 1,
  },
  welcomeText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#171717',
    marginBottom: 4,
  },
  instructionText: {
    fontSize: 16,
    color: colors.gray,
    marginBottom: 24,
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
  forgotPassword: {
    alignSelf: 'flex-end',
    marginTop: 12,
  },
  forgotPasswordText: {
    fontSize: 14,
    color: colors.primary,
    fontWeight: '500',
  },
  primaryButton: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    padding: 18,
    alignItems: 'center',
    marginTop: 24,
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
