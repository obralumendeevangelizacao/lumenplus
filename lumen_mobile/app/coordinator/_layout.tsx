/**
 * Coordinator Layout
 * ==================
 */

import { Stack } from 'expo-router';
import { BreadcrumbHeader } from '@/src/components/ui/BreadcrumbHeader';

export default function CoordinatorLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" options={{
        header: () => <BreadcrumbHeader items={[{ label: 'Minha Coordenação' }]} />,
        headerShown: true,
      }} />
    </Stack>
  );
}
