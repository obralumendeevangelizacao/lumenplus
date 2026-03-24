/**
 * Projeto de Vida — Wizard
 * =========================
 * 8 etapas: vocacional → diagnóstico (5 dim.) → síntese/defeito →
 * objetivo principal → meios → rotina espiritual → diretor → confirmar
 */

import { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
  Switch,
} from 'react-native';
import { router, useLocalSearchParams, type Href } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import lifePlanApi, { type CycleOut } from '@/src/services/lifePlan';
import {
  DIMENSIONS,
  VOCATIONAL_REALITIES,
  DIAGNOSIS_QUESTIONS,
  MASS_FREQUENCY_OPTIONS,
  CONFESSION_FREQUENCY_OPTIONS,
  WIZARD_STEPS,
  type DimensionKey,
} from '@/src/data/vida';

const colors = {
  primary: '#1A859B',
  primaryLight: '#E8F4F7',
  white: '#ffffff',
  gray: '#6b7280',
  lightGray: '#f3f4f6',
  dark: '#171717',
  border: '#e5e7eb',
  error: '#ef4444',
};

// ── State types ────────────────────────────────────────────────────────────

type DiagnosisData = {
  abandonar: string;
  melhorar: string;
  deus_pede: string;
};

type WizardData = {
  vocacional: string;
  diagnoses: Record<DimensionKey, DiagnosisData>;
  dominant_defect: string;
  virtudes: string;
  other_devotions: string;
  primary_goal_title: string;
  primary_goal_description: string;
  primary_actions: { action: string; frequency: string; context: string }[];
  prayer_type: string;
  prayer_duration: string;
  mass_frequency: string;
  confession_frequency: string;
  exam_of_conscience: boolean;
  exam_time: string;
  spiritual_reading: string;
  spiritual_direction_frequency: string;
  other_practices: string;
  spiritual_director_name: string;
};

const emptyDiagnosis = (): DiagnosisData => ({ abandonar: '', melhorar: '', deus_pede: '' });

const defaultData = (): WizardData => ({
  vocacional: '',
  diagnoses: {
    HUMANA: emptyDiagnosis(),
    ESPIRITUAL: emptyDiagnosis(),
    COMUNITARIA: emptyDiagnosis(),
    INTELECTUAL: emptyDiagnosis(),
    APOSTOLICA: emptyDiagnosis(),
  },
  dominant_defect: '',
  virtudes: '',
  other_devotions: '',
  primary_goal_title: '',
  primary_goal_description: '',
  primary_actions: [{ action: '', frequency: '', context: '' }],
  prayer_type: '',
  prayer_duration: '',
  mass_frequency: '',
  confession_frequency: '',
  exam_of_conscience: false,
  exam_time: '',
  spiritual_reading: '',
  spiritual_direction_frequency: '',
  other_practices: '',
  spiritual_director_name: '',
});

// ── Main Component ─────────────────────────────────────────────────────────

