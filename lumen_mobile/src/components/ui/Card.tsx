/**
 * Card Component
 * ==============
 */

import React from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import theme from '@/theme';

interface CardProps {
  children: React.ReactNode;
  style?: ViewStyle;
  variant?: 'elevated' | 'outlined' | 'filled';
}

export function Card({ children, style, variant = 'elevated' }: CardProps) {
  return (
    <View style={[styles.base, styles[variant], style]}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.md,
  },
  elevated: {
    backgroundColor: theme.colors.white,
    ...theme.shadow.md,
  },
  outlined: {
    backgroundColor: theme.colors.white,
    borderWidth: 1,
    borderColor: theme.colors.neutral[200],
  },
  filled: {
    backgroundColor: theme.colors.neutral[100],
  },
});
