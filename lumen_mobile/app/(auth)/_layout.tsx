/**
 * Auth Layout
 * ===========
 * Layout para telas de autenticação.
 */

import { Stack } from 'expo-router';

const colors = {
  primary: '#1a365d',
  white: '#ffffff',
};

export default function AuthLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.white },
        animation: 'slide_from_right',
      }}
    >
      <Stack.Screen name="index" />
      <Stack.Screen name="login" />
      <Stack.Screen name="register" />
      <Stack.Screen name="verify-phone" />
    </Stack>
  );
}
