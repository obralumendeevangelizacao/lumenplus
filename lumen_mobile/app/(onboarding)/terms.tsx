/**
 * Terms Screen
 * ============
 * Tela de aceitação de termos e privacidade.
 */

import { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Switch,
  Pressable,
} from 'react-native';
import { router } from 'expo-router';
import { useOnboardingStore, useAuthStore } from '@/stores';
import { Button, Loading, Card } from '@/components';
import theme from '@/theme';

function Checkbox({ checked, onPress, label }: { checked: boolean; onPress: () => void; label: string }) {
  return (
    <Pressable style={styles.checkboxRow} onPress={onPress} accessibilityRole="checkbox" accessibilityState={{ checked }}>
      <View style={[styles.checkboxBox, checked && styles.checkboxBoxChecked]}>
        {checked && <Text style={styles.checkboxTick}>✓</Text>}
      </View>
      <Text style={styles.checkboxLabel}>{label}</Text>
    </Pressable>
  );
}

export default function TermsScreen() {
  const [analyticsOptIn, setAnalyticsOptIn] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [privacyAccepted, setPrivacyAccepted] = useState(false);
  const { legal, isLoadingLegal, isSaving, loadLegal, acceptTerms, error } =
    useOnboardingStore();
  const { refreshUser } = useAuthStore();

  useEffect(() => {
    loadLegal();
  }, []);

  const canAccept = termsAccepted && privacyAccepted;

  const handleAccept = async () => {
    if (!canAccept) return;
    try {
      await acceptTerms(analyticsOptIn);
      await refreshUser();
      router.replace('/');
    } catch {
      // Error handled by store
    }
  };

  if (isLoadingLegal) {
    return <Loading fullScreen message="Carregando termos..." />;
  }

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Terms Card */}
        <Card style={styles.card}>
          <Text style={styles.cardTitle}>Termos de Uso</Text>
          <Text style={styles.version}>Versão {legal?.terms?.version}</Text>
          <ScrollView style={styles.contentScroll} nestedScrollEnabled>
            <Text style={styles.content}>{legal?.terms?.content}</Text>
          </ScrollView>
        </Card>

        {/* Privacy Card */}
        <Card style={styles.card}>
          <Text style={styles.cardTitle}>Política de Privacidade</Text>
          <Text style={styles.version}>Versão {legal?.privacy?.version}</Text>
          <ScrollView style={styles.contentScroll} nestedScrollEnabled>
            <Text style={styles.content}>{legal?.privacy?.content}</Text>
          </ScrollView>
        </Card>

        {/* Confirmação explícita (LGPD art. 8 — consentimento granular) */}
        <Card style={styles.card}>
          <Text style={styles.consentTitle}>Confirmação de leitura</Text>
          <Checkbox
            checked={termsAccepted}
            onPress={() => setTermsAccepted(v => !v)}
            label="Li e aceito os Termos de Uso"
          />
          <Checkbox
            checked={privacyAccepted}
            onPress={() => setPrivacyAccepted(v => !v)}
            label="Li e aceito a Política de Privacidade e o tratamento dos meus dados pessoais conforme a LGPD"
          />
        </Card>

        {/* Analytics opt-in */}
        <Card variant="filled" style={styles.optInCard}>
          <View style={styles.optInRow}>
            <View style={styles.optInText}>
              <Text style={styles.optInTitle}>Compartilhar dados de uso</Text>
              <Text style={styles.optInDescription}>
                Ajude-nos a melhorar o app compartilhando dados anônimos de uso (opcional).
              </Text>
            </View>
            <Switch
              value={analyticsOptIn}
              onValueChange={setAnalyticsOptIn}
              trackColor={{
                false: theme.colors.neutral[300],
                true: theme.colors.primary[500],
              }}
              thumbColor={theme.colors.white}
            />
          </View>
        </Card>

        {error && (
          <Text style={styles.error}>{error}</Text>
        )}
      </ScrollView>

      <View style={styles.footer}>
        {!canAccept && (
          <Text style={styles.footerHint}>
            Leia e confirme os documentos acima para continuar.
          </Text>
        )}
        <Button
          title="Aceitar e Continuar"
          onPress={handleAccept}
          loading={isSaving}
          disabled={!canAccept}
          fullWidth
          size="lg"
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background.secondary,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: theme.spacing.md,
  },
  card: {
    marginBottom: theme.spacing.md,
  },
  cardTitle: {
    fontSize: theme.fontSize.lg,
    fontWeight: theme.fontWeight.bold,
    color: theme.colors.text.primary,
    marginBottom: theme.spacing.xs,
  },
  version: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.text.tertiary,
    marginBottom: theme.spacing.md,
  },
  contentScroll: {
    maxHeight: 320,
  },
  content: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.text.secondary,
    lineHeight: 20,
  },
  consentTitle: {
    fontSize: theme.fontSize.md,
    fontWeight: theme.fontWeight.semibold,
    color: theme.colors.text.primary,
    marginBottom: theme.spacing.md,
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: theme.spacing.md,
  },
  checkboxBox: {
    width: 22,
    height: 22,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: theme.colors.neutral[400],
    marginRight: theme.spacing.sm,
    marginTop: 1,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  checkboxBoxChecked: {
    backgroundColor: theme.colors.primary[500],
    borderColor: theme.colors.primary[500],
  },
  checkboxTick: {
    color: theme.colors.white,
    fontSize: 13,
    fontWeight: theme.fontWeight.bold,
    lineHeight: 16,
  },
  checkboxLabel: {
    flex: 1,
    fontSize: theme.fontSize.sm,
    color: theme.colors.text.primary,
    lineHeight: 20,
  },
  optInCard: {
    marginBottom: theme.spacing.md,
  },
  optInRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  optInText: {
    flex: 1,
    marginRight: theme.spacing.md,
  },
  optInTitle: {
    fontSize: theme.fontSize.md,
    fontWeight: theme.fontWeight.medium,
    color: theme.colors.text.primary,
    marginBottom: theme.spacing.xs,
  },
  optInDescription: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.text.secondary,
  },
  error: {
    color: theme.colors.error.main,
    fontSize: theme.fontSize.sm,
    textAlign: 'center',
    marginBottom: theme.spacing.md,
  },
  footer: {
    padding: theme.spacing.md,
    backgroundColor: theme.colors.white,
    borderTopWidth: 1,
    borderTopColor: theme.colors.neutral[200],
  },
  footerHint: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.text.tertiary,
    textAlign: 'center',
    marginBottom: theme.spacing.sm,
  },
});
