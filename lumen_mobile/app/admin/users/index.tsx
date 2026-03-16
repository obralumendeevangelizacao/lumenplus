/**
 * Admin — Gestão de Usuários
 * ==========================
 * Lista todos os usuários cadastrados com busca por nome/e-mail.
 * Mostra nome, e-mail, status do perfil e papéis globais.
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  RefreshControl,
  Modal,
  ScrollView,
  Alert,
} from 'react-native';
import { Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { adminUserService, AdminUserItem } from '@/services';
import api from '@/services/api';

const colors = {
  admin: '#7c3aed',
  adminLight: '#ede9fe',
  white: '#ffffff',
  gray: '#6b7280',
  lightGray: '#E8E8E8',
  danger: '#dc2626',
  success: '#16a34a',
  warning: '#d97706',
  text: '#171717',
};

const ROLE_LABELS: Record<string, { label: string; color: string }> = {
  DEV:       { label: 'Dev',       color: '#1d4ed8' },
  ADMIN:     { label: 'Admin',     color: '#7c3aed' },
  SECRETARY: { label: 'Secretário', color: '#0891b2' },
};

const STATUS_COLORS: Record<string, string> = {
  COMPLETE:   colors.success,
  INCOMPLETE: colors.warning,
};

export default function UsersAdminScreen() {
  const [users, setUsers] = useState<AdminUserItem[]>([]);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [editUser, setEditUser] = useState<AdminUserItem | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const LIMIT = 40;
  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchUsers = useCallback(async (q: string, offset: number, append: boolean = false) => {
    try {
      setError(null);
      const data = await adminUserService.listUsers({ search: q, limit: LIMIT, offset });
      if (append) {
        setUsers((prev) => [...prev, ...data.users]);
      } else {
        setUsers(data.users);
      }
      setTotal(data.total);
    } catch (e: any) {
      const msg = e?.response?.data?.detail?.message ?? 'Erro ao carregar usuários';
      setError(msg);
    }
  }, []);

  // Carga inicial + permissões
  useEffect(() => {
    setLoading(true);
    Promise.all([
      fetchUsers('', 0),
      api.get<{ has_admin_access: boolean }>('/inbox/permissions')
        .then((p) => setIsAdmin(p.has_admin_access || false))
        .catch(() => {}),
    ]).finally(() => setLoading(false));
  }, [fetchUsers]);

  // Busca com debounce
  const handleSearch = (text: string) => {
    setSearch(text);
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    searchTimeout.current = setTimeout(async () => {
      setLoading(true);
      await fetchUsers(text, 0);
      setLoading(false);
    }, 400);
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchUsers(search, 0);
    setRefreshing(false);
  }, [fetchUsers, search]);

  const onLoadMore = useCallback(async () => {
    if (loadingMore || users.length >= total) return;
    setLoadingMore(true);
    await fetchUsers(search, users.length, true);
    setLoadingMore(false);
  }, [loadingMore, users.length, total, fetchUsers, search]);

  // ──────────────────────────────────────────────────────────────────────────
  const renderUser = ({ item }: { item: AdminUserItem }) => {
    const initial = (item.name ?? item.email ?? '?')[0].toUpperCase();
    const statusColor = STATUS_COLORS[item.profile_status] ?? colors.gray;

    return (
      <View style={styles.userCard}>
        <View style={styles.avatarBox}>
          <Text style={styles.avatarText}>{initial}</Text>
        </View>

        <View style={styles.userInfo}>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 2 }}>
            <Text style={[styles.userName, { flex: 1 }]} numberOfLines={1}>
              {item.name ?? <Text style={{ color: colors.gray, fontStyle: 'italic' }}>Sem nome</Text>}
            </Text>
            {isAdmin && (
              <TouchableOpacity onPress={() => setEditUser(item)} style={styles.editBtn}>
                <Ionicons name="pencil-outline" size={16} color={colors.admin} />
              </TouchableOpacity>
            )}
          </View>
          <Text style={styles.userEmail} numberOfLines={1}>{item.email ?? '—'}</Text>

          <View style={styles.badgeRow}>
            {/* Status do perfil */}
            <View style={[styles.badge, { borderColor: statusColor }]}>
              <View style={[styles.badgeDot, { backgroundColor: statusColor }]} />
              <Text style={[styles.badgeText, { color: statusColor }]}>
                {item.profile_status === 'COMPLETE' ? 'Completo' : 'Incompleto'}
              </Text>
            </View>

            {/* Papéis globais */}
            {item.global_roles.map((role) => {
              const info = ROLE_LABELS[role];
              if (!info) return null;
              return (
                <View key={role} style={[styles.rolePill, { backgroundColor: info.color + '18', borderColor: info.color }]}>
                  <Text style={[styles.rolePillText, { color: info.color }]}>{info.label}</Text>
                </View>
              );
            })}
          </View>
        </View>
      </View>
    );
  };

  const renderFooter = () => {
    if (!loadingMore) return null;
    return (
      <View style={{ padding: 16, alignItems: 'center' }}>
        <ActivityIndicator size="small" color={colors.admin} />
      </View>
    );
  };

  return (
    <>
      <Stack.Screen options={{ title: 'Usuários' }} />

      <View style={styles.container}>
        {/* Barra de busca */}
        <View style={styles.searchBar}>
          <Ionicons name="search-outline" size={18} color={colors.gray} style={{ marginRight: 8 }} />
          <TextInput
            style={styles.searchInput}
            value={search}
            onChangeText={handleSearch}
            placeholder="Buscar por nome ou e-mail..."
            placeholderTextColor={colors.gray}
            returnKeyType="search"
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => handleSearch('')}>
              <Ionicons name="close-circle" size={18} color={colors.gray} />
            </TouchableOpacity>
          )}
        </View>

        {/* Total */}
        {!loading && (
          <Text style={styles.totalText}>
            {total} usuário{total !== 1 ? 's' : ''} {search ? 'encontrado' + (total !== 1 ? 's' : '') : 'cadastrado' + (total !== 1 ? 's' : '')}
          </Text>
        )}

        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color={colors.admin} />
          </View>
        ) : error ? (
          <View style={styles.errorCard}>
            <Ionicons name="alert-circle-outline" size={32} color={colors.danger} />
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity
              style={styles.retryBtn}
              onPress={() => { setLoading(true); fetchUsers(search, 0).finally(() => setLoading(false)); }}
            >
              <Text style={styles.retryBtnText}>Tentar novamente</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <FlatList
            data={users}
            keyExtractor={(item) => item.id}
            renderItem={renderUser}
            contentContainerStyle={styles.listContent}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
            onEndReached={onLoadMore}
            onEndReachedThreshold={0.3}
            ListFooterComponent={renderFooter}
            ListEmptyComponent={
              <View style={styles.emptyBox}>
                <Ionicons name="people-outline" size={40} color={colors.gray} />
                <Text style={styles.emptyText}>
                  {search ? 'Nenhum usuário encontrado' : 'Nenhum usuário cadastrado'}
                </Text>
              </View>
            }
          />
        )}
      </View>

      {/* Modal de edição de usuário */}
      <EditUserModal
        user={editUser}
        onClose={() => setEditUser(null)}
        onSuccess={(updated) => {
          setUsers((prev) => prev.map((u) => (u.id === updated.id ? updated : u)));
          setEditUser(null);
        }}
      />
    </>
  );
}

