/**
 * Index Screen
 * ============
 * Redireciona para tela de boas-vindas.
 */

import { Redirect } from 'expo-router';

export default function Index() {
  // Redireciona para tela de boas-vindas (auth)
  return <Redirect href="/(auth)" />;
}
