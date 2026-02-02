/**
 * Onboarding Store
 * ================
 * Estado do fluxo de onboarding.
 */

import { create } from 'zustand';
import { Catalog, LatestLegal, Profile } from '@/types';
import { profileService, legalService } from '@/services';

interface OnboardingState {
  // Data
  catalogs: Catalog[];
  legal: LatestLegal | null;
  profile: Profile | null;
  
  // Loading states
  isLoadingCatalogs: boolean;
  isLoadingLegal: boolean;
  isLoadingProfile: boolean;
  isSaving: boolean;
  
  // Error
  error: string | null;
  
  // Actions
  loadCatalogs: () => Promise<void>;
  loadLegal: () => Promise<void>;
  loadProfile: () => Promise<void>;
  acceptTerms: (analyticsOptIn?: boolean) => Promise<void>;
  saveProfile: (data: any) => Promise<void>;
  clearError: () => void;
}

export const useOnboardingStore = create<OnboardingState>((set, get) => ({
  catalogs: [],
  legal: null,
  profile: null,
  isLoadingCatalogs: false,
  isLoadingLegal: false,
  isLoadingProfile: false,
  isSaving: false,
  error: null,

  loadCatalogs: async () => {
    try {
      set({ isLoadingCatalogs: true, error: null });
      const catalogs = await profileService.getCatalogs();
      set({ catalogs });
    } catch (error: any) {
      set({ error: error.response?.data?.detail?.message || 'Erro ao carregar catálogos' });
    } finally {
      set({ isLoadingCatalogs: false });
    }
  },

  loadLegal: async () => {
    try {
      set({ isLoadingLegal: true, error: null });
      const legal = await legalService.getLatest();
      set({ legal });
    } catch (error: any) {
      set({ error: error.response?.data?.detail?.message || 'Erro ao carregar termos' });
    } finally {
      set({ isLoadingLegal: false });
    }
  },

  loadProfile: async () => {
    try {
      set({ isLoadingProfile: true, error: null });
      const profile = await profileService.getProfile();
      set({ profile });
    } catch (error: any) {
      set({ error: error.response?.data?.detail?.message || 'Erro ao carregar perfil' });
    } finally {
      set({ isLoadingProfile: false });
    }
  },

  acceptTerms: async (analyticsOptIn = false) => {
    const { legal } = get();
    if (!legal?.terms || !legal?.privacy) {
      set({ error: 'Termos não carregados' });
      return;
    }

    try {
      set({ isSaving: true, error: null });
      await legalService.accept({
        terms_version: legal.terms.version,
        privacy_version: legal.privacy.version,
        analytics_opt_in: analyticsOptIn,
        push_opt_in: true,
      });
    } catch (error: any) {
      set({ error: error.response?.data?.detail?.message || 'Erro ao aceitar termos' });
      throw error;
    } finally {
      set({ isSaving: false });
    }
  },

  saveProfile: async (data) => {
    try {
      set({ isSaving: true, error: null });
      const profile = await profileService.updateProfile(data);
      set({ profile });
    } catch (error: any) {
      const message = error.response?.data?.detail?.message || 'Erro ao salvar perfil';
      set({ error: message });
      throw error;
    } finally {
      set({ isSaving: false });
    }
  },

  clearError: () => set({ error: null }),
}));
