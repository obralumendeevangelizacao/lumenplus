/**
 * Admin — Retreat Detail & Management
 * ====================================
 * Visualiza e gerencia um retiro: publicar, fechar, cancelar.
 * Lista inscrições com aprovação/rejeição de pagamentos.
 */

import { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, RefreshControl, Modal, FlatList, Linking,
} from 'react-native';
import { router, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import api from '@/services/api';

const colors = {
  primary: '#7c3aed',
  white: '#ffffff',
  gray: '#6b7280',
  lightGray: '#f3f4f6',
  green: '#059669',
  red: '#dc2626',
};

const STATUS_META: Record<string, { label: string; color: string }> = {
  DRAFT:     { label: 'Rascunho',  color: '#6b7280' },
  PUBLISHED: { label: 'Publicado', color: '#059669' },
  CLOSED:    { label: 'Encerrado', color: '#2563eb' },
  CANCELLED: { label: 'Cancelado', color: '#dc2626' },
};

const REG_STATUS_META: Record<string, { label: string; color: string }> = {
  PENDING_PAYMENT:   { label: 'Aguardando pgto',    color: '#d97706' },
  PAYMENT_SUBMITTED: { label: 'Comprovante enviado', color: '#2563eb' },
  CONFIRMED:         { label: 'Confirmado',           color: '#059669' },
  CANCELLED:         { label: 'Cancelado',            color: '#6b7280' },
  WAITLIST:          { label: 'Espera',               color: '#7c3aed' },
};

interface Registration {
  id: string;
  user_id: string;
  user_name: string | null;
  status: string;
  notes: string | null;
  payment_proof_url: string | null;
  payment_submitted_at: string | null;
  payment_confirmed_at: string | null;
  payment_rejection_reason: string | null;
  created_at: string;
}

interface RetreatDetail {
  id: string;
  title: string;
  description: string | null;
  retreat_type: string;
  status: string;
  start_date: string;
  end_date: string;
  location: string | null;
  address: string | null;
  max_participants: number | null;
  price_brl: string | null;
  visibility_type: string;
  registrations_count: number;
}

const TYPE_LABEL: Record<string, string> = {
  WEEKEND: 'Fim de semana',
  DAY: 'Dia único',
  FORMATION: 'Formação',
};

export default function AdminRetreatDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [retreat, setRetreat]     = useState<RetreatDetail | null>(null);
  const [regs, setRegs]           = useState<Registration[]>([]);
  const [loading, setLoading]     = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError]         = useState<string | null>(null);
  const [actionMsg, setActionMsg] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);

  const [confirmModal, setConfirmModal] = useState<{
    title: string; body: string; action: () => Promise<void>;
  } | null>(null);

  const [rejectModal, setRejectModal] = useState<{ regId: string } | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  const fetchData = async () => {
    try {
      const [retreatRes, regsRes] = await Promise.all([
        api.get<RetreatDetail>(`/admin/retreats/${id}`),
        api.get<{ registrations: Registration[] }>(`/admin/retreats/${id}/registrations`),
      ]);
      setRetreat(retreatRes);
      setRegs(regsRes.registrations || []);
      setError(null);
    } catch (err: any) {
      setError(err?.response?.data?.detail?.message || 'Erro ao carregar retiro');
    }
  };

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      fetchData().finally(() => setLoading(false));
    }, [id])
  );

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchData();
    setRefreshing(false);
  };

  const doAction = async (endpoint: string, msg: string) => {
    setProcessing(true);
    setConfirmModal(null);
    try {
      await api.post(endpoint, {});
      setActionMsg(msg);
      await fetchData();
    } catch (err: any) {
      setActionMsg(err?.response?.data?.detail?.message || 'Erro ao executar ação');
    } finally {
      setProcessing(false);
    }
  };

  const handleConfirmPayment = async (regId: string) => {
    setProcessing(true);
    try {
      await api.post(`/admin/retreats/${id}/registrations/${regId}/confirm`, {});
      setActionMsg('Pagamento confirmado');
      await fetchData();
    } catch (err: any) {
      setActionMsg(err?.response?.data?.detail?.message || 'Erro ao confirmar');
    } finally {
      setProcessing(false);
    }
  };

  const handleRejectPayment = async () => {
    if (!rejectModal) return;
    setProcessing(true);
    setRejectModal(null);
    try {
      await api.post(`/admin/retreats/${id}/registrations/${rejectModal.regId}/reject`, {
        reason: rejectReason || null,
      });
      setActionMsg('Comprovante rejeitado');
      setRejectReason('');
      await fetchData();
    } catch (err: any) {
      setActionMsg(err?.response?.data?.detail?.message || 'Erro ao rejeitar');
    } finally {
      setProcessing(false);
    }
  };

  if (loading) {
    return <View style={styles.center}><ActivityIndicator size="large" color={colors.primary} /></View>;
  }

  if (error || !retreat) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>{error || 'Retiro não encontrado'}</Text>
        <TouchableOpacity onPress={() => router.back()} style={styles.btn}>
          <Text style={styles.btnText}>Voltar</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const statusMeta = STATUS_META[retreat.status] ?? { label: retreat.status, color: colors.gray };
  const formatDate = (iso: string) => new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} colors={[colors.primary]} />}
    >
      {/* Header */}
      <View style={styles.card}>
        <View style={styles.row}>
          <Text style={styles.typeLabel}>{TYPE_LABEL[retreat.retreat_type]}</Text>
          <View style={[styles.statusBadge, { backgroundColor: `${statusMeta.color}18` }]}>
            <Text style={[styles.statusText, { color: statusMeta.color }]}>{statusMeta.label}</Text>
          </View>
        </View>
        <Text style={styles.title}>{retreat.title}</Text>
        {retreat.description && <Text style={styles.desc}>{retreat.description}</Text>}
        <View style={styles.metaGrid}>
          <MetaRow icon="calendar-outline" text={`${formatDate(retreat.start_date)} → ${formatDate(retreat.end_date)}`} />
          {retreat.location && <MetaRow icon="location-outline" text={retreat.location} />}
          <MetaRow icon="cash-outline" text={retreat.price_brl ? `R$ ${retreat.price_brl}` : 'Gratuito'} />
          {retreat.max_participants && <MetaRow icon="people-outline" text={`${retreat.registrations_count}/${retreat.max_participants} vagas`} />}
          <MetaRow icon="eye-outline" text={retreat.visibility_type === 'ALL' ? 'Todos os membros' : 'Específico'} />
        </View>
      </View>

      {/* Action message */}
      {actionMsg && (
        <View style={styles.actionMsg}>
          <Text style={styles.actionMsgText}>{actionMsg}</Text>
          <TouchableOpacity onPress={() => setActionMsg(null)}>
            <Ionicons name="close" size={16} color={colors.gray} />
          </TouchableOpacity>
        </View>
      )}

      {/* Action buttons */}
      <View style={styles.actionsRow}>
        {retreat.status === 'DRAFT' && (
          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: colors.green }]}
            onPress={() => setConfirmModal({
              title: 'Publicar retiro?',
              body: 'Um aviso será enviado automaticamente para todos os membros elegíveis.',
              action: () => doAction(`/admin/retreats/${id}/publish`, 'Retiro publicado e avisos enviados!'),
            })}
            disabled={processing}
          >
            <Ionicons name="megaphone-outline" size={18} color={colors.white} />
            <Text style={styles.actionBtnText}>Publicar</Text>
          </TouchableOpacity>
        )}
        {retreat.status === 'PUBLISHED' && (
          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: '#2563eb' }]}
            onPress={() => setConfirmModal({
              title: 'Fechar inscrições?',
              body: 'Nenhum novo membro poderá se inscrever após fechar.',
              action: () => doAction(`/admin/retreats/${id}/close`, 'Inscrições encerradas'),
            })}
            disabled={processing}
          >
            <Ionicons name="lock-closed-outline" size={18} color={colors.white} />
            <Text style={styles.actionBtnText}>Fechar inscrições</Text>
          </TouchableOpacity>
        )}
        {['DRAFT', 'PUBLISHED'].includes(retreat.status) && (
          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: colors.red }]}
            onPress={() => setConfirmModal({
              title: 'Cancelar retiro?',
              body: 'Esta ação não pode ser desfeita.',
              action: () => doAction(`/admin/retreats/${id}/cancel`, 'Retiro cancelado'),
            })}
            disabled={processing}
          >
            <Ionicons name="close-circle-outline" size={18} color={colors.white} />
            <Text style={styles.actionBtnText}>Cancelar</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity
          style={[styles.actionBtn, { backgroundColor: colors.gray }]}
          onPress={() => {
            // Export CSV
            const url = `${api.baseUrl}/admin/retreats/${id}/export`;
            Linking.openURL(url);
          }}
        >
          <Ionicons name="download-outline" size={18} color={colors.white} />
          <Text style={styles.actionBtnText}>Exportar CSV</Text>
        </TouchableOpacity>
      </View>

      {/* Registrations */}
      <Text style={styles.sectionTitle}>
        Inscrições ({regs.filter(r => r.status !== 'CANCELLED').length})
      </Text>

      {regs.length === 0 ? (
        <View style={styles.emptyBox}>
          <Text style={styles.emptyText}>Nenhuma inscrição ainda</Text>
        </View>
      ) : (
        regs.map(reg => {
          const regMeta = REG_STATUS_META[reg.status] ?? { label: reg.status, color: colors.gray };
          return (
            <View key={reg.id} style={styles.regCard}>
              <View style={styles.row}>
                <Text style={styles.regName}>{reg.user_name || 'Membro'}</Text>
                <View style={[styles.regBadge, { backgroundColor: `${regMeta.color}18` }]}>
                  <Text style={[styles.regBadgeText, { color: regMeta.color }]}>{regMeta.label}</Text>
                </View>
              </View>
              {reg.notes && <Text style={styles.regNotes}>📝 {reg.notes}</Text>}
              {reg.payment_rejection_reason && (
                <Text style={styles.rejectionText}>Rejeitado: {reg.payment_rejection_reason}</Text>
              )}
              <View style={styles.regActions}>
                {reg.payment_proof_url && (
                  <TouchableOpacity
                    style={styles.smallBtn}
                    onPress={() => Linking.openURL(reg.payment_proof_url!)}
                  >
                    <Ionicons name="image-outline" size={14} color={colors.primary} />
                    <Text style={styles.smallBtnText}>Ver comprovante</Text>
                  </TouchableOpacity>
                )}
                {reg.status === 'PAYMENT_SUBMITTED' && (
                  <>
                    <TouchableOpacity
                      style={[styles.smallBtn, { borderColor: colors.green }]}
                      onPress={() => handleConfirmPayment(reg.id)}
                      disabled={processing}
                    >
                      <Ionicons name="checkmark" size={14} color={colors.green} />
                      <Text style={[styles.smallBtnText, { color: colors.green }]}>Confirmar</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.smallBtn, { borderColor: colors.red }]}
                      onPress={() => setRejectModal({ regId: reg.id })}
                      disabled={processing}
                    >
                      <Ionicons name="close" size={14} color={colors.red} />
                      <Text style={[styles.smallBtnText, { color: colors.red }]}>Rejeitar</Text>
                    </TouchableOpacity>
                  </>
                )}
              </View>
            </View>
          );
        })
      )}

      {/* Confirm modal */}
      <Modal visible={!!confirmModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>{confirmModal?.title}</Text>
            <Text style={styles.modalBody}>{confirmModal?.body}</Text>
            <View style={styles.modalRow}>
              <TouchableOpacity style={styles.outlineBtn} onPress={() => setConfirmModal(null)}>
                <Text style={styles.outlineBtnText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.confirmBtn}
                onPress={() => confirmModal?.action()}
                disabled={processing}
              >
                {processing
                  ? <ActivityIndicator color={colors.white} size="small" />
                  : <Text style={styles.confirmBtnText}>Confirmar</Text>
                }
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Reject modal */}
      <Modal visible={!!rejectModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>Rejeitar comprovante?</Text>
            <Text style={styles.modalBody}>Informe o motivo para o membro reenviar.</Text>
            <View style={styles.textAreaBox}>
              <Text style={{ color: rejectReason ? '#111827' : '#9ca3af' }}>
                {rejectReason || 'Motivo (opcional)...'}
              </Text>
            </View>
            <View style={styles.modalRow}>
              <TouchableOpacity style={styles.outlineBtn} onPress={() => { setRejectModal(null); setRejectReason(''); }}>
                <Text style={styles.outlineBtnText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.confirmBtn, { backgroundColor: colors.red }]}
                onPress={handleRejectPayment}
                disabled={processing}
              >
                <Text style={styles.confirmBtnText}>Rejeitar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

