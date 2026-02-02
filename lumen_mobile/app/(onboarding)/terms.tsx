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
} from 'react-native';
import { router } from 'expo-router';
import { useOnboardingStore, useAuthStore } from '@/stores';
import { Button, Loading, Card } from '@/components';
import theme from '@/theme';

export default function TermsScreen() {
  const [analyticsOptIn, setAnalyticsOptIn] = useState(false);
  const { legal, isLoadingLegal, isSaving, loadLegal, acceptTerms, error } =
    useOnboardingStore();
  const { refreshUser } = useAuthStore();

  useEffect(() => {
    loadLegal();
  }, []);

  const handleAccept = async () => {
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
          <Text style={styles.cardTitle}>📜 Termos de Uso</Text>
          <Text style={styles.version}>Versão {legal?.terms?.version}</Text>
          <ScrollView style={styles.contentScroll} nestedScrollEnabled>
            <Text style={styles.content}>{legal?.terms?.content}</Text>
          </ScrollView>
        </Card>

        {/* Privacy Card */}
        <Card style={styles.card}>
          <Text style={styles.cardTitle}>🔒 Política de Privacidade</Text>
          <Text style={styles.version}>Versão {legal?.privacy?.version}</Text>
          <ScrollView style={styles.contentScroll} nestedScrollEnabled>
            <Text style={styles.content}>{legal?.privacy?.content}</Text>
          </ScrollView>
        </Card>

        {/* Analytics opt-in */}
        <Card variant="filled" style={styles.optInCard}>
          <View style={styles.optInRow}>
            <View style={styles.optInText}>
              <Text style={styles.optInTitle}>📊 Compartilhar dados de uso</Text>
              <Text style={styles.optInDescription}>
                Ajude-nos a melhorar o app compartilhando dados anônimos de uso.
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
        <Text style={styles.footerText}>
          Ao continuar, você concorda com os Termos de Uso e Política de
          Privacidade.
        </Text>
        <Button
          title="Aceitar e Continuar"
          onPress={handleAccept}
          loading={isSaving}
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
    maxHeight: 150,
  },
  content: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.text.secondary,
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
  footerText: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.text.tertiary,
    textAlign: 'center',
    marginBottom: theme.spacing.md,
  },
});
