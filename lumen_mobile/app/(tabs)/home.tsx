/**
 * Home Screen
 * ===========
 * Dashboard principal do usuário.
 */

import { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl, TouchableOpacity } from 'react-native';
import { router } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import { Ionicons } from '@expo/vector-icons';
import api from '@/services/api';

const colors = {
  primary: '#1A859B',
  white: '#ffffff',
  gray: '#6b7280',
  lightGray: '#E8E8E8',
  success: '#22c55e',
  warning: '#f59e0b',
  admin: '#7c3aed',
};

interface Aviso {
  id: string;
  title: string;
  message: string;
  type: 'info' | 'warning' | 'success' | 'urgent';
  read: boolean;
  created_at: string;
}

export default function HomeScreen() {
  const [userName, setUserName] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [avisosNaoLidos, setAvisosNaoLidos] = useState<Aviso[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasAdminAccess, setHasAdminAccess] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      // Carregar nome do usuário
      const token = await SecureStore.getItemAsync('auth_token');
      if (token) {
        const parts = token.split(':');
        if (parts.length >= 2) {
          const name = parts[1].charAt(0).toUpperCase() + parts[1].slice(1);
          setUserName(name);
        }
      }

      // Verificar permissões de admin
      try {
        const permResponse = await api.get('/inbox/permissions');
        setHasAdminAccess(permResponse.data.has_admin_access || false);
      } catch (error) {
        setHasAdminAccess(false);
      }

      // Carregar avisos não lidos
      try {
        const response = await api.get('/inbox/unread');
        setAvisosNaoLidos(response.data || []);
      } catch (error) {
        setAvisosNaoLidos([]);
      }
    } catch (error) {
      console.log('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  }, []);

  const handleLogout = async () => {
    await SecureStore.deleteItemAsync('auth_token');
    router.replace('/(auth)/login');
  };

  const handleOpenAviso = (aviso: Aviso) => {
    router.push('/(tabs)/invites');
  };

  const getAvisoIcon = (type: string) => {
    switch (type) {
      case 'urgent':
        return { name: 'alert-circle', color: '#ef4444' };
      case 'warning':
        return { name: 'warning', color: '#f59e0b' };
      case 'success':
        return { name: 'checkmark-circle', color: '#22c55e' };
      default:
        return { name: 'information-circle', color: colors.primary };
    }
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffHours < 1) return 'Agora';
    if (diffHours < 24) return `Há ${diffHours}h`;
    if (diffDays === 1) return 'Ontem';
    if (diffDays < 7) return `Há ${diffDays} dias`;
    return date.toLocaleDateString('pt-BR');
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.primary]} />
      }
    >
      {/* Greeting */}
      <Text style={styles.greeting}>Olá, {userName || 'Usuário'}!</Text>

      {/* Admin Button */}
      {hasAdminAccess && (
        <TouchableOpacity 
          style={styles.adminButton}
          onPress={() => router.push('/admin')}
        >
          <View style={styles.adminIconContainer}>
            <Ionicons name="shield-checkmark" size={24} color={colors.white} />
          </View>
          <View style={styles.adminTextContainer}>
            <Text style={styles.adminTitle}>Administração</Text>
            <Text style={styles.adminSubtitle}>Gerenciar avisos e comunicações</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={colors.admin} />
        </TouchableOpacity>
      )}

      {/* Avisos Section */}
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Avisos</Text>
        {avisosNaoLidos.length > 0 && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{avisosNaoLidos.length}</Text>
          </View>
        )}
      </View>

      {avisosNaoLidos.length > 0 ? (
        <View style={styles.avisosContainer}>
          {avisosNaoLidos.slice(0, 5).map((aviso) => {
            const icon = getAvisoIcon(aviso.type);
            return (
              <TouchableOpacity 
                key={aviso.id} 
                style={styles.avisoCard}
                onPress={() => handleOpenAviso(aviso)}
                activeOpacity={0.7}
              >
                <View style={[styles.avisoIconContainer, { backgroundColor: `${icon.color}15` }]}>
                  <Ionicons name={icon.name as any} size={24} color={icon.color} />
                </View>
                <View style={styles.avisoContent}>
                  <Text style={styles.avisoTitle} numberOfLines={1}>{aviso.title}</Text>
                  <Text style={styles.avisoMessage} numberOfLines={2}>{aviso.message}</Text>
                  <Text style={styles.avisoDate}>{formatDate(aviso.created_at)}</Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color={colors.gray} />
              </TouchableOpacity>
            );
          })}
          
          {avisosNaoLidos.length > 5 && (
            <TouchableOpacity 
              style={styles.verMaisButton}
              onPress={() => router.push('/(tabs)/invites')}
            >
              <Text style={styles.verMaisText}>Ver todos os avisos ({avisosNaoLidos.length})</Text>
            </TouchableOpacity>
          )}
        </View>
      ) : (
        <View style={styles.allReadCard}>
          <View style={styles.allReadIconContainer}>
            <Ionicons name="checkmark-done-circle" size={48} color={colors.success} />
          </View>
          <Text style={styles.allReadTitle}>Você já leu todos os avisos!</Text>
          <Text style={styles.allReadMessage}>Obrigado pela comunhão!</Text>
        </View>
      )}

      {/* Quick Actions */}
      <Text style={styles.sectionTitle}>Acesso Rápido</Text>
      <View style={styles.quickActions}>
        <TouchableOpacity 
          style={styles.quickActionCard}
          onPress={() => router.push('/(tabs)/profile')}
        >
          <Ionicons name="person-outline" size={28} color={colors.primary} />
          <Text style={styles.quickActionText}>Meu Perfil</Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={styles.quickActionCard}
          onPress={() => router.push('/(tabs)/invites')}
        >
          <Ionicons name="mail-outline" size={28} color={colors.primary} />
          <Text style={styles.quickActionText}>Inbox</Text>
        </TouchableOpacity>
      </View>

      {/* Logout Button */}
      <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
        <Text style={styles.logoutText}>Sair da conta</Text>
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
    paddingBottom: 32,
  },
  greeting: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#171717',
    marginBottom: 20,
  },
  // Admin Button
  adminButton: {
    backgroundColor: colors.white,
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
    borderWidth: 2,
    borderColor: colors.admin,
  },
  adminIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.admin,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  adminTextContainer: {
    flex: 1,
  },
  adminTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.admin,
  },
  adminSubtitle: {
    fontSize: 13,
    color: colors.gray,
    marginTop: 2,
  },
  // Section
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#171717',
  },
  badge: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 2,
    marginLeft: 8,
  },
  badgeText: {
    color: colors.white,
    fontSize: 12,
    fontWeight: '600',
  },
  // Avisos
  avisosContainer: {
    marginBottom: 24,
  },
  avisoCard: {
    backgroundColor: colors.white,
    borderRadius: 12,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  avisoIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  avisoContent: {
    flex: 1,
  },
  avisoTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#171717',
    marginBottom: 2,
  },
  avisoMessage: {
    fontSize: 13,
    color: colors.gray,
    lineHeight: 18,
  },
  avisoDate: {
    fontSize: 11,
    color: colors.gray,
    marginTop: 4,
  },
  verMaisButton: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  verMaisText: {
    color: colors.primary,
    fontSize: 14,
    fontWeight: '500',
  },
  // All Read
  allReadCard: {
    backgroundColor: colors.white,
    borderRadius: 16,
    padding: 32,
    alignItems: 'center',
    marginBottom: 24,
  },
  allReadIconContainer: {
    marginBottom: 16,
  },
  allReadTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#171717',
    marginBottom: 4,
  },
  allReadMessage: {
    fontSize: 14,
    color: colors.gray,
  },
  // Quick Actions
  quickActions: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 24,
    marginTop: 12,
  },
  quickActionCard: {
    flex: 1,
    backgroundColor: colors.white,
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
  },
  quickActionText: {
    fontSize: 14,
    color: '#171717',
    marginTop: 8,
    fontWeight: '500',
  },
  // Logout
  logoutButton: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#ef4444',
    alignItems: 'center',
  },
  logoutText: {
    color: '#ef4444',
    fontSize: 16,
    fontWeight: '600',
  },
});