// =============================================================================
// EditUserModal
// =============================================================================
const GLOBAL_ROLES = [
  { code: 'DEV',       label: 'Dev',        color: '#1d4ed8' },
  { code: 'ADMIN',     label: 'Admin',      color: '#7c3aed' },
  { code: 'SECRETARY', label: 'Secretário', color: '#0891b2' },
];

function EditUserModal({
  user,
  onClose,
  onSuccess,
}: {
  user: AdminUserItem | null;
  onClose: () => void;
  onSuccess: (updated: AdminUserItem) => void;
}) {
  const [fullName, setFullName] = useState('');
  const [selectedRoles, setSelectedRoles] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      setFullName(user.name ?? '');
      setSelectedRoles([...user.global_roles]);
      setError(null);
    }
  }, [user]);

  const toggleRole = (code: string) => {
    setSelectedRoles((prev) =>
      prev.includes(code) ? prev.filter((r) => r !== code) : [...prev, code]
    );
  };

  const handleSave = async () => {
    if (!user) return;
    setLoading(true);
    setError(null);
    try {
      const updated = await adminUserService.updateUser(user.id, {
        full_name: fullName.trim() || undefined,
        global_roles: selectedRoles,
      });
      onSuccess(updated);
    } catch (e: any) {
      const msg = e?.response?.data?.detail?.message ?? 'Erro ao salvar';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal visible={!!user} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={modalStyles.container}>
        <View style={modalStyles.header}>
          <Text style={modalStyles.title}>Editar Usuário</Text>
          <TouchableOpacity onPress={onClose}>
            <Ionicons name="close" size={24} color={colors.text} />
          </TouchableOpacity>
        </View>

        <ScrollView style={modalStyles.body}>
          {/* Avatar + email (read-only) */}
          {user && (
            <View style={modalStyles.userRow}>
              <View style={modalStyles.avatar}>
                <Text style={modalStyles.avatarText}>
                  {(user.name ?? user.email ?? '?')[0].toUpperCase()}
                </Text>
              </View>
              <Text style={modalStyles.email} numberOfLines={1}>{user.email ?? '—'}</Text>
            </View>
          )}

          <Text style={modalStyles.label}>Nome completo</Text>
          <TextInput
            style={modalStyles.input}
            value={fullName}
            onChangeText={(t) => { setFullName(t); setError(null); }}
            placeholder="Nome completo do usuário"
            placeholderTextColor={colors.gray}
            maxLength={120}
          />

          <Text style={modalStyles.label}>Cargos globais</Text>
          <View style={modalStyles.rolesRow}>
            {GLOBAL_ROLES.map((r) => {
              const active = selectedRoles.includes(r.code);
              return (
                <TouchableOpacity
                  key={r.code}
                  style={[
                    modalStyles.roleChip,
                    active
                      ? { backgroundColor: r.color, borderColor: r.color }
                      : { borderColor: r.color },
                  ]}
                  onPress={() => toggleRole(r.code)}
                >
                  <Text style={[modalStyles.roleChipText, active && { color: colors.white }]}>
                    {r.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
          <Text style={modalStyles.hint}>Toque para ativar/desativar</Text>

          {error && <Text style={modalStyles.errorText}>{error}</Text>}
        </ScrollView>

        <View style={modalStyles.footer}>
          <TouchableOpacity style={modalStyles.cancelBtn} onPress={onClose} disabled={loading}>
            <Text style={modalStyles.cancelBtnText}>Cancelar</Text>
          </TouchableOpacity>
          <TouchableOpacity style={modalStyles.saveBtn} onPress={handleSave} disabled={loading}>
            {loading ? (
              <ActivityIndicator size="small" color={colors.white} />
            ) : (
              <Text style={modalStyles.saveBtnText}>Salvar</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const modalStyles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.white },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    padding: 16, borderBottomWidth: 1, borderBottomColor: colors.lightGray,
  },
  title: { fontSize: 16, fontWeight: '700', color: colors.text },
  body: { flex: 1, padding: 16 },
  footer: {
    flexDirection: 'row', gap: 12, padding: 16,
    borderTopWidth: 1, borderTopColor: colors.lightGray,
  },
  userRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16 },
  avatar: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: colors.admin, alignItems: 'center', justifyContent: 'center',
  },
  avatarText: { color: colors.white, fontWeight: '700', fontSize: 18 },
  email: { fontSize: 13, color: colors.gray, flex: 1 },
  label: { fontSize: 13, fontWeight: '600', color: colors.text, marginTop: 16, marginBottom: 6 },
  input: {
    borderWidth: 1, borderColor: colors.lightGray, borderRadius: 10,
    padding: 12, fontSize: 15, color: colors.text, backgroundColor: '#fafafa',
  },
  rolesRow: { flexDirection: 'row', gap: 10, flexWrap: 'wrap' },
  roleChip: {
    borderWidth: 2, borderRadius: 20,
    paddingHorizontal: 16, paddingVertical: 8,
  },
  roleChipText: { fontSize: 13, fontWeight: '700', color: colors.text },
  hint: { fontSize: 11, color: colors.gray, marginTop: 6 },
  errorText: { color: colors.danger, fontSize: 13, marginTop: 12 },
  cancelBtn: {
    flex: 1, borderWidth: 2, borderColor: colors.admin,
    borderRadius: 10, paddingVertical: 14, alignItems: 'center',
  },
  cancelBtnText: { color: colors.admin, fontWeight: '700', fontSize: 15 },
  saveBtn: {
    flex: 1, backgroundColor: colors.admin,
    borderRadius: 10, paddingVertical: 14, alignItems: 'center',
  },
  saveBtnText: { color: colors.white, fontWeight: '700', fontSize: 15 },
});

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.lightGray },

  searchBar: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: colors.white, margin: 12,
    borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10,
    shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 4, elevation: 2,
  },
  searchInput: { flex: 1, fontSize: 15, color: colors.text },

  totalText: { paddingHorizontal: 16, paddingBottom: 4, fontSize: 12, color: colors.gray },

  listContent: { paddingHorizontal: 12, paddingBottom: 32 },

  userCard: {
    flexDirection: 'row', alignItems: 'flex-start',
    backgroundColor: colors.white, borderRadius: 12,
    padding: 14, marginBottom: 8, gap: 12,
  },
  avatarBox: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: colors.admin,
    alignItems: 'center', justifyContent: 'center',
    flexShrink: 0,
  },
  avatarText: { color: colors.white, fontWeight: '700', fontSize: 18 },

  userInfo: { flex: 1, minWidth: 0 },
  userName: { fontSize: 15, fontWeight: '600', color: colors.text, marginBottom: 2 },
  userEmail: { fontSize: 13, color: colors.gray, marginBottom: 6 },

  badgeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  badge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    borderWidth: 1, borderRadius: 20,
    paddingHorizontal: 8, paddingVertical: 3,
  },
  badgeDot: { width: 6, height: 6, borderRadius: 3 },
  badgeText: { fontSize: 11, fontWeight: '600' },

  rolePill: {
    borderWidth: 1, borderRadius: 20,
    paddingHorizontal: 8, paddingVertical: 3,
  },
  rolePillText: { fontSize: 11, fontWeight: '700' },

  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  errorCard: {
    margin: 16, backgroundColor: colors.white, borderRadius: 12,
    padding: 24, alignItems: 'center', gap: 12,
  },
  errorText: { color: colors.danger, fontSize: 14, textAlign: 'center' },
  retryBtn: { backgroundColor: colors.admin, borderRadius: 8, paddingHorizontal: 20, paddingVertical: 10 },
  retryBtnText: { color: colors.white, fontWeight: '600' },

  emptyBox: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 60, gap: 12 },
  emptyText: { color: colors.gray, fontSize: 15 },
  editBtn: { padding: 4, marginLeft: 4 },
});
