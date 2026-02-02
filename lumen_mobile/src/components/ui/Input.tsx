/**
 * Input Component
 * ================
 */

import React, { useState } from 'react';
import {
  View,
  TextInput,
  Text,
  StyleSheet,
  TextInputProps,
  TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import theme from '@/theme';

interface InputProps extends TextInputProps {
  label?: string;
  error?: string;
  hint?: string;
  leftIcon?: keyof typeof Ionicons.glyphMap;
  rightIcon?: keyof typeof Ionicons.glyphMap;
  onRightIconPress?: () => void;
}

export function Input({
  label,
  error,
  hint,
  leftIcon,
  rightIcon,
  onRightIconPress,
  secureTextEntry,
  style,
  ...props
}: InputProps) {
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const [isFocused, setIsFocused] = useState(false);

  const showPasswordToggle = secureTextEntry !== undefined;
  const actualSecureEntry = secureTextEntry && !isPasswordVisible;

  return (
    <View style={styles.container}>
      {label && <Text style={styles.label}>{label}</Text>}
      
      <View
        style={[
          styles.inputContainer,
          isFocused && styles.inputFocused,
          error && styles.inputError,
        ]}
      >
        {leftIcon && (
          <Ionicons
            name={leftIcon}
            size={20}
            color={theme.colors.neutral[400]}
            style={styles.leftIcon}
          />
        )}
        
        <TextInput
          style={[styles.input, style]}
          placeholderTextColor={theme.colors.neutral[400]}
          secureTextEntry={actualSecureEntry}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          {...props}
        />
        
        {showPasswordToggle && (
          <TouchableOpacity
            onPress={() => setIsPasswordVisible(!isPasswordVisible)}
            style={styles.rightIcon}
          >
            <Ionicons
              name={isPasswordVisible ? 'eye-off-outline' : 'eye-outline'}
              size={20}
              color={theme.colors.neutral[400]}
            />
          </TouchableOpacity>
        )}
        
        {rightIcon && !showPasswordToggle && (
          <TouchableOpacity
            onPress={onRightIconPress}
            style={styles.rightIcon}
            disabled={!onRightIconPress}
          >
            <Ionicons
              name={rightIcon}
              size={20}
              color={theme.colors.neutral[400]}
            />
          </TouchableOpacity>
        )}
      </View>
      
      {error && <Text style={styles.error}>{error}</Text>}
      {hint && !error && <Text style={styles.hint}>{hint}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: theme.spacing.md,
  },
  label: {
    fontSize: theme.fontSize.sm,
    fontWeight: theme.fontWeight.medium,
    color: theme.colors.text.primary,
    marginBottom: theme.spacing.xs,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.neutral[100],
    borderRadius: theme.borderRadius.lg,
    borderWidth: 1,
    borderColor: theme.colors.neutral[200],
  },
  inputFocused: {
    borderColor: theme.colors.primary[500],
    backgroundColor: theme.colors.white,
  },
  inputError: {
    borderColor: theme.colors.error.main,
  },
  input: {
    flex: 1,
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.md,
    fontSize: theme.fontSize.md,
    color: theme.colors.text.primary,
  },
  leftIcon: {
    marginLeft: theme.spacing.md,
  },
  rightIcon: {
    padding: theme.spacing.md,
  },
  error: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.error.main,
    marginTop: theme.spacing.xs,
  },
  hint: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.text.tertiary,
    marginTop: theme.spacing.xs,
  },
});
