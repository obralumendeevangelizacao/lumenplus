/**
 * Root Layout
 * ===========
 * Layout raiz que envolve toda a aplicação.
 */

import React from 'react';
import * as Sentry from '@sentry/react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { View, Text, StyleSheet, ScrollView } from 'react-native';

// Sentry — inicializa antes de qualquer render
Sentry.init({
  dsn: process.env.EXPO_PUBLIC_SENTRY_DSN ?? '',
  environment: process.env.EXPO_PUBLIC_ENVIRONMENT ?? 'production',
  release: `lumenplus-frontend@${process.env.EXPO_PUBLIC_APP_VERSION ?? '1.0.0'}`,
  // LGPD: não capturar dados pessoais automaticamente
  sendDefaultPii: false,
  // Performance: 10% das navegações
  tracesSampleRate: 0.1,
  // Só ativa se o DSN estiver configurado
  enabled: !!process.env.EXPO_PUBLIC_SENTRY_DSN,
});

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 2,
      staleTime: 1000 * 60,
    },
  },
});

// Fallback exibido quando o Sentry captura um crash não recuperável
function CrashFallback({ error }: { error: Error }) {
  return (
    <View style={eb.container}>
      <ScrollView contentContainerStyle={eb.scroll}>
        <Text style={eb.title}>Algo deu errado</Text>
        <Text style={eb.msg}>
          O erro foi registrado automaticamente. Tente recarregar a página.
        </Text>
        {__DEV__ && (
          <>
            <Text style={eb.label}>{error.message}</Text>
            <Text style={eb.stack}>{error.stack}</Text>
          </>
        )}
      </ScrollView>
    </View>
  );
}

const eb = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#1a1a1a' },
  scroll: { padding: 16, paddingTop: 60 },
  title: { fontSize: 20, fontWeight: '700', color: '#ef4444', marginBottom: 16 },
  label: { fontSize: 12, fontWeight: '700', color: '#9ca3af', marginTop: 12, marginBottom: 4 },
  msg: { fontSize: 14, color: '#fca5a5' },
  stack: { fontSize: 11, color: '#6b7280', fontFamily: 'monospace', lineHeight: 18 },
});

export default function RootLayout() {
  return (
    <Sentry.ErrorBoundary fallback={({ error }) => <CrashFallback error={error as Error} />}>
      <QueryClientProvider client={queryClient}>
        <SafeAreaProvider>
          <StatusBar style="auto" />
          <Stack
            screenOptions={{
              headerStyle: {
                backgroundColor: '#1a365d',
              },
              headerTintColor: '#ffffff',
              headerTitleStyle: {
                fontWeight: '600',
              },
              contentStyle: {
                backgroundColor: '#ffffff',
              },
            }}
          >
            <Stack.Screen name="index" options={{ headerShown: false }} />
            <Stack.Screen name="(auth)" options={{ headerShown: false }} />
            <Stack.Screen name="(onboarding)" options={{ headerShown: false }} />
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          </Stack>
        </SafeAreaProvider>
      </QueryClientProvider>
    </Sentry.ErrorBoundary>
  );
}
