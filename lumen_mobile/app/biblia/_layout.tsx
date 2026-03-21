/**
 * Bíblia Layout
 * =============
 * Stack navigator para a área das Sagradas Escrituras.
 */

import { Stack } from 'expo-router';

const PRIMARY = '#1A859B';
const WHITE = '#ffffff';

export default function BibliaLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: PRIMARY },
        headerTintColor: WHITE,
        headerTitleStyle: { fontWeight: '600' },
      }}
    >
      <Stack.Screen name="index" options={{ title: 'Sagradas Escrituras' }} />
      <Stack.Screen name="reader" options={{ title: '' }} />
    </Stack>
  );
}
