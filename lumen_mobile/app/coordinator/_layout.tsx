/**
 * Coordinator Layout
 * ==================
 * Layout para a área de coordenação.
 */

import { Stack } from 'expo-router';

const colors = {
  coord: '#059669',
  white: '#ffffff',
};

export default function CoordinatorLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.coord },
        headerTintColor: colors.white,
        headerTitleStyle: { fontWeight: '600' },
      }}
    >
      <Stack.Screen name="index" options={{ title: 'Minha Coordenação' }} />
    </Stack>
  );
}