function MetaRow({ icon, text }: { icon: string; text: string }) {
  return (
    <View style={styles.metaRow}>
      <Ionicons name={icon as any} size={14} color={colors.gray} />
      <Text style={styles.metaText}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.lightGray },
  content: { padding: 14, paddingBottom: 40, gap: 14 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 12 },
  card: {
    backgroundColor: colors.white, borderRadius: 16, padding: 16, gap: 8,
    shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 4, elevation: 1,
  },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  typeLabel: { fontSize: 11, color: colors.gray, textTransform: 'uppercase', fontWeight: '600' },
  statusBadge: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  statusText: { fontSize: 11, fontWeight: '700' },
  title: { fontSize: 20, fontWeight: '800', color: '#111827' },
  desc: { fontSize: 13, color: colors.gray, lineHeight: 18 },
  metaGrid: { gap: 5, marginTop: 4 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  metaText: { fontSize: 13, color: colors.gray },
  actionMsg: {
    backgroundColor: '#f0fdf4', borderRadius: 10, padding: 12,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  actionMsgText: { fontSize: 13, color: '#166534', flex: 1 },
  actionsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  actionBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10,
  },
  actionBtnText: { color: colors.white, fontWeight: '700', fontSize: 13 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#111827', marginTop: 4 },
  emptyBox: { backgroundColor: colors.white, borderRadius: 12, padding: 20, alignItems: 'center' },
  emptyText: { color: colors.gray, fontSize: 14 },
  regCard: {
    backgroundColor: colors.white, borderRadius: 14, padding: 14, gap: 6,
    shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 3, elevation: 1,
  },
  regName: { fontSize: 15, fontWeight: '700', color: '#111827' },
  regBadge: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  regBadgeText: { fontSize: 11, fontWeight: '700' },
  regNotes: { fontSize: 12, color: colors.gray },
  rejectionText: { fontSize: 12, color: colors.red },
  regActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
  smallBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    borderWidth: 1, borderColor: colors.primary, borderRadius: 8,
    paddingHorizontal: 10, paddingVertical: 5,
  },
  smallBtnText: { fontSize: 12, fontWeight: '600', color: colors.primary },
  errorText: { color: colors.red, textAlign: 'center' },
  btn: { backgroundColor: colors.primary, borderRadius: 8, paddingHorizontal: 24, paddingVertical: 10 },
  btnText: { color: colors.white, fontWeight: '600' },
  // Modal
  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center', justifyContent: 'center', padding: 24,
  },
  modalBox: { backgroundColor: colors.white, borderRadius: 20, padding: 24, width: '100%', gap: 12 },
  modalTitle: { fontSize: 17, fontWeight: '700', color: '#111827', textAlign: 'center' },
  modalBody: { fontSize: 13, color: colors.gray, textAlign: 'center' },
  textAreaBox: {
    borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 10, padding: 10, minHeight: 60,
  },
  modalRow: { flexDirection: 'row', gap: 10 },
  outlineBtn: {
    flex: 1, borderWidth: 1.5, borderColor: '#e5e7eb', borderRadius: 12,
    padding: 12, alignItems: 'center',
  },
  outlineBtnText: { fontSize: 14, fontWeight: '600', color: '#374151' },
  confirmBtn: {
    flex: 1, backgroundColor: colors.primary, borderRadius: 12,
    padding: 12, alignItems: 'center', justifyContent: 'center',
  },
  confirmBtnText: { fontSize: 14, fontWeight: '700', color: colors.white },
});