export default function WizardScreen() {
  const { cycleId } = useLocalSearchParams<{ cycleId: string }>();
  const [step, setStep] = useState(0);
  const [data, setData] = useState<WizardData>(defaultData());
  const [dimStep, setDimStep] = useState(0); // sub-step within diagnóstico
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  const totalSteps = WIZARD_STEPS.length;

  useEffect(() => {
    if (!cycleId) return;
    loadExistingData();
  }, [cycleId]);

  const loadExistingData = async () => {
    try {
      const cycle = await lifePlanApi.getCycle(cycleId!);
      if (cycle.wizard_progress) {
        const wp = cycle.wizard_progress as Record<string, unknown>;
        if (wp.step !== undefined) setStep(Number(wp.step));
        if (wp.dim_step !== undefined) setDimStep(Number(wp.dim_step));
        if (wp.form_data) setData({ ...defaultData(), ...(wp.form_data as Partial<WizardData>) });
      }
      // Pre-fill from existing backend data
      restoreFromCycle(cycle);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  const restoreFromCycle = (cycle: CycleOut) => {
    setData((prev) => {
      const updated = { ...prev };
      if (cycle.realidade_vocacional) updated.vocacional = cycle.realidade_vocacional;
      if (cycle.core) {
        updated.dominant_defect = cycle.core.dominant_defect || '';
        updated.virtudes = cycle.core.virtudes || '';
        updated.other_devotions = cycle.core.other_devotions || '';
        updated.spiritual_director_name = cycle.core.spiritual_director_name || '';
      }
      if (cycle.routine) {
        updated.prayer_type = cycle.routine.prayer_type || '';
        updated.prayer_duration = cycle.routine.prayer_duration || '';
        updated.mass_frequency = cycle.routine.mass_frequency || '';
        updated.confession_frequency = cycle.routine.confession_frequency || '';
        updated.exam_of_conscience = cycle.routine.exam_of_conscience ?? false;
        updated.exam_time = cycle.routine.exam_time || '';
        updated.spiritual_reading = cycle.routine.spiritual_reading || '';
        updated.spiritual_direction_frequency = cycle.routine.spiritual_direction_frequency || '';
        updated.other_practices = cycle.routine.other_practices || '';
      }
      cycle.diagnoses.forEach((d) => {
        const key = d.dimension as DimensionKey;
        if (updated.diagnoses[key]) {
          updated.diagnoses[key] = {
            abandonar: d.abandonar || '',
            melhorar: d.melhorar || '',
            deus_pede: d.deus_pede || '',
          };
        }
      });
      const primary = cycle.goals.find((g) => g.is_primary);
      if (primary) {
        updated.primary_goal_title = primary.title;
        updated.primary_goal_description = primary.description || '';
        if (primary.actions.length > 0) {
          updated.primary_actions = primary.actions.map((a) => ({
            action: a.action,
            frequency: a.frequency || '',
            context: a.context || '',
          }));
        }
      }
      return updated;
    });
  };

  const saveProgress = async (nextStep: number, nextDimStep?: number) => {
    if (!cycleId) return;
    try {
      await lifePlanApi.updateWizardProgress(cycleId, {
        step: nextStep,
        dim_step: nextDimStep ?? dimStep,
        form_data: data,
      });
    } catch {
      // non-blocking
    }
  };

  const saveStepData = async () => {
    if (!cycleId) return;
    setSaving(true);
    try {
      // Step 0: vocacional
      if (step === 0 && data.vocacional) {
        // saved as wizard_progress; cycle.realidade_vocacional set at activation
      }

      // Step 1: diagnóstico
      if (step === 1) {
        const dim = DIMENSIONS[dimStep];
        const d = data.diagnoses[dim.key];
        await lifePlanApi.upsertDiagnosis(cycleId, {
          dimension: dim.key,
          abandonar: d.abandonar || null,
          melhorar: d.melhorar || null,
          deus_pede: d.deus_pede || null,
        });
      }

      // Step 2: síntese/core
      if (step === 2) {
        await lifePlanApi.upsertCore(cycleId, {
          dominant_defect: data.dominant_defect || null,
          virtudes: data.virtudes || null,
          other_devotions: data.other_devotions || null,
        });
      }

      // Step 3: objetivo principal (title only at this step)
      // Step 4: meios (actions saved together with goal at step 4)
      if (step === 4 && data.primary_goal_title) {
        // Try to find existing primary goal
        const cycle = await lifePlanApi.getCycle(cycleId);
        const existingPrimary = cycle.goals.find((g) => g.is_primary);
        const actions = data.primary_actions
          .filter((a) => a.action.trim())
          .map((a) => ({
            action: a.action,
            frequency: a.frequency || null,
            context: a.context || null,
          }));
        if (!existingPrimary) {
          await lifePlanApi.createGoal(cycleId, {
            is_primary: true,
            title: data.primary_goal_title,
            description: data.primary_goal_description || null,
            display_order: 0,
            actions,
          });
        } else {
          await lifePlanApi.updateGoal(existingPrimary.id, {
            title: data.primary_goal_title,
            description: data.primary_goal_description || null,
          });
          // Update actions separately if needed
        }
      }

      // Step 5: rotina
      if (step === 5) {
        await lifePlanApi.upsertRoutine(cycleId, {
          prayer_type: data.prayer_type || null,
          prayer_duration: data.prayer_duration || null,
          mass_frequency: data.mass_frequency || null,
          confession_frequency: data.confession_frequency || null,
          exam_of_conscience: data.exam_of_conscience,
          exam_time: data.exam_time || null,
          spiritual_reading: data.spiritual_reading || null,
          spiritual_direction_frequency: data.spiritual_direction_frequency || null,
          other_practices: data.other_practices || null,
        });
      }

      // Step 6: diretor
      if (step === 6) {
        await lifePlanApi.upsertCore(cycleId, {
          spiritual_director_name: data.spiritual_director_name || null,
        });
      }
    } catch (err: any) {
      const msg = err?.response?.data?.detail?.message || 'Erro ao salvar';
      Alert.alert('Erro', msg);
      return false;
    } finally {
      setSaving(false);
    }
    return true;
  };

  const handleNext = async () => {
    // Special case: diagnóstico has sub-steps
    if (step === 1 && dimStep < DIMENSIONS.length - 1) {
      const ok = await saveStepData();
      if (!ok) return;
      const nextDim = dimStep + 1;
      setDimStep(nextDim);
      await saveProgress(step, nextDim);
      return;
    }

    const ok = await saveStepData();
    if (!ok) return;
    const nextStep = step + 1;
    setStep(nextStep);
    setDimStep(0);
    await saveProgress(nextStep, 0);
  };

  const handleBack = () => {
    if (step === 1 && dimStep > 0) {
      setDimStep(dimStep - 1);
      return;
    }
    if (step === 0) {
      router.back();
      return;
    }
    setStep(step - 1);
    if (step - 1 === 1) setDimStep(DIMENSIONS.length - 1);
  };

  const handleFinish = async () => {
    const ok = await saveStepData();
    if (!ok) return;
    router.replace('/vida' as Href);
  };

  const updateDiagnosis = (key: keyof DiagnosisData, value: string) => {
    const dim = DIMENSIONS[dimStep].key;
    setData((prev) => ({
      ...prev,
      diagnoses: {
        ...prev.diagnoses,
        [dim]: { ...prev.diagnoses[dim], [key]: value },
      },
    }));
  };

  const addAction = () => {
    setData((prev) => ({
      ...prev,
      primary_actions: [...prev.primary_actions, { action: '', frequency: '', context: '' }],
    }));
  };

  const updateAction = (idx: number, field: 'action' | 'frequency' | 'context', value: string) => {
    setData((prev) => {
      const actions = [...prev.primary_actions];
      actions[idx] = { ...actions[idx], [field]: value };
      return { ...prev, primary_actions: actions };
    });
  };

  const removeAction = (idx: number) => {
    setData((prev) => ({
      ...prev,
      primary_actions: prev.primary_actions.filter((_, i) => i !== idx),
    }));
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  // ── Progress bar ────────────────────────────────────────────────────────
  const progressSteps = totalSteps;
  const currentProgressStep = step === 1 ? 1 : step;

  return (
    <View style={styles.container}>
      {/* Progress */}
      <View style={styles.progressContainer}>
        <View style={styles.progressBar}>
          <View style={[styles.progressFill, { width: `${((currentProgressStep) / (totalSteps - 1)) * 100}%` }]} />
        </View>
        <Text style={styles.progressLabel}>
          {WIZARD_STEPS[step]?.label}
          {step === 1 ? ` (${dimStep + 1}/${DIMENSIONS.length})` : ''}
        </Text>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        {/* ── Step 0: Realidade Vocacional ─────────────────────────────── */}
        {step === 0 && (
          <View>
            <Text style={styles.stepTitle}>Sua Realidade Vocacional</Text>
            <Text style={styles.stepSubtitle}>
              Selecione o estado de vida que melhor descreve sua vocação atual.
            </Text>
            {VOCATIONAL_REALITIES.map((v) => (
              <TouchableOpacity
                key={v.key}
                style={[styles.optionCard, data.vocacional === v.key && styles.optionCardSelected]}
                onPress={() => setData((p) => ({ ...p, vocacional: v.key }))}
              >
                <Text style={[styles.optionLabel, data.vocacional === v.key && styles.optionLabelSelected]}>
                  {v.label}
                </Text>
                {data.vocacional === v.key && (
                  <Ionicons name="checkmark-circle" size={20} color={colors.primary} />
                )}
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* ── Step 1: Diagnóstico ──────────────────────────────────────── */}
        {step === 1 && (
          <View>
            <View style={styles.dimHeader}>
              <Ionicons name={DIMENSIONS[dimStep].icon as any} size={24} color={colors.primary} />
              <Text style={styles.stepTitle}>{DIMENSIONS[dimStep].label}</Text>
            </View>
            <Text style={styles.stepSubtitle}>Reflexão honesta sobre esta dimensão da sua vida.</Text>

            <Text style={styles.fieldLabel}>
              {DIAGNOSIS_QUESTIONS[DIMENSIONS[dimStep].key].abandonar}
            </Text>
            <TextInput
              style={styles.textArea}
              multiline
              numberOfLines={3}
              placeholder="Escreva sua reflexão..."
              placeholderTextColor={colors.gray}
              value={data.diagnoses[DIMENSIONS[dimStep].key].abandonar}
              onChangeText={(v) => updateDiagnosis('abandonar', v)}
            />

            <Text style={styles.fieldLabel}>
              {DIAGNOSIS_QUESTIONS[DIMENSIONS[dimStep].key].melhorar}
            </Text>
            <TextInput
              style={styles.textArea}
              multiline
              numberOfLines={3}
              placeholder="Escreva sua reflexão..."
              placeholderTextColor={colors.gray}
              value={data.diagnoses[DIMENSIONS[dimStep].key].melhorar}
              onChangeText={(v) => updateDiagnosis('melhorar', v)}
            />

            <Text style={styles.fieldLabel}>
              {DIAGNOSIS_QUESTIONS[DIMENSIONS[dimStep].key].deus_pede}
            </Text>
            <TextInput
              style={styles.textArea}
              multiline
              numberOfLines={3}
              placeholder="O que Deus me pede..."
              placeholderTextColor={colors.gray}
              value={data.diagnoses[DIMENSIONS[dimStep].key].deus_pede}
              onChangeText={(v) => updateDiagnosis('deus_pede', v)}
            />
          </View>
        )}

        {/* ── Step 2: Síntese & Defeito Dominante ─────────────────────── */}
        {step === 2 && (
          <View>
            <Text style={styles.stepTitle}>Síntese e Defeito Dominante</Text>
            <Text style={styles.stepSubtitle}>
              A partir do diagnóstico, identifique o defeito dominante que impede seu crescimento espiritual e as virtudes opostas a cultivar.
            </Text>

            <Text style={styles.fieldLabel}>Defeito dominante *</Text>
            <TextInput
              style={styles.input}
              placeholder="Ex: soberba, preguiça, impureza..."
              placeholderTextColor={colors.gray}
              value={data.dominant_defect}
              onChangeText={(v) => setData((p) => ({ ...p, dominant_defect: v }))}
            />

            <Text style={styles.fieldLabel}>Virtudes a cultivar</Text>
            <TextInput
              style={styles.textArea}
              multiline
              numberOfLines={3}
              placeholder="Ex: humildade, laboriosidade, castidade..."
              placeholderTextColor={colors.gray}
              value={data.virtudes}
              onChangeText={(v) => setData((p) => ({ ...p, virtudes: v }))}
            />

            <Text style={styles.fieldLabel}>Outras devoções e práticas</Text>
            <TextInput
              style={styles.textArea}
              multiline
              numberOfLines={3}
              placeholder="Ex: terço diário, Via Sacra..."
              placeholderTextColor={colors.gray}
              value={data.other_devotions}
              onChangeText={(v) => setData((p) => ({ ...p, other_devotions: v }))}
            />
          </View>
        )}

        {/* ── Step 3: Objetivo Principal ───────────────────────────────── */}
        {step === 3 && (
          <View>
            <Text style={styles.stepTitle}>Objetivo Principal</Text>
            <Text style={styles.stepSubtitle}>
              Defina o objetivo principal do seu plano — geralmente vinculado ao combate do defeito dominante.
            </Text>

            <Text style={styles.fieldLabel}>Título do objetivo (máx. 80 caracteres) *</Text>
            <TextInput
              style={styles.input}
              placeholder="Ex: Vencer a soberba pela humildade"
              placeholderTextColor={colors.gray}
              value={data.primary_goal_title}
              maxLength={80}
              onChangeText={(v) => setData((p) => ({ ...p, primary_goal_title: v }))}
            />
            <Text style={styles.charCount}>{data.primary_goal_title.length}/80</Text>

            <Text style={styles.fieldLabel}>Descrição (opcional)</Text>
            <TextInput
              style={styles.textArea}
              multiline
              numberOfLines={4}
              placeholder="Descreva com mais detalhes o que deseja alcançar..."
              placeholderTextColor={colors.gray}
              value={data.primary_goal_description}
              onChangeText={(v) => setData((p) => ({ ...p, primary_goal_description: v }))}
            />
          </View>
        )}

        {/* ── Step 4: Meios ────────────────────────────────────────────── */}
        {step === 4 && (
          <View>
            <Text style={styles.stepTitle}>Meios Concretos</Text>
            <Text style={styles.stepSubtitle}>
              Liste as ações concretas para alcançar seu objetivo principal.
            </Text>

            {data.primary_actions.map((action, idx) => (
              <View key={idx} style={styles.actionCard}>
                <View style={styles.actionCardHeader}>
                  <Text style={styles.actionCardTitle}>Meio {idx + 1}</Text>
                  {idx > 0 && (
                    <TouchableOpacity onPress={() => removeAction(idx)}>
                      <Ionicons name="trash-outline" size={18} color={colors.error} />
                    </TouchableOpacity>
                  )}
                </View>
                <TextInput
                  style={styles.input}
                  placeholder="Descrição da ação *"
                  placeholderTextColor={colors.gray}
                  value={action.action}
                  onChangeText={(v) => updateAction(idx, 'action', v)}
                />
                <TextInput
                  style={styles.input}
                  placeholder="Frequência (ex: diária, semanal)"
                  placeholderTextColor={colors.gray}
                  value={action.frequency}
                  onChangeText={(v) => updateAction(idx, 'frequency', v)}
                />
                <TextInput
                  style={styles.input}
                  placeholder="Contexto (ex: pela manhã, antes da missa)"
                  placeholderTextColor={colors.gray}
                  value={action.context}
                  onChangeText={(v) => updateAction(idx, 'context', v)}
                />
              </View>
            ))}

            {data.primary_actions.length < 5 && (
              <TouchableOpacity style={styles.addActionButton} onPress={addAction}>
                <Ionicons name="add-circle-outline" size={18} color={colors.primary} />
                <Text style={styles.addActionText}>Adicionar meio</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* ── Step 5: Rotina Espiritual ────────────────────────────────── */}
        {step === 5 && (
          <View>
            <Text style={styles.stepTitle}>Rotina Espiritual</Text>
            <Text style={styles.stepSubtitle}>
              Defina as práticas espirituais que sustentarão seu plano.
            </Text>

            <Text style={styles.fieldLabel}>Tipo de oração</Text>
            <TextInput
              style={styles.input}
              placeholder="Ex: Lectio Divina, Rosário, Laudes..."
              placeholderTextColor={colors.gray}
              value={data.prayer_type}
              onChangeText={(v) => setData((p) => ({ ...p, prayer_type: v }))}
            />

            <Text style={styles.fieldLabel}>Duração da oração</Text>
            <TextInput
              style={styles.input}
              placeholder="Ex: 30 minutos"
              placeholderTextColor={colors.gray}
              value={data.prayer_duration}
              onChangeText={(v) => setData((p) => ({ ...p, prayer_duration: v }))}
            />

            <Text style={styles.fieldLabel}>Frequência da Missa</Text>
            <View style={styles.optionGroup}>
              {MASS_FREQUENCY_OPTIONS.map((opt) => (
                <TouchableOpacity
                  key={opt.key}
                  style={[styles.chipOption, data.mass_frequency === opt.key && styles.chipSelected]}
                  onPress={() => setData((p) => ({ ...p, mass_frequency: opt.key }))}
                >
                  <Text style={[styles.chipText, data.mass_frequency === opt.key && styles.chipTextSelected]}>
                    {opt.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.fieldLabel}>Frequência da Confissão</Text>
            <View style={styles.optionGroup}>
              {CONFESSION_FREQUENCY_OPTIONS.map((opt) => (
                <TouchableOpacity
                  key={opt.key}
                  style={[styles.chipOption, data.confession_frequency === opt.key && styles.chipSelected]}
                  onPress={() => setData((p) => ({ ...p, confession_frequency: opt.key }))}
                >
                  <Text style={[styles.chipText, data.confession_frequency === opt.key && styles.chipTextSelected]}>
                    {opt.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.switchRow}>
              <Text style={styles.fieldLabel}>Exame de consciência diário</Text>
              <Switch
                value={data.exam_of_conscience}
                onValueChange={(v) => setData((p) => ({ ...p, exam_of_conscience: v }))}
                trackColor={{ true: colors.primary }}
              />
            </View>

            {data.exam_of_conscience && (
              <TextInput
                style={styles.input}
                placeholder="Horário do exame (ex: 21h)"
                placeholderTextColor={colors.gray}
                value={data.exam_time}
                onChangeText={(v) => setData((p) => ({ ...p, exam_time: v }))}
              />
            )}

            <Text style={styles.fieldLabel}>Leitura espiritual</Text>
            <TextInput
              style={styles.input}
              placeholder="Ex: Imitação de Cristo"
              placeholderTextColor={colors.gray}
              value={data.spiritual_reading}
              onChangeText={(v) => setData((p) => ({ ...p, spiritual_reading: v }))}
            />

            <Text style={styles.fieldLabel}>Outras práticas espirituais</Text>
            <TextInput
              style={styles.textArea}
              multiline
              numberOfLines={3}
              placeholder="Ex: Adoração eucarística quinzenal..."
              placeholderTextColor={colors.gray}
              value={data.other_practices}
              onChangeText={(v) => setData((p) => ({ ...p, other_practices: v }))}
            />
          </View>
        )}

        {/* ── Step 6: Diretor Espiritual ───────────────────────────────── */}
        {step === 6 && (
          <View>
            <Text style={styles.stepTitle}>Diretor Espiritual</Text>
            <Text style={styles.stepSubtitle}>
              O acompanhamento espiritual é fundamental para o sucesso do seu projeto de vida.
            </Text>

            <Text style={styles.fieldLabel}>Nome do diretor espiritual</Text>
            <TextInput
              style={styles.input}
              placeholder="Padre ou acompanhante espiritual..."
              placeholderTextColor={colors.gray}
              value={data.spiritual_director_name}
              onChangeText={(v) => setData((p) => ({ ...p, spiritual_director_name: v }))}
            />

            <Text style={styles.fieldLabel}>Frequência de encontros com o diretor</Text>
            <TextInput
              style={styles.input}
              placeholder="Ex: Mensal, quinzenal..."
              placeholderTextColor={colors.gray}
              value={data.spiritual_direction_frequency}
              onChangeText={(v) => setData((p) => ({ ...p, spiritual_direction_frequency: v }))}
            />

            <View style={styles.infoBox}>
              <Ionicons name="information-circle-outline" size={20} color={colors.primary} />
              <Text style={styles.infoText}>
                Se ainda não tem diretor espiritual, busque um sacerdote ou pessoa de confiança na sua comunidade para esse acompanhamento.
              </Text>
            </View>
          </View>
        )}

        {/* ── Step 7: Confirmar ─────────────────────────────────────────── */}
        {step === 7 && (
          <View>
            <Text style={styles.stepTitle}>Revisar e Confirmar</Text>
            <Text style={styles.stepSubtitle}>
              Seu Projeto de Vida está quase pronto. Revise e, quando estiver satisfeito, salve como rascunho. Você poderá ativá-lo na tela principal.
            </Text>

            <View style={styles.summaryCard}>
              <Text style={styles.summaryLabel}>Realidade Vocacional</Text>
              <Text style={styles.summaryValue}>{data.vocacional || '(não informado)'}</Text>
            </View>

            <View style={styles.summaryCard}>
              <Text style={styles.summaryLabel}>Defeito Dominante</Text>
              <Text style={styles.summaryValue}>{data.dominant_defect || '(não informado)'}</Text>
            </View>

            <View style={styles.summaryCard}>
              <Text style={styles.summaryLabel}>Objetivo Principal</Text>
              <Text style={styles.summaryValue}>{data.primary_goal_title || '(não informado)'}</Text>
            </View>

            <View style={styles.summaryCard}>
              <Text style={styles.summaryLabel}>Meios</Text>
              <Text style={styles.summaryValue}>
                {data.primary_actions.filter((a) => a.action.trim()).length} ações definidas
              </Text>
            </View>

            <View style={styles.summaryCard}>
              <Text style={styles.summaryLabel}>Dimensões diagnosticadas</Text>
              <Text style={styles.summaryValue}>
                {Object.values(data.diagnoses).filter((d) => d.abandonar || d.melhorar || d.deus_pede).length}/5
              </Text>
            </View>

            <View style={styles.summaryCard}>
              <Text style={styles.summaryLabel}>Diretor Espiritual</Text>
              <Text style={styles.summaryValue}>{data.spiritual_director_name || '(não informado)'}</Text>
            </View>

            <View style={styles.infoBox}>
              <Ionicons name="checkmark-circle-outline" size={20} color={colors.primary} />
              <Text style={styles.infoText}>
                Após salvar, você poderá ativar o plano na tela principal. O plano ativo orienta suas revisões mensais.
              </Text>
            </View>
          </View>
        )}
      </ScrollView>

      {/* Navigation */}
      <View style={styles.navContainer}>
        <TouchableOpacity style={styles.backButton} onPress={handleBack}>
          <Ionicons name="chevron-back" size={20} color={colors.gray} />
          <Text style={styles.backButtonText}>Voltar</Text>
        </TouchableOpacity>

        {step < totalSteps - 1 ? (
          <TouchableOpacity
            style={[styles.nextButton, saving && styles.buttonDisabled]}
            onPress={handleNext}
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator size="small" color={colors.white} />
            ) : (
              <>
                <Text style={styles.nextButtonText}>Próximo</Text>
                <Ionicons name="chevron-forward" size={20} color={colors.white} />
              </>
            )}
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={[styles.nextButton, styles.finishButton, saving && styles.buttonDisabled]}
            onPress={handleFinish}
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator size="small" color={colors.white} />
            ) : (
              <>
                <Ionicons name="checkmark" size={20} color={colors.white} />
                <Text style={styles.nextButtonText}>Salvar Plano</Text>
              </>
            )}
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.lightGray },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scroll: { flex: 1 },
  scrollContent: { padding: 16, paddingBottom: 24 },

  progressContainer: {
    backgroundColor: colors.white,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  progressBar: {
    height: 4,
    backgroundColor: colors.lightGray,
    borderRadius: 2,
    marginBottom: 8,
  },
  progressFill: {
    height: 4,
    backgroundColor: colors.primary,
    borderRadius: 2,
  },
  progressLabel: { fontSize: 13, fontWeight: '600', color: colors.primary },

  stepTitle: { fontSize: 20, fontWeight: '700', color: colors.dark, marginBottom: 8 },
  stepSubtitle: { fontSize: 14, color: colors.gray, lineHeight: 20, marginBottom: 20 },

  dimHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 },

  fieldLabel: { fontSize: 14, fontWeight: '600', color: colors.dark, marginBottom: 8, marginTop: 12 },
  charCount: { fontSize: 11, color: colors.gray, textAlign: 'right', marginTop: 2 },

  input: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: colors.dark,
    marginBottom: 4,
  },
  textArea: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: colors.dark,
    textAlignVertical: 'top',
    minHeight: 90,
    marginBottom: 4,
  },

  optionCard: {
    backgroundColor: colors.white,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: 10,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  optionCardSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryLight,
  },
  optionLabel: { fontSize: 15, color: colors.dark },
  optionLabelSelected: { color: colors.primary, fontWeight: '600' },

  optionGroup: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 },
  chipOption: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.white,
  },
  chipSelected: { borderColor: colors.primary, backgroundColor: colors.primaryLight },
  chipText: { fontSize: 13, color: colors.gray },
  chipTextSelected: { color: colors.primary, fontWeight: '600' },

  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    marginTop: 8,
  },

  actionCard: {
    backgroundColor: colors.white,
    borderRadius: 10,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  actionCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  actionCardTitle: { fontSize: 13, fontWeight: '600', color: colors.gray, textTransform: 'uppercase' },

  addActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 12,
    justifyContent: 'center',
  },
  addActionText: { color: colors.primary, fontSize: 14, fontWeight: '500' },

  infoBox: {
    flexDirection: 'row',
    gap: 10,
    backgroundColor: colors.primaryLight,
    borderRadius: 10,
    padding: 14,
    marginTop: 16,
    alignItems: 'flex-start',
  },
  infoText: { flex: 1, fontSize: 13, color: colors.dark, lineHeight: 19 },

  summaryCard: {
    backgroundColor: colors.white,
    borderRadius: 10,
    padding: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  summaryLabel: { fontSize: 11, fontWeight: '600', color: colors.gray, textTransform: 'uppercase', marginBottom: 4 },
  summaryValue: { fontSize: 15, color: colors.dark },

  navContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    backgroundColor: colors.white,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  backButtonText: { color: colors.gray, fontSize: 15 },
  nextButton: {
    backgroundColor: colors.primary,
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 24,
    gap: 6,
  },
  finishButton: { backgroundColor: '#059669' },
  buttonDisabled: { opacity: 0.6 },
  nextButtonText: { color: colors.white, fontSize: 15, fontWeight: '600' },
});
