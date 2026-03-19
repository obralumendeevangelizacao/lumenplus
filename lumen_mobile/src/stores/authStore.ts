/**
 * Auth Store
 * ==========
 * Estado global de autenticação.
 *
 * Autenticação é feita diretamente via Firebase nas telas (login.tsx, register.tsx).
 * Este store é responsável apenas por:
 *   - Inicializar o estado a partir da sessão Firebase persistida
 *   - Carregar os dados do usuário do backend (/auth/me)
 *   - Prover refreshUser para atualizar o estado após mudanças de perfil
 */

import { create } from 'zustand';
import { User } from '@/types';
import { authService } from '@/services';
import api from '@/services/api';
import { parseApiError } from '@/utils/error';

interface AuthState {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  error: string | null;

  // Actions
  initialize: () => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  clearError: () => void;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  isLoading: true,
  isAuthenticated: false,
  error: null,

  initialize: async () => {
    try {
      set({ isLoading: true, error: null });

      // Aguarda o Firebase resolver a sessão persistida antes de buscar o token.
      const token = await api.getToken();

      if (token) {
        const user = await authService.getMe();
        set({ user, isAuthenticated: true });
      }
    } catch {
      // Token inválido ou expirado — limpa sessão silenciosamente.
      await api.clearToken();
      set({ user: null, isAuthenticated: false });
    } finally {
      set({ isLoading: false });
    }
  },

  logout: async () => {
    await authService.logout();
    set({ user: null, isAuthenticated: false, error: null });
  },

  refreshUser: async () => {
    try {
      const user = await authService.getMe();
      set({ user });
    } catch {
      // Se falhar ao atualizar, desloga para não manter estado inconsistente.
      await get().logout();
    }
  },

  clearError: () => set({ error: null }),
}));
