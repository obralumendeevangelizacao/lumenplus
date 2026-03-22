/**
 * Bíblia Layout
 * =============
 */

import { Stack } from 'expo-router';
import { BreadcrumbHeader } from '@/src/components/ui/BreadcrumbHeader';

const BIBLIA: { label: string; href: '/biblia' } = { label: 'Sagradas Escrituras', href: '/biblia' };

export default function BibliaLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" options={{
        header: () => <BreadcrumbHeader items={[{ label: 'Sagradas Escrituras' }]} />,
        headerShown: true,
      }} />
      <Stack.Screen name="reader" options={{
        header: () => <BreadcrumbHeader items={[BIBLIA, { label: 'Leitura' }]} />,
        headerShown: true,
      }} />
    </Stack>
  );
}
