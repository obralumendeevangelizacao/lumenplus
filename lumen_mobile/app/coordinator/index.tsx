/**
 * Coordinator Screen
 * ==================
 * Área do coordenador: lista as unidades que ele coordena
 * e permite gerenciar membros de cada uma.
 */

import { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { router, Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { orgService } from '@/services';
import type { Membership } from '@/types';

const colors = {
  coord: '#059669',
  coordLight: 'rgba(5, 150, 105, 0.1)',
  white: '#ffffff',
  gray: '#6b7280',
  lightGray: '#E8E8E8',
  dark: '#171717',
};

const ORG_UNIT_TYPE_LABEL: Record<string, string> = {
  CONSELHO_GERAL: 'Conselho Geral',
  SETOR: 'Setor',
  MINISTERIO: 'Ministério',
  GRUPO: 'Grupo',
};

const ORG_UNIT_TYPE_ICON: Record<string, string> = {
  CONSELHO_GERAL: 'shield',
  SETOR: 'git-branch',
  MINISTERIO: 'people',
  GRUPO: 'person-circle',
};

interface CoordOption {
  id: string;
  title: string;
  description: string;
  icon: string;
  onPress: () => void;
}

export default function CoordinatorScreen() {
  const [units, setUnits] = useState<Membership[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const memberships = await orgService.getMyMemberships();
        const coordUnits = memberships.filter(
          (m) => m.role === 'COORDINATOR' && m.status === 'ACTIVE'
        );
        setUnits(coordUnits);
      } catch {
        // Silencioso
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={colors.coord} />
      </View>
    );
  }

  if (units.length === 0) {
    return (
      <>
        <Stack.Screen options={{ title: 'Minha Coordenação' }} />
        <View style={styles.centered}>
          <Ionicons name="ribbon-outline" size={48} color={colors.coord} />
          <Text style={styles.emptyTitle}>Nenhuma coordenação</Text>
          <Text style={styles.emptyDescription}>
            Você ainda não é coordenador de nenhuma unidade.
          </Text>
        </View>
      </>
    );
  }

  return (
    <>
      <Stack.Screen options={{ title: 'Minha Coordenação' }} />

      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerIconContainer}>
            <Ionicons name="ribbon" size={32} color={colors.white} />
          </View>
          <Text style={styles.headerTitle}>Área do Coordenador</Text>
          <Text style={styles.headerSubtitle}>
            {units.length === 1
              ? 'Gerencie sua unidade e seus membros'
              : `Você coordena ${units.length} unidades`}
          </Text>
        </View>

        {/* Units */}
        {units.map((unit) => {
          const typeLabel = ORG_UNIT_TYPE_LABEL[unit.org_unit_type] ?? unit.org_unit_type;
          const typeIcon = (ORG_UNIT_TYPE_ICON[unit.org_unit_type] ?? 'people') as any;

          const options: CoordOption[] = [
            {
              id: 'members',
              title: 'Membros',
              description: 'Veja, convide e gerencie os membros',
              icon: 'people-outline',
              onPress: () =>
                router.push({
                  pathname: '/members',
                  params: {
                    org_unit_id: unit.org_unit_id,
                    org_unit_name: unit.org_unit_name,
                  },
                }),
            },
          ];

          return (
            <View key={unit.org_unit_id} style={styles.unitSection}>
              {units.length > 1 && (
                <View style={styles.unitHeader}>
                  <Ionicons name={typeIcon} size={16} color={colors.coord} />
                  <Text style={styles.unitHeaderText}>
                    {unit.org_unit_name}
                  </Text>
                  <View style={styles.unitTypeBadge}>
                    <Text style={styles.unitTypeBadgeText}>{typeLabel}</Text>
                  </View>
                </View>
              )}

              {units.length === 1 && (
                <View style={styles.singleUnitInfo}>
                  <Ionicons name={typeIcon} size={20} color={colors.coord} />
                  <Text style={styles.singleUnitName}>{unit.org_unit_name}</Text>
                  <Text style={styles.singleUnitType}>{typeLabel}</Text>
                </View>
              )}

              {options.map((opt) => (
                <TouchableOpacity
                  key={opt.id}
                  style={styles.optionCard}
                  onPress={opt.onPress}
                  activeOpacity={0.7}
                >
                  <View style={styles.optionIconContainer}>
                    <Ionicons name={opt.icon as any} size={24} color={colors.coord} />
                  </View>
                  <View style={styles.optionContent}>
                    <Text style={styles.optionTitle}>{opt.title}</Text>
                    <Text style={styles.optionDescription}>{opt.description}</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={20} color={colors.gray} />
                </TouchableOpacity>
              ))}
            </View>
          );
        })}

        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
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
  centered: {
    flex: 1,
    backgroundColor: colors.lightGray,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    gap: 12,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: colors.dark,
  },
  emptyDescription: {
    fontSize: 14,
    color: colors.gray,
    textAlign: 'center',
  },
  header: {
    backgroundColor: colors.coord,
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
    color: 'rgba(255,255,255,0.85)',
    textAlign: 'center',
  },
  unitSection: {
    marginBottom: 24,
  },
  unitHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  unitHeaderText: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    color: colors.dark,
  },
  unitTypeBadge: {
    backgroundColor: colors.coordLight,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  unitTypeBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.coord,
  },
  singleUnitInfo: {
    alignItems: 'center',
    marginBottom: 16,
    gap: 4,
  },
  singleUnitName: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.dark,
    textAlign: 'center',
  },
  singleUnitType: {
    fontSize: 13,
    color: colors.gray,
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
    backgroundColor: colors.coordLight,
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
    color: colors.dark,
    marginBottom: 2,
  },
  optionDescription: {
    fontSize: 13,
    color: colors.gray,
  },
  backButton: {
    marginTop: 8,
    padding: 16,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: colors.coord,
    alignItems: 'center',
  },
  backButtonText: {
    color: colors.coord,
    fontSize: 16,
    fontWeight: '600',
  },
});
