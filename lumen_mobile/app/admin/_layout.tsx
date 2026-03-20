/**
 * Admin Layout
 * ============
 * Layout para área administrativa.
 * Define títulos bonitos para cada rota filha, evitando que
 * os nomes brutos dos segmentos ("admin", "entities", "users")
 * apareçam no cabeçalho.
 */

import { Stack } from 'expo-router';

const colors = {
  admin: '#7c3aed',
  white: '#ffffff',
};

export default function AdminLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.admin },
        headerTintColor: colors.white,
        headerTitleStyle: { fontWeight: '600' },
      }}
    >
      <Stack.Screen name="index"        options={{ title: 'Administração' }} />
      <Stack.Screen name="dashboard"    options={{ title: 'Dashboard' }} />
      <Stack.Screen name="entities"     options={{ title: 'Entidades' }} />
      <Stack.Screen name="users"        options={{ title: 'Gestão de Usuários' }} />
      <Stack.Screen name="create-aviso" options={{ title: 'Criar Aviso' }} />
      <Stack.Screen name="sent-avisos"      options={{ title: 'Avisos Enviados' }} />
      <Stack.Screen name="audit-logs"       options={{ title: 'Logs de Auditoria' }} />
      <Stack.Screen name="retreats/index"   options={{ title: 'Retiros' }} />
      <Stack.Screen name="retreats/create"  options={{ title: 'Criar Retiro' }} />
      <Stack.Screen name="retreats/[id]"    options={{ title: 'Detalhes do Retiro' }} />
    </Stack>
  );
}
