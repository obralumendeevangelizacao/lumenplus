/**
 * Invites Screen (Convites)
 * =========================
 * Lista convites pendentes para ministérios/grupos.
 * O usuário pode aceitar ou recusar cada convite.
 */

import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { inviteService } from '@/services';
import { Invite } from '@/types';

const colors = {
  primary: '#1A859B',
  primaryLight: 'rgba(26, 133, 155, 0.1)',
  success: '#16a34a',
  successLight: 'rgba(22, 163, 74, 0.1)',
  danger: '#dc2626',
  dangerLight: 'rgba(220, 38, 38, 0.1)',
  gray: '#6b7280',
  lightGray: '#E8E8E8',
  white: '#ffffff',
  dark: '#171717',
};

const ORG_UNIT_TYPE_LABEL: Record<string, string> = {
  CONSELHO_GERAL: 'Conselho Geral',
  SETOR: 'Setor',
  MINISTERIO: 'Ministério',
  GRUPO: 'Grupo',
};

const ROLE_LABEL: Record<string, string> = {
  COORDINATOR: 'Coordenador',
  MEMBER: 'Membro',
};

export default function InvitesScreen() {
  const [invites, setInvites] = useState<Invite[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const fetchInvites = useCallback(async () => {
    setLoading(true);
    try {
      const data = await inviteService.getMyInvites();
      setInvites(data.filter((i) => i.status === 'PENDING'));
    } catch {
      // Silencioso — lista vazia já comunica o estado
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchInvites();
    }, [fetchInvites])
  );

  const handleAccept = async (invite: Invite) => {
    setActionLoading(invite.id);
    try {
      await inviteService.accept(invite.id);
      setInvites((prev) => prev.filter((i) => i.id !== invite.id));
    } catch {
      Alert.alert('Erro', 'Não foi possível aceitar o convite. Tente novamente.');
    } finally {
      setActionLoading(null);
    }
  };

  const handleReject = (invite: Invite) => {
    Alert.alert(
      'Recusar convite',
      `Tem certeza que deseja recusar o convite para ${invite.org_unit_name}?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Recusar',
          style: 'destructive',
          onPress: async () => {
            setActionLoading(invite.id);
            try {
              await inviteService.reject(invite.id);
              setInvites((prev) => prev.filter((i) => i.id !== invite.id));
            } catch {
              Alert.alert('Erro', 'Não foi possível recusar o convite. Tente novamente.');
            } finally {
              setActionLoading(null);
            }
          },
        },
      ]
    );
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (invites.length === 0) {
    return (
      <View style={styles.centered}>
        <View style={styles.emptyIconContainer}>
          <Ionicons name="mail-open-outline" size={48} color={colors.primary} />
        </View>
        <Text style={styles.emptyTitle}>Nenhum convite pendente</Text>
        <Text style={styles.emptyDescription}>
          Quando alguém te convidar para um ministério ou grupo, ele aparecerá aqui.
        </Text>
      </View>
    );
  }

  return (
    <FlatList
      data={invites}
      keyExtractor={(item) => item.id}
      contentContainerStyle={styles.list}
      style={styles.container}
      renderItem={({ item }) => {
        const isActing = actionLoading === item.id;
        const unitTypeLabel = ORG_UNIT_TYPE_LABEL[item.org_unit_type] ?? item.org_unit_type;
        const roleLabel = ROLE_LABEL[item.role] ?? item.role;

        return (
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <View style={styles.iconBadge}>
                <Ionicons name="people" size={20} color={colors.primary} />
              </View>
              <View style={styles.cardHeaderText}>
                <Text style={styles.orgName}>{item.org_unit_name}</Text>
                <Text style={styles.orgMeta}>
                  {unitTypeLabel} · {roleLabel}
                </Text>
              </View>
            </View>

            <Text style={styles.invitedBy}>
              Convidado por <Text style={styles.invitedByName}>{item.invited_by_name}</Text>
            </Text>

            {item.message ? (
              <Text style={styles.message}>"{item.message}"</Text>
            ) : null}

            <View style={styles.actions}>
              <TouchableOpacity
                style={[styles.btn, styles.btnReject]}
                onPress={() => handleReject(item)}
                disabled={isActing}
              >
                <Text style={styles.btnRejectText}>Recusar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.btn, styles.btnAccept]}
                onPress={() => handleAccept(item)}
                disabled={isActing}
              >
                {isActing ? (
                  <ActivityIndicator size="small" color={colors.white} />
                ) : (
                  <Text style={styles.btnAcceptText}>Aceitar</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        );
      }}
    />
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.lightGray,
  },
  list: {
    padding: 16,
    gap: 12,
  },
  centered: {
    flex: 1,
    backgroundColor: colors.lightGray,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  emptyIconContainer: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: colors.dark,
    marginBottom: 8,
  },
  emptyDescription: {
    fontSize: 14,
    color: colors.gray,
    textAlign: 'center',
    lineHeight: 20,
  },
  card: {
    backgroundColor: colors.white,
    borderRadius: 12,
    padding: 16,
    gap: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  iconBadge: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardHeaderText: {
    flex: 1,
  },
  orgName: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.dark,
  },
  orgMeta: {
    fontSize: 13,
    color: colors.gray,
    marginTop: 2,
  },
  invitedBy: {
    fontSize: 13,
    color: colors.gray,
  },
  invitedByName: {
    fontWeight: '600',
    color: colors.dark,
  },
  message: {
    fontSize: 13,
    color: colors.gray,
    fontStyle: 'italic',
    lineHeight: 18,
  },
  actions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 4,
  },
  btn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnReject: {
    backgroundColor: colors.dangerLight,
  },
  btnRejectText: {
    color: colors.danger,
    fontWeight: '600',
    fontSize: 14,
  },
  btnAccept: {
    backgroundColor: colors.primary,
  },
  btnAcceptText: {
    color: colors.white,
    fontWeight: '600',
    fontSize: 14,
  },
});
