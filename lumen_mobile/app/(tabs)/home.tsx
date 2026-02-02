/**
 * Home Screen
 * ===========
 * Dashboard principal do usuário.
 */

import { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl, TouchableOpacity } from 'react-native';
import { router } from 'expo-router';
import * as SecureStore from 'expo-secure-store';

const colors = {
  primary: '#1a365d',
  white: '#ffffff',
  gray: '#6b7280',
  lightGray: '#f5f5f5',
  success: '#86efac',
  warning: '#fde047',
};

export default function HomeScreen() {
  const [email, setEmail] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadUser();
  }, []);

  const loadUser = async () => {
    try {
      const token = await SecureStore.getItemAsync('auth_token');
      if (token) {
        const parts = token.split(':');
        if (parts.length >= 3) {
          setEmail(parts[2]);
        }
      }
    } catch (error) {
      console.log('Error loading user:', error);
    }
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadUser();
    setRefreshing(false);
  }, []);

  const handleLogout = async () => {
    await SecureStore.deleteItemAsync('auth_token');
    router.replace('/(auth)/login');
  };

  const firstName = email.split('@')[0] || 'Usuário';

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.greeting}>Olá, {firstName}! 👋</Text>
        <Text style={styles.subtitle}>Bem-vindo ao Lumen+</Text>
      </View>

      {/* Status Cards */}
      <View style={styles.card}>
        <View style={styles.statusRow}>
          <View style={styles.statusItem}>
            <Text style={styles.statusIcon}>✅</Text>
            <Text style={styles.statusLabel}>Perfil</Text>
            <Text style={styles.statusValue}>Pendente</Text>
          </View>
          <View style={styles.statusDivider} />
          <View style={styles.statusItem}>
            <Text style={styles.statusIcon}>📱</Text>
            <Text style={styles.statusLabel}>Telefone</Text>
            <Text style={styles.statusValue}>Pendente</Text>
          </View>
          <View style={styles.statusDivider} />
          <View style={styles.statusItem}>
            <Text style={styles.statusIcon}>📋</Text>
            <Text style={styles.statusLabel}>Termos</Text>
            <Text style={styles.statusValue}>Pendente</Text>
          </View>
        </View>
      </View>

      {/* Info */}
      <Text style={styles.sectionTitle}>Meus Vínculos</Text>
      <View style={[styles.card, styles.cardFilled]}>
        <Text style={styles.emptyText}>
          Você ainda não está vinculado a nenhum ministério ou grupo.
        </Text>
        <Text style={styles.emptyHint}>
          Acesse a aba Comunidade para solicitar vínculos.
        </Text>
      </View>

      {/* Quick Actions */}
      <Text style={styles.sectionTitle}>Ações Rápidas</Text>
      <View style={styles.actionsRow}>
        <View style={styles.actionCard}>
          <Text style={styles.actionIcon}>📅</Text>
          <Text style={styles.actionLabel}>Eventos</Text>
          <Text style={styles.actionHint}>Em breve</Text>
        </View>
        <View style={styles.actionCard}>
          <Text style={styles.actionIcon}>📖</Text>
          <Text style={styles.actionLabel}>Formação</Text>
          <Text style={styles.actionHint}>Em breve</Text>
        </View>
      </View>

      {/* Logout */}
      <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
        <Text style={styles.logoutText}>Sair</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.lightGray,
  },
  content: {
    padding: 16,
  },
  header: {
    marginBottom: 24,
  },
  greeting: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#171717',
  },
  subtitle: {
    fontSize: 16,
    color: colors.gray,
    marginTop: 4,
  },
  card: {
    backgroundColor: colors.white,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  cardFilled: {
    backgroundColor: colors.lightGray,
    shadowOpacity: 0,
    elevation: 0,
  },
  statusRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  statusItem: {
    alignItems: 'center',
    flex: 1,
  },
  statusDivider: {
    width: 1,
    backgroundColor: '#e5e5e5',
  },
  statusIcon: {
    fontSize: 24,
    marginBottom: 4,
  },
  statusLabel: {
    fontSize: 12,
    color: colors.gray,
  },
  statusValue: {
    fontSize: 12,
    fontWeight: '500',
    color: '#171717',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#171717',
    marginBottom: 12,
    marginTop: 8,
  },
  emptyText: {
    fontSize: 16,
    color: colors.gray,
    textAlign: 'center',
  },
  emptyHint: {
    fontSize: 14,
    color: colors.gray,
    textAlign: 'center',
    marginTop: 8,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 16,
  },
  actionCard: {
    flex: 1,
    backgroundColor: colors.white,
    borderRadius: 12,
    padding: 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  actionIcon: {
    fontSize: 32,
    marginBottom: 8,
  },
  actionLabel: {
    fontSize: 16,
    fontWeight: '500',
    color: '#171717',
  },
  actionHint: {
    fontSize: 14,
    color: colors.gray,
  },
  logoutButton: {
    marginTop: 32,
    padding: 16,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: colors.primary,
    alignItems: 'center',
  },
  logoutText: {
    color: colors.primary,
    fontSize: 16,
    fontWeight: '600',
  },
});
