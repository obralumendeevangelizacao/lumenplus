/**
 * Profile Screen (Tab)
 * ====================
 * Visualização do perfil do usuário.
 */

import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import * as SecureStore from 'expo-secure-store';

const colors = {
  primary: '#1a365d',
  white: '#ffffff',
  gray: '#6b7280',
  lightGray: '#f5f5f5',
  success: '#22c55e',
  warning: '#eab308',
};

export default function ProfileScreen() {
  const [email, setEmail] = useState('');

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

  const handleLogout = () => {
    Alert.alert(
      'Sair',
      'Deseja realmente sair da sua conta?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Sair',
          style: 'destructive',
          onPress: async () => {
            await SecureStore.deleteItemAsync('auth_token');
            router.replace('/(auth)/login');
          },
        },
      ]
    );
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Profile Header */}
      <View style={styles.headerCard}>
        <View style={styles.avatar}>
          <Ionicons name="person" size={48} color={colors.white} />
        </View>
        <Text style={styles.email}>{email || 'Email não informado'}</Text>
        <View style={styles.statusChip}>
          <Text style={styles.statusChipText}>⏳ Perfil Incompleto</Text>
        </View>
      </View>

      {/* Info Section */}
      <Text style={styles.sectionTitle}>Informações</Text>
      
      <View style={styles.card}>
        <View style={styles.row}>
          <Ionicons name="mail-outline" size={24} color={colors.gray} />
          <View style={styles.rowContent}>
            <Text style={styles.rowLabel}>Email</Text>
            <Text style={styles.rowValue}>{email}</Text>
          </View>
          <Ionicons name="alert-circle" size={20} color={colors.warning} />
        </View>
        
        <View style={styles.row}>
          <Ionicons name="call-outline" size={24} color={colors.gray} />
          <View style={styles.rowContent}>
            <Text style={styles.rowLabel}>Telefone</Text>
            <Text style={styles.rowValue}>Não verificado</Text>
          </View>
          <Ionicons name="alert-circle" size={20} color={colors.warning} />
        </View>
        
        <View style={styles.row}>
          <Ionicons name="document-text-outline" size={24} color={colors.gray} />
          <View style={styles.rowContent}>
            <Text style={styles.rowLabel}>Termos</Text>
            <Text style={styles.rowValue}>Pendentes</Text>
          </View>
          <Ionicons name="alert-circle" size={20} color={colors.warning} />
        </View>
      </View>

      {/* Actions */}
      <Text style={styles.sectionTitle}>Ações</Text>
      
      <View style={styles.card}>
        <TouchableOpacity style={styles.actionRow}>
          <Ionicons name="create-outline" size={24} color={colors.gray} />
          <Text style={styles.actionText}>Editar Perfil</Text>
          <Ionicons name="chevron-forward" size={20} color={colors.gray} />
        </TouchableOpacity>
        
        <TouchableOpacity style={styles.actionRow}>
          <Ionicons name="notifications-outline" size={24} color={colors.gray} />
          <Text style={styles.actionText}>Notificações</Text>
          <Ionicons name="chevron-forward" size={20} color={colors.gray} />
        </TouchableOpacity>
        
        <TouchableOpacity style={styles.actionRow}>
          <Ionicons name="help-circle-outline" size={24} color={colors.gray} />
          <Text style={styles.actionText}>Ajuda</Text>
          <Ionicons name="chevron-forward" size={20} color={colors.gray} />
        </TouchableOpacity>
      </View>

      {/* Logout */}
      <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
        <Text style={styles.logoutText}>Sair da Conta</Text>
      </TouchableOpacity>

      {/* Version */}
      <Text style={styles.version}>Lumen+ v1.0.0</Text>
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
    paddingBottom: 48,
  },
  headerCard: {
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
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  email: {
    fontSize: 18,
    fontWeight: '600',
    color: '#171717',
  },
  statusChip: {
    marginTop: 8,
    paddingHorizontal: 16,
    paddingVertical: 4,
    backgroundColor: '#fef3c7',
    borderRadius: 999,
  },
  statusChipText: {
    fontSize: 14,
    fontWeight: '500',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#171717',
    marginTop: 24,
    marginBottom: 8,
  },
  card: {
    backgroundColor: colors.white,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  rowContent: {
    flex: 1,
    marginLeft: 16,
  },
  rowLabel: {
    fontSize: 12,
    color: colors.gray,
  },
  rowValue: {
    fontSize: 16,
    color: '#171717',
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  actionText: {
    flex: 1,
    fontSize: 16,
    color: '#171717',
    marginLeft: 16,
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
  version: {
    textAlign: 'center',
    fontSize: 14,
    color: colors.gray,
    marginTop: 24,
  },
});
