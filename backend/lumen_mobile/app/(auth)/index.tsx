/**
 * Welcome Screen
 * ==============
 * Tela inicial com opções de Entrar ou Cadastrar.
 */

import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';

const colors = {
  primary: '#1a365d',
  primaryLight: '#2c5282',
  white: '#ffffff',
  gray: '#6b7280',
};

export default function WelcomeScreen() {
  return (
    <View style={styles.container}>
      {/* Header com logo */}
      <View style={styles.header}>
        <View style={styles.logoContainer}>
          <Text style={styles.logoText}>✝</Text>
        </View>
        <Text style={styles.title}>Lumen+</Text>
        <Text style={styles.subtitle}>Obra Lumen de Evangelização</Text>
      </View>

      {/* Texto de boas-vindas */}
      <View style={styles.content}>
        <Text style={styles.welcomeTitle}>Bem-vindo!</Text>
        <Text style={styles.welcomeText}>
          Conecte-se com sua comunidade, participe de grupos e cresça em sua vida espiritual.
        </Text>
      </View>

      {/* Botões */}
      <View style={styles.buttons}>
        <TouchableOpacity
          style={styles.primaryButton}
          onPress={() => router.push('/(auth)/login')}
        >
          <Text style={styles.primaryButtonText}>Entrar</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.secondaryButton}
          onPress={() => router.push('/(auth)/register')}
        >
          <Text style={styles.secondaryButtonText}>Criar Conta</Text>
        </TouchableOpacity>
      </View>

      {/* Footer */}
      <View style={styles.footer}>
        <Text style={styles.footerText}>
          Ao continuar, você concorda com nossos{' '}
          <Text style={styles.link}>Termos de Uso</Text> e{' '}
          <Text style={styles.link}>Política de Privacidade</Text>
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.white,
    padding: 24,
  },
  header: {
    alignItems: 'center',
    paddingTop: 80,
    paddingBottom: 40,
  },
  logoContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 8,
  },
  logoText: {
    fontSize: 56,
    color: colors.white,
  },
  title: {
    fontSize: 36,
    fontWeight: 'bold',
    color: colors.primary,
  },
  subtitle: {
    fontSize: 18,
    color: colors.gray,
    marginTop: 4,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  welcomeTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#171717',
    marginBottom: 12,
    textAlign: 'center',
  },
  welcomeText: {
    fontSize: 16,
    color: colors.gray,
    textAlign: 'center',
    lineHeight: 24,
  },
  buttons: {
    gap: 12,
    paddingBottom: 20,
  },
  primaryButton: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    padding: 18,
    alignItems: 'center',
  },
  primaryButtonText: {
    color: colors.white,
    fontSize: 18,
    fontWeight: '600',
  },
  secondaryButton: {
    backgroundColor: 'transparent',
    borderRadius: 12,
    padding: 18,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: colors.primary,
  },
  secondaryButtonText: {
    color: colors.primary,
    fontSize: 18,
    fontWeight: '600',
  },
  footer: {
    paddingVertical: 20,
  },
  footerText: {
    fontSize: 12,
    color: colors.gray,
    textAlign: 'center',
    lineHeight: 18,
  },
  link: {
    color: colors.primary,
    fontWeight: '500',
  },
});
