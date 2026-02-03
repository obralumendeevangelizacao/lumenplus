/**
 * Admin Layout
 * ============
 * Layout para área administrativa.
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
    />
  );
}
