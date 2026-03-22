/**
 * Admin Layout
 * ============
 * Usa BreadcrumbHeader em todas as telas da área administrativa.
 */

import { Stack } from 'expo-router';
import { BreadcrumbHeader } from '@/src/components/ui/BreadcrumbHeader';

const ADMIN: { label: string; href: '/admin' } = { label: 'Administração', href: '/admin' };

export default function AdminLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" options={{
        header: () => <BreadcrumbHeader items={[{ label: 'Administração' }]} />,
        headerShown: true,
      }} />
      <Stack.Screen name="dashboard" options={{
        header: () => <BreadcrumbHeader items={[ADMIN, { label: 'Dashboard' }]} />,
        headerShown: true,
      }} />
      <Stack.Screen name="entities" options={{
        header: () => <BreadcrumbHeader items={[ADMIN, { label: 'Entidades' }]} />,
        headerShown: true,
      }} />
      <Stack.Screen name="users" options={{
        header: () => <BreadcrumbHeader items={[ADMIN, { label: 'Usuários' }]} />,
        headerShown: true,
      }} />
      <Stack.Screen name="create-aviso" options={{
        header: () => <BreadcrumbHeader items={[ADMIN, { label: 'Criar Aviso' }]} />,
        headerShown: true,
      }} />
      <Stack.Screen name="sent-avisos" options={{
        header: () => <BreadcrumbHeader items={[ADMIN, { label: 'Avisos Enviados' }]} />,
        headerShown: true,
      }} />
      <Stack.Screen name="audit-logs" options={{
        header: () => <BreadcrumbHeader items={[ADMIN, { label: 'Logs de Auditoria' }]} />,
        headerShown: true,
      }} />
    </Stack>
  );
}
