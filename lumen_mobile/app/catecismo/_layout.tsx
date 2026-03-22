/**
 * Catecismo Layout
 * ================
 */

import { Stack } from 'expo-router';
import { BreadcrumbHeader } from '@/src/components/ui/BreadcrumbHeader';

const CATECISMO: { label: string; href: '/catecismo' } = { label: 'Catecismo', href: '/catecismo' };

export default function CatecismoLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" options={{
        header: () => <BreadcrumbHeader items={[{ label: 'Catecismo da Igreja Católica' }]} />,
        headerShown: true,
      }} />
      <Stack.Screen name="reader" options={{
        header: () => <BreadcrumbHeader items={[CATECISMO, { label: 'Leitura' }]} />,
        headerShown: true,
      }} />
    </Stack>
  );
}
