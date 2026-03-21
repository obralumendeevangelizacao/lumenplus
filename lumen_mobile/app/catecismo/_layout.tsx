/**
 * Catecismo Layout
 * ================
 */

import { Stack } from 'expo-router';

const PRIMARY = '#7c3aed';
const WHITE = '#ffffff';

export default function CatecismoLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: PRIMARY },
        headerTintColor: WHITE,
        headerTitleStyle: { fontWeight: '600' },
      }}
    >
      <Stack.Screen name="index" options={{ title: 'Catecismo' }} />
      <Stack.Screen name="reader" options={{ title: '' }} />
    </Stack>
  );
}
