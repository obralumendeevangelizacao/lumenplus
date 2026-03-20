import { Stack } from 'expo-router';

const colors = { primary: '#1A859B', white: '#ffffff' };

export default function RetreatsLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.primary },
        headerTintColor: colors.white,
        headerTitleStyle: { fontWeight: '600' },
      }}
    >
      <Stack.Screen name="index"          options={{ title: 'Retiros' }} />
      <Stack.Screen name="[id]"           options={{ title: 'Detalhes do Retiro' }} />
      <Stack.Screen name="[id]/payment"   options={{ title: 'Enviar Comprovante' }} />
    </Stack>
  );
}
