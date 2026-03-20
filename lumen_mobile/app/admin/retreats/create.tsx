/**
 * Admin — Create Retreat
 * ======================
 * Formulário para criar um novo retiro (salvo como DRAFT).
 */

import { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity,
  ActivityIndicator, Switch,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import api from '@/services/api';

const colors = {
  primary: '#7c3aed',
  white: '#ffffff',
  gray: '#6b7280',
  lightGray: '#f3f4f6',
  border: '#e5e7eb',
};

const TYPES = [
  { value: 'WEEKEND',   label: 'Fim de semana' },
  { value: 'DAY',       label: 'Dia único' },
  { value: 'FORMATION', label: 'Formação' },
];

const VISIBILITIES = [
  { value: 'ALL',      label: 'Todos os membros' },
  { value: 'SPECIFIC', label: 'Específico (setores/realidades)' },
];

export default function CreateRetreatScreen() {
  const [title, setTitle]         = useState('');
  const [description, setDesc]    = useState('');
  const [type, setType]           = useState('WEEKEND');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate]     = useState('');
  const [location, setLocation]   = useState('');
  const [address, setAddress]     = useState('');
  const [maxPart, setMaxPart]     = useState('');
  const [price, setPrice]         = useState('');
  const [visibility, setVis]      = useState('ALL');

  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState<string | null>(null);

  const parseDate = (str: string): string | null => {
    // Aceita dd/mm/aaaa e converte para ISO
    const match = str.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (!match) return null;
    return `${match[3]}-${match[2]}-${match[1]}T00:00:00`;
  };

  const handleCreate = async () => {
    if (!title.trim()) { setError('O título é obrigatório'); return; }
    const start = parseDate(startDate);
    const end   = parseDate(endDate);
    if (!start) { setError('Data de início inválida (use dd/mm/aaaa)'); return; }
    if (!end)   { setError('Data de término inválida (use dd/mm/aaaa)'); return; }

    setLoading(true);
    setError(null);
    try {
      await api.post('/admin/retreats', {
        title: title.trim(),
        description: description.trim() || null,
        retreat_type: type,
        start_date: start,
        end_date: end,
        location: location.trim() || null,
        address: address.trim() || null,
        max_participants: maxPart ? parseInt(maxPart, 10) : null,
        price_brl: price.trim() || null,
        visibility_type: visibility,
        eligibility_rules: [],
      });
      router.back();
    } catch (err: any) {
      setError(err?.response?.data?.detail?.message || 'Erro ao criar retiro');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      {error && (
        <View style={styles.errorBox}>
          <Ionicons name="alert-circle-outline" size={16} color="#dc2626" />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      <Field label="Título *">
        <TextInput style={styles.input} value={title} onChangeText={setTitle} placeholder="Ex: Retiro de Formação 2026" placeholderTextColor="#9ca3af" />
      </Field>

      <Field label="Descrição">
        <TextInput
          style={[styles.input, styles.textarea]} value={description}
          onChangeText={setDesc} placeholder="Descreva o retiro..." placeholderTextColor="#9ca3af"
          multiline numberOfLines={4} textAlignVertical="top"
        />
      </Field>

      <Field label="Tipo">
        <View style={styles.pills}>
          {TYPES.map(t => (
            <TouchableOpacity
              key={t.value}
              style={[styles.pill, type === t.value && styles.pillActive]}
              onPress={() => setType(t.value)}
            >
              <Text style={[styles.pillText, type === t.value && styles.pillTextActive]}>
                {t.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </Field>

      <Field label="Data de início *">
        <TextInput
          style={styles.input} value={startDate} onChangeText={setStartDate}
          placeholder="dd/mm/aaaa" placeholderTextColor="#9ca3af" keyboardType="numeric"
        />
      </Field>

      <Field label="Data de término *">
        <TextInput
          style={styles.input} value={endDate} onChangeText={setEndDate}
          placeholder="dd/mm/aaaa" placeholderTextColor="#9ca3af" keyboardType="numeric"
        />
      </Field>

      <Field label="Local">
        <TextInput style={styles.input} value={location} onChangeText={setLocation} placeholder="Ex: Casa de Retiros Nossa Senhora" placeholderTextColor="#9ca3af" />
      </Field>

      <Field label="Endereço completo">
        <TextInput style={styles.input} value={address} onChangeText={setAddress} placeholder="Rua, número, cidade..." placeholderTextColor="#9ca3af" />
      </Field>

      <Field label="Máximo de vagas">
        <TextInput style={styles.input} value={maxPart} onChangeText={setMaxPart} placeholder="Deixe vazio para sem limite" placeholderTextColor="#9ca3af" keyboardType="numeric" />
      </Field>

      <Field label="Valor (R$)">
        <TextInput style={styles.input} value={price} onChangeText={setPrice} placeholder="Ex: 120,00 · Vazio = gratuito" placeholderTextColor="#9ca3af" keyboardType="decimal-pad" />
      </Field>

      <Field label="Visibilidade">
        <View style={styles.pills}>
          {VISIBILITIES.map(v => (
            <TouchableOpacity
              key={v.value}
              style={[styles.pill, visibility === v.value && styles.pillActive]}
              onPress={() => setVis(v.value)}
            >
              <Text style={[styles.pillText, visibility === v.value && styles.pillTextActive]}>
                {v.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
        {visibility === 'SPECIFIC' && (
          <Text style={styles.hint}>
            As regras de elegibilidade podem ser configuradas após criar o retiro.
          </Text>
        )}
      </Field>

      <TouchableOpacity
        style={[styles.createBtn, loading && { opacity: 0.6 }]}
        onPress={handleCreate}
        disabled={loading}
      >
        {loading
          ? <ActivityIndicator color={colors.white} />
          : <>
              <Ionicons name="save-outline" size={20} color={colors.white} />
              <Text style={styles.createBtnText}>Criar como Rascunho</Text>
            </>
        }
      </TouchableOpacity>
    </ScrollView>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.lightGray },
  content: { padding: 16, paddingBottom: 40, gap: 14 },
  errorBox: {
    flexDirection: 'row', gap: 8, backgroundColor: '#fef2f2',
    borderRadius: 10, padding: 12, alignItems: 'center',
  },
  errorText: { color: '#dc2626', fontSize: 13, flex: 1 },
  field: { gap: 6 },
  label: { fontSize: 13, fontWeight: '600', color: '#374151' },
  input: {
    backgroundColor: colors.white, borderRadius: 10, borderWidth: 1,
    borderColor: colors.border, padding: 12, fontSize: 14, color: '#111827',
  },
  textarea: { minHeight: 90, textAlignVertical: 'top' },
  pills: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  pill: {
    borderWidth: 1.5, borderColor: colors.border, borderRadius: 20,
    paddingHorizontal: 14, paddingVertical: 7,
  },
  pillActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  pillText: { fontSize: 13, color: colors.gray, fontWeight: '500' },
  pillTextActive: { color: colors.white, fontWeight: '700' },
  hint: { fontSize: 12, color: colors.gray, marginTop: 4, fontStyle: 'italic' },
  createBtn: {
    backgroundColor: colors.primary, borderRadius: 14, padding: 16,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 8,
  },
  createBtnText: { color: colors.white, fontSize: 16, fontWeight: '700' },
});
