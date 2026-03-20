/**
 * Admin Menu Screen
 * =================
 * Menu de administração para usuários com permissões.
 */

import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { router, Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '@/stores';

const colors = {
  primary: '#1A859B',
  white: '#ffffff',
  gray: '#6b7280',
  lightGray: '#E8E8E8',
  admin: '#7c3aed',
};

interface AdminOption {
  id: string;
  title: string;
  description: string;
  icon: string;
  route: string;
}

interface AdminSection {
  title: string;
  options: AdminOption[];
}

const dashboardSection: AdminSection = {
  title: 'Análise',
  options: [
    {
      id: 'dashboard',
      title: 'Dashboard',
      description: 'Métricas e visão geral do aplicativo',
      icon: 'bar-chart',
      route: '/admin/dashboard',
    },
  ],
};

const adminOnlySections: AdminSection[] = [
  {
    title: 'Comunicações',
    options: [
      {
        id: 'create-aviso',
        title: 'Criar Aviso',
        description: 'Envie comunicados para membros',
        icon: 'megaphone-outline',
        route: '/admin/create-aviso',
      },
      {
        id: 'sent-avisos',
        title: 'Avisos Enviados',
        description: 'Veja o histórico de avisos enviados',
        icon: 'paper-plane-outline',
        route: '/admin/sent-avisos',
      },
    ],
  },
  {
    title: 'Estrutura',
    options: [
      {
        id: 'entities',
        title: 'Entidades',
        description: 'Gerencie setores, ministérios e grupos',
        icon: 'git-network-outline',
        route: '/admin/entities',
      },
    ],
  },
  {
    title: 'Pessoas',
    options: [
      {
        id: 'users',
        title: 'Gestão de Usuários',
        description: 'Veja e gerencie os membros cadastrados',
        icon: 'people-outline',
        route: '/admin/users',
      },
    ],
  },
  {
    title: 'Segurança',
    options: [
      {
        id: 'audit-logs',
        title: 'Logs de Auditoria',
        description: 'Histórico de ações realizadas no sistema',
        icon: 'shield-checkmark-outline',
        route: '/admin/audit-logs',
      },
    ],
  },
];

export default function AdminMenuScreen() {
  const { user } = useAuthStore();
  const globalRoles = user?.global_roles ?? [];
  const isAnalista =
    globalRoles.includes('ANALISTA') &&
    !globalRoles.includes('ADMIN') &&
    !globalRoles.includes('DEV');

  // ANALISTAs see only the Dashboard section; full admins see everything
  const sectionsToShow: AdminSection[] = isAnalista
    ? [dashboardSection]
    : [dashboardSection, ...adminOnlySections];

  return (
    <>
      <Stack.Screen
        options={{
          title: 'Administração',
          headerStyle: { backgroundColor: colors.admin },
          headerTintColor: colors.white,
        }}
      />

      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <View style={styles.headerIconContainer}>
            <Ionicons name="shield-checkmark" size={32} color={colors.white} />
          </View>
          <Text style={styles.headerTitle}>Área Administrativa</Text>
          <Text style={styles.headerSubtitle}>
            Gerencie entidades, membros e comunicações
          </Text>
        </View>

        {sectionsToShow.map((section) => (
          <View key={section.title}>
            <Text style={styles.sectionTitle}>{section.title}</Text>
            {section.options.map((option) => (
              <TouchableOpacity
                key={option.id}
                style={styles.optionCard}
                onPress={() => router.push(option.route as any)}
                activeOpacity={0.7}
              >
                <View style={styles.optionIconContainer}>
                  <Ionicons name={option.icon as any} size={24} color={colors.admin} />
                </View>
                <View style={styles.optionContent}>
                  <Text style={styles.optionTitle}>{option.title}</Text>
                  <Text style={styles.optionDescription}>{option.description}</Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color={colors.gray} />
              </TouchableOpacity>
            ))}
          </View>
        ))}

        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <Text style={styles.backButtonText}>Voltar ao Início</Text>
        </TouchableOpacity>
      </ScrollView>
    </>
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
  header: {
    backgroundColor: colors.admin,
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    marginBottom: 24,
  },
  headerIconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.white,
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
    textAlign: 'center',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#171717',
    marginBottom: 12,
  },
  optionCard: {
    backgroundColor: colors.white,
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  optionIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: `${colors.admin}15`,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  optionContent: {
    flex: 1,
  },
  optionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#171717',
    marginBottom: 2,
  },
  optionDescription: {
    fontSize: 13,
    color: colors.gray,
  },
  backButton: {
    marginTop: 24,
    padding: 16,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: colors.admin,
    alignItems: 'center',
  },
  backButtonText: {
    color: colors.admin,
    fontSize: 16,
    fontWeight: '600',
  },
});
