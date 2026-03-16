/**
 * Root Layout
 * ===========
 * Layout raiz que envolve toda a aplicação.
 */

import React from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { View, Text, StyleSheet, ScrollView } from 'react-native';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 2,
      staleTime: 1000 * 60,
    },
  },
});

// ── Error Boundary (diagnóstico — remova após resolver o crash) ──────────────
type ErrorBoundaryState = { hasError: boolean; error: string; stack: string };

class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  ErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: '', stack: '' };
  }

  static getDerivedStateFromError(error: unknown): ErrorBoundaryState {
    const e = error instanceof Error ? error : new Error(String(error));
    return { hasError: true, error: e.message, stack: e.stack || '' };
  }

  render() {
    if (this.state.hasError) {
      return (
        <View style={eb.container}>
          <ScrollView contentContainerStyle={eb.scroll}>
            <Text style={eb.title}>💥 Crash detectado</Text>
            <Text style={eb.label}>Mensagem:</Text>
            <Text style={eb.msg}>{this.state.error}</Text>
            <Text style={eb.label}>Stack:</Text>
            <Text style={eb.stack}>{this.state.stack}</Text>
          </ScrollView>
        </View>
      );
    }
    return this.props.children;
  }
}

const eb = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#1a1a1a' },
  scroll: { padding: 16, paddingTop: 60 },
  title: { fontSize: 20, fontWeight: '700', color: '#ef4444', marginBottom: 16 },
  label: { fontSize: 12, fontWeight: '700', color: '#9ca3af', marginTop: 12, marginBottom: 4 },
  msg: { fontSize: 14, color: '#fca5a5', fontFamily: 'monospace' },
  stack: { fontSize: 11, color: '#6b7280', fontFamily: 'monospace', lineHeight: 18 },
});
// ─────────────────────────────────────────────────────────────────────────────

export default function RootLayout() {
  return (
    <ErrorBoundary>
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
    </ErrorBoundary>
  );
}
