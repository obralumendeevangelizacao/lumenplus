/**
 * Admin Menu Screen
 * =================
 * Menu de administração para usuários com permissões.
 */

import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { router, Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

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

const adminOptions: AdminOption[] = [
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
];

export default function AdminMenuScreen() {
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
            Gerencie comunicações e avisos da comunidade
          </Text>
        </View>

        <Text style={styles.sectionTitle}>Opções</Text>

        {adminOptions.map((option) => (
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
