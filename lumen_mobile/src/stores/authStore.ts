/**
 * Auth Store
 * ==========
 * Estado global de autenticação.
 */

import { create } from 'zustand';
import { User } from '@/types';
import { authService } from '@/services';
import api from '@/services/api';

interface AuthState {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  error: string | null;
  
  // Actions
  initialize: () => Promise<void>;
  login: (email: string) => Promise<void>;
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
      
      // Verifica se tem token salvo
      const token = await api.getToken();
      
      if (token) {
        // Tenta carregar usuário
        const user = await authService.getMe();
        set({ user, isAuthenticated: true });
      }
    } catch (error) {
      // Token inválido ou expirado
      await api.clearToken();
      set({ user: null, isAuthenticated: false });
    } finally {
      set({ isLoading: false });
    }
  },

  login: async (email: string) => {
    try {
      set({ isLoading: true, error: null });
      
      // DEV mode - usa token fake
      const user = await authService.devLogin(email);
      set({ user, isAuthenticated: true });
    } catch (error: any) {
      const message = error.response?.data?.detail?.message || 'Erro ao fazer login';
      set({ error: message });
      throw error;
    } finally {
      set({ isLoading: false });
    }
  },

  logout: async () => {
    await authService.logout();
    set({ user: null, isAuthenticated: false });
  },

  refreshUser: async () => {
    try {
      const user = await authService.getMe();
      set({ user });
    } catch (error) {
      // Se falhar, desloga
      await get().logout();
    }
  },

  clearError: () => set({ error: null }),
}));
