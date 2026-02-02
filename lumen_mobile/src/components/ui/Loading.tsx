/**
 * Loading Component
 * =================
 */

import React from 'react';
import { View, ActivityIndicator, Text, StyleSheet } from 'react-native';
import theme from '@/theme';

interface LoadingProps {
  message?: string;
  fullScreen?: boolean;
}

export function Loading({ message, fullScreen = false }: LoadingProps) {
  const content = (
    <View style={styles.container}>
      <ActivityIndicator size="large" color={theme.colors.primary[800]} />
      {message && <Text style={styles.message}>{message}</Text>}
    </View>
  );

  if (fullScreen) {
    return <View style={styles.fullScreen}>{content}</View>;
  }

  return content;
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: theme.spacing.xl,
  },
  fullScreen: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.background.primary,
  },
  message: {
    marginTop: theme.spacing.md,
    fontSize: theme.fontSize.md,
    color: theme.colors.text.secondary,
  },
});
