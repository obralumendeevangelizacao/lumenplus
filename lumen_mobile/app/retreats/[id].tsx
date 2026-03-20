/**
 * Retreat Detail Screen
 * =====================
 * Exibe detalhes do retiro, modalidades disponíveis, taxa do usuário e permite inscrição/cancelamento.
 */

import { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, RefreshControl, Modal, TextInput,
} from 'react-native';
import { router, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import api from '@/services/api';

const colors = {
  primary: '#1A859B',
  white: '#ffffff',
  gray: '#6b7280',
  lightGray: '#f3f4f6',
  red: '#dc2626',
};

const TYPE_LABEL: Record<string, string> = {
  WEEKEND: 'Fim de semana',
  DAY: 'Dia único',
  FORMATION: 'Formação',
};

const MODALITY_LABEL: Record<string, string> = {
  PRESENCIAL: 'Presencial',
  HIBRIDO: 'Híbrido (dorme em casa)',
};

const REG_STATUS_META: Record<string, { label: string; color: string; icon: string; desc: string }> = {
  PENDING_PAYMENT: {
    label: 'Aguardando pagamento',
    color: '#d97706',
    icon: 'time-outline',
    desc: 'Realize o pagamento e envie o comprovante para confirmar sua vaga.',
  },
  PAYMENT_SUBMITTED: {
    label: 'Comprovante enviado',
    color: '#2563eb',
    icon: 'cloud-upload-outline',
    desc: 'Seu comprovante foi enviado. Aguarde a confirmação da equipe.',
  },
  CONFIRMED: {
    label: 'Inscrição confirmada!',
    color: '#059669',
    icon: 'checkmark-circle',
    desc: 'Sua vaga está garantida. Até o retiro!',
  },
  WAITLIST: {
    label: 'Lista de espera',
    color: '#7c3aed',
    icon: 'list-outline',
    desc: 'As vagas estão esgotadas. Você será notificado se uma vaga abrir.',
  },
  CANCELLED: { label: 'Cancelada', color: colors.gray, icon: 'close-circle-outline', desc: '' },
};

interface FeeInfo {
  fee_category: string;
  fee_label: string;
  amount_brl: string | null;
}

interface MyRegistration {
  id: string;
  status: string;
  modality_preference: string | null;
  fee_category: string | null;
  fee_label: string | null;
  notes: string | null;
  payment_proof_url: string | null;
  payment_submitted_at: string | null;
  payment_confirmed_at: string | null;
  payment_rejection_reason: string | null;
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
  available_modalities: string[];
  my_fee: FeeInfo | null;
  my_registration: MyRegistration | null;
}

export default function RetreatDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [retreat, setRetreat]       = useState<RetreatDetail | null>(null);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const [showRegModal, setShowRegModal]         = useState(false);
  const [notes, setNotes]                       = useState('');
  const [selectedModality, setSelectedModality] = useState<string | null>(null);
  const [submitting, setSubmitting]             = useState(false);
  const [actionMsg, setActionMsg]               = useState<string | null>(null);

  const [showCancelConfirm, setShowCancelConfirm] = useState(false);

  const fetchRetreat = async () => {
    try {
      const result = await api.get<RetreatDetail>(`/retreats/${id}`);
      setRetreat(result);
      setError(null);
    } catch (err: any) {
      setError(err?.response?.data?.detail?.message || err?.message || 'Erro ao carregar retiro');
    }
  };

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      fetchRetreat().finally(() => setLoading(false));
    }, [id])
  );

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchRetreat();
    setRefreshing(false);
  };

  const openRegModal = () => {
    const modalities = retreat?.available_modalities ?? [];
    setSelectedModality(modalities.length === 1 ? modalities[0] : null);
    setNotes('');
    setShowRegModal(true);
  };

  const handleRegister = async () => {
    if (!retreat) return;
    const modalities = retreat.available_modalities;
    if (modalities.length > 1 && !selectedModality) {
      setActionMsg('Selecione a modalidade de participação');
      return;
    }
    setSubmitting(true);
    try {
      const res = await api.post<{ message: string; fee_label?: string; amount_brl?: string }>(
        `/retreats/${id}/register`,
        {
          notes: notes || null,
          modality_preference: selectedModality ?? (modalities[0] || null),
        }
      );
      setActionMsg(res.message);
      setShowRegModal(false);
      await fetchRetreat();
    } catch (err: any) {
      setActionMsg(err?.response?.data?.detail?.message || 'Erro ao realizar inscrição');
      setShowRegModal(false);
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancel = async () => {
    setShowCancelConfirm(false);
    setSubmitting(true);
    try {
      const res = await api.delete<{ message: string }>(`/retreats/${id}/my-registration`);
      setActionMsg(res.message);
      await fetchRetreat();
    } catch (err: any) {
      setActionMsg(err?.response?.data?.detail?.message || 'Erro ao cancelar inscrição');
    } finally {
      setSubmitting(false);
    }
  };

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });

  if (loading) {
    return <View style={styles.center}><ActivityIndicator size="large" color={colors.primary} /></View>;
  }

  if (error || !retreat) {
    return (
      <View style={styles.center}>
        <Ionicons name="alert-circle-outline" size={48} color={colors.red} />
        <Text style={styles.errorText}>{error || 'Retiro não encontrado'}</Text>
        <TouchableOpacity style={styles.btn} onPress={() => router.back()}>
          <Text style={styles.btnText}>Voltar</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const reg = retreat.my_registration;
  const regMeta = reg ? REG_STATUS_META[reg.status] : null;
  const canRegister = !reg || reg.status === 'CANCELLED';
  const canSendPayment = reg?.status === 'PENDING_PAYMENT';
  const canCancel = reg && !['CONFIRMED', 'CANCELLED'].includes(reg.status);
  const isClosed = retreat.status === 'CLOSED';
  const hasMultipleModalities = retreat.available_modalities.length > 1;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} colors={[colors.primary]} />}
    >
      {/* Type + title */}
      <View style={styles.typeBadge}>
        <Text style={styles.typeText}>{TYPE_LABEL[retreat.retreat_type] ?? retreat.retreat_type}</Text>
      </View>
      <Text style={styles.title}>{retreat.title}</Text>
      {retreat.description && <Text style={styles.description}>{retreat.description}</Text>}

      {/* Info card */}
      <View style={styles.infoGrid}>
        <InfoRow icon="calendar-outline" label="Data" value={`${formatDate(retreat.start_date)} → ${formatDate(retreat.end_date)}`} />
        {retreat.location && <InfoRow icon="location-outline" label="Local" value={retreat.location} />}
        {retreat.address && <InfoRow icon="map-outline" label="Endereço" value={retreat.address} />}
        {retreat.max_participants != null && (
          <InfoRow icon="people-outline" label="Vagas" value={`${retreat.max_participants} vagas`} />
        )}

        {/* Modalidades disponíveis */}
        {retreat.available_modalities.length > 0 && (
          <View style={styles.infoRow}>
            <Ionicons name="home-outline" size={18} color={colors.primary} />
            <View style={{ flex: 1 }}>
              <Text style={styles.infoLabel}>Modalidades</Text>
              <View style={styles.modalityChips}>
                {retreat.available_modalities.map(m => (
                  <View key={m} style={styles.modalityChip}>
                    <Text style={styles.modalityChipText}>{MODALITY_LABEL[m] ?? m}</Text>
                  </View>
                ))}
              </View>
            </View>
          </View>
        )}

        {/* Minha taxa */}
        {retreat.my_fee && (
          <View style={styles.feeRow}>
            <Ionicons name="cash-outline" size={18} color={colors.primary} />
            <View>
              <Text style={styles.infoLabel}>Minha taxa</Text>
              <Text style={styles.infoValue}>{retreat.my_fee.fee_label}</Text>
              {retreat.my_fee.amount_brl && (
                <Text style={styles.feeAmount}>R$ {retreat.my_fee.amount_brl}</Text>
              )}
            </View>
          </View>
        )}

        {/* Taxa da minha inscrição (se já inscrito) */}
        {reg?.fee_label && reg.fee_label !== retreat.my_fee?.fee_label && (
          <View style={styles.infoRow}>
            <Ionicons name="pricetag-outline" size={18} color="#7c3aed" />
            <View>
              <Text style={styles.infoLabel}>Taxa atribuída</Text>
              <Text style={[styles.infoValue, { color: '#7c3aed' }]}>{reg.fee_label}</Text>
            </View>
          </View>
        )}

        {/* Modalidade da minha inscrição */}
        {reg?.modality_preference && (
          <View style={styles.infoRow}>
            <Ionicons name="checkbox-outline" size={18} color="#059669" />
            <View>
              <Text style={styles.infoLabel}>Minha modalidade</Text>
              <Text style={[styles.infoValue, { color: '#059669' }]}>
                {MODALITY_LABEL[reg.modality_preference] ?? reg.modality_preference}
              </Text>
            </View>
          </View>
        )}
      </View>

      {/* Registration status */}
      {regMeta && (
        <View style={[styles.regCard, { borderColor: `${regMeta.color}40`, backgroundColor: `${regMeta.color}0A` }]}>
          <Ionicons name={regMeta.icon as any} size={28} color={regMeta.color} />
          <View style={styles.regCardText}>
            <Text style={[styles.regLabel, { color: regMeta.color }]}>{regMeta.label}</Text>
            {regMeta.desc ? <Text style={styles.regDesc}>{regMeta.desc}</Text> : null}
            {reg?.payment_rejection_reason && (
              <Text style={styles.rejectionText}>
                Motivo da rejeição: {reg.payment_rejection_reason}
              </Text>
            )}
          </View>
        </View>
      )}

      {/* Action message */}
      {actionMsg && (
        <View style={styles.actionMsg}>
          <Text style={styles.actionMsgText}>{actionMsg}</Text>
          <TouchableOpacity onPress={() => setActionMsg(null)}>
            <Ionicons name="close" size={16} color={colors.gray} />
          </TouchableOpacity>
        </View>
      )}

      {/* CTA Buttons */}
      {!isClosed && canRegister && (
        <TouchableOpacity style={styles.primaryBtn} onPress={openRegModal} disabled={submitting}>
          <Ionicons name="person-add-outline" size={20} color={colors.white} />
          <Text style={styles.primaryBtnText}>Inscrever-se</Text>
        </TouchableOpacity>
      )}

      {canSendPayment && (
        <TouchableOpacity
          style={styles.primaryBtn}
          onPress={() => router.push(`/retreats/${retreat.id}/payment` as any)}
        >
          <Ionicons name="cloud-upload-outline" size={20} color={colors.white} />
          <Text style={styles.primaryBtnText}>Enviar comprovante</Text>
        </TouchableOpacity>
      )}

      {canCancel && (
        <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowCancelConfirm(true)} disabled={submitting}>
          <Text style={styles.cancelBtnText}>Cancelar inscrição</Text>
        </TouchableOpacity>
      )}

      {/* Register modal */}
      <Modal visible={showRegModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>Inscrição — {retreat.title}</Text>

            {/* Minha taxa */}
            {retreat.my_fee && (
              <View style={styles.feeSummary}>
                <Text style={styles.feeSummaryLabel}>{retreat.my_fee.fee_label}</Text>
                {retreat.my_fee.amount_brl
                  ? <Text style={styles.feeSummaryAmount}>R$ {retreat.my_fee.amount_brl}</Text>
                  : <Text style={styles.feeSummaryFree}>Gratuito</Text>
                }
                {retreat.my_fee.amount_brl && (
                  <Text style={styles.feeSummaryHint}>
                    Você enviará o comprovante após a inscrição.
                  </Text>
                )}
              </View>
            )}

            {/* Seleção de modalidade (se houver mais de uma) */}
            {hasMultipleModalities && (
              <View>
                <Text style={styles.fieldLabel}>Modalidade de participação *</Text>
                <View style={styles.modalitySelector}>
                  {retreat.available_modalities.map(m => (
                    <TouchableOpacity
                      key={m}
                      style={[
                        styles.modalityOption,
                        selectedModality === m && styles.modalityOptionSelected,
                      ]}
                      onPress={() => setSelectedModality(m)}
                    >
                      <Ionicons
                        name={m === 'PRESENCIAL' ? 'home' : 'moon-outline'}
                        size={18}
                        color={selectedModality === m ? colors.white : colors.primary}
                      />
                      <Text style={[
                        styles.modalityOptionText,
                        selectedModality === m && { color: colors.white },
                      ]}>
                        {MODALITY_LABEL[m] ?? m}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            )}

            <Text style={styles.fieldLabel}>Observações (opcional)</Text>
            <TextInput
              style={styles.textArea}
              value={notes}
              onChangeText={setNotes}
              placeholder="Alguma observação para a equipe..."
              placeholderTextColor="#9ca3af"
              multiline
              numberOfLines={3}
            />

            <View style={styles.row}>
              <TouchableOpacity style={styles.outlineBtn} onPress={() => setShowRegModal(false)}>
                <Text style={styles.outlineBtnText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.confirmBtn} onPress={handleRegister} disabled={submitting}>
                {submitting
                  ? <ActivityIndicator color={colors.white} size="small" />
                  : <Text style={styles.confirmBtnText}>Confirmar</Text>
                }
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Cancel confirm modal */}
      <Modal visible={showCancelConfirm} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Ionicons name="warning-outline" size={40} color={colors.red} style={{ alignSelf: 'center', marginBottom: 12 }} />
            <Text style={styles.modalTitle}>Cancelar inscrição?</Text>
            <Text style={styles.modalSubtitle}>Sua inscrição será cancelada. Você poderá se inscrever novamente se houver vagas.</Text>
            <View style={styles.row}>
              <TouchableOpacity style={styles.outlineBtn} onPress={() => setShowCancelConfirm(false)}>
                <Text style={styles.outlineBtnText}>Voltar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.confirmBtn, { backgroundColor: colors.red }]} onPress={handleCancel}>
                <Text style={styles.confirmBtnText}>Cancelar inscrição</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

function InfoRow({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <Ionicons name={icon as any} size={18} color={colors.primary} />
      <View style={{ flex: 1 }}>
        <Text style={styles.infoLabel}>{label}</Text>
        <Text style={styles.infoValue}>{value}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.lightGray },
  content: { padding: 16, paddingBottom: 40, gap: 14 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 12 },
  typeBadge: {
    backgroundColor: `${colors.primary}18`, borderRadius: 8,
    paddingHorizontal: 10, paddingVertical: 4, alignSelf: 'flex-start',
  },
  typeText: { fontSize: 12, fontWeight: '600', color: colors.primary },
  title: { fontSize: 22, fontWeight: '800', color: '#111827' },
  description: { fontSize: 14, color: colors.gray, lineHeight: 20 },
  infoGrid: {
    backgroundColor: colors.white, borderRadius: 16, padding: 16, gap: 12,
    shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 4, elevation: 1,
  },
  infoRow: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  feeRow: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  infoLabel: { fontSize: 11, color: colors.gray, textTransform: 'uppercase', letterSpacing: 0.5 },
  infoValue: { fontSize: 14, color: '#111827', fontWeight: '500', marginTop: 1 },
  feeAmount: { fontSize: 16, fontWeight: '800', color: colors.primary, marginTop: 2 },
  modalityChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 4 },
  modalityChip: {
    backgroundColor: `${colors.primary}15`, borderRadius: 8,
    paddingHorizontal: 10, paddingVertical: 4,
  },
  modalityChipText: { fontSize: 13, color: colors.primary, fontWeight: '600' },
  regCard: {
    flexDirection: 'row', gap: 12, padding: 14, borderRadius: 14, borderWidth: 1,
    alignItems: 'flex-start',
  },
  regCardText: { flex: 1, gap: 4 },
  regLabel: { fontSize: 15, fontWeight: '700' },
  regDesc: { fontSize: 13, color: colors.gray, lineHeight: 18 },
  rejectionText: { fontSize: 12, color: colors.red, marginTop: 4 },
  actionMsg: {
    backgroundColor: '#f0fdf4', borderRadius: 10, padding: 12,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  actionMsgText: { fontSize: 13, color: '#166534', flex: 1 },
  primaryBtn: {
    backgroundColor: colors.primary, borderRadius: 14, padding: 16,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
  },
  primaryBtnText: { color: colors.white, fontSize: 16, fontWeight: '700' },
  cancelBtn: {
    borderWidth: 1.5, borderColor: colors.red, borderRadius: 14, padding: 14,
    alignItems: 'center',
  },
  cancelBtnText: { color: colors.red, fontSize: 15, fontWeight: '600' },
  errorText: { color: colors.red, textAlign: 'center' },
  btn: { backgroundColor: colors.primary, borderRadius: 8, paddingHorizontal: 24, paddingVertical: 10 },
  btnText: { color: colors.white, fontWeight: '600' },
  // Modal
  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center', justifyContent: 'center', padding: 24,
  },
  modalBox: {
    backgroundColor: colors.white, borderRadius: 20, padding: 24,
    width: '100%', gap: 12,
  },
  modalTitle: { fontSize: 18, fontWeight: '700', color: '#111827', textAlign: 'center' },
  modalSubtitle: { fontSize: 13, color: colors.gray, textAlign: 'center', lineHeight: 18 },
  feeSummary: {
    backgroundColor: `${colors.primary}0F`, borderRadius: 12, padding: 12, alignItems: 'center',
  },
  feeSummaryLabel: { fontSize: 12, color: colors.gray, textTransform: 'uppercase' },
  feeSummaryAmount: { fontSize: 22, fontWeight: '800', color: colors.primary },
  feeSummaryFree: { fontSize: 16, fontWeight: '700', color: '#059669' },
  feeSummaryHint: { fontSize: 11, color: colors.gray, marginTop: 4, textAlign: 'center' },
  fieldLabel: { fontSize: 13, fontWeight: '600', color: '#374151' },
  modalitySelector: { flexDirection: 'row', gap: 8 },
  modalityOption: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    borderWidth: 1.5, borderColor: colors.primary, borderRadius: 10,
    paddingVertical: 10, paddingHorizontal: 8,
  },
  modalityOptionSelected: { backgroundColor: colors.primary, borderColor: colors.primary },
  modalityOptionText: { fontSize: 13, fontWeight: '600', color: colors.primary },
  textArea: {
    borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 10, padding: 10,
    minHeight: 70, textAlignVertical: 'top', fontSize: 14, color: '#111827',
  },
  row: { flexDirection: 'row', gap: 10, marginTop: 4 },
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
