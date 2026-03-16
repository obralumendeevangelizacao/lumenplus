import { Stack } from 'expo-router';

/**
 * O cabeçalho desta seção é gerenciado pelo Stack pai (admin/_layout.tsx),
 * que exibe "Gestão de Usuários" com o botão de voltar correto.
 * A pilha interna existe apenas para suportar sub-rotas futuras dentro de
 * /admin/users sem exibir um cabeçalho duplicado.
 */
export default function UsersAdminLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
