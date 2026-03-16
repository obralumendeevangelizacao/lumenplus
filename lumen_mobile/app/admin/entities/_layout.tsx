import { Stack } from 'expo-router';

/**
 * O cabeçalho desta seção é gerenciado pelo Stack pai (admin/_layout.tsx),
 * que exibe "Entidades" com o botão de voltar correto.
 * A pilha interna existe apenas para suportar sub-rotas futuras dentro de
 * /admin/entities sem exibir um cabeçalho duplicado.
 */
export default function EntitiesLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
