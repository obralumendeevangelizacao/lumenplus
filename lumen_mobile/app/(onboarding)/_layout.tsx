/**
 * Onboarding Layout
 * =================
 */

import { Stack } from 'expo-router';
import theme from '@/theme';

export default function OnboardingLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: {
          backgroundColor: theme.colors.primary[800],
        },
        headerTintColor: theme.colors.white,
        headerTitleStyle: {
          fontWeight: '600',
        },
        headerBackTitle: 'Voltar',
      }}
    >
      <Stack.Screen
        name="terms"
        options={{ title: 'Termos de Uso', headerBackVisible: false }}
      />
      <Stack.Screen
        name="profile"
        options={{ title: 'Seu Perfil' }}
      />
      <Stack.Screen
        name="verify-phone"
        options={{ title: 'Verificar Telefone' }}
      />
    </Stack>
  );
}
