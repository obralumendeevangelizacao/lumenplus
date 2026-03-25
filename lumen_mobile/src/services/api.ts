/**
 * API Client
 * ==========
 * Cliente HTTP usando fetch nativo (sem axios).
 * Em produção, tokens vêm do Firebase Auth.
 * Em modo DEV (sem credenciais Firebase), tokens são armazenados via AsyncStorage.
 */

import { Platform } from 'react-native';
import { signOut } from 'firebase/auth';
import { auth, IS_DEV_AUTH } from '@/config/firebase';

export const DEV_TOKEN_KEY = 'lumen_dev_token';

// Helpers de persistência do token DEV — usam AsyncStorage para funcionar
// em web, iOS e Android (localStorage não existe em React Native nativo).
// eslint-disable-next-line @typescript-eslint/no-var-requires
const AsyncStorage = () => require('@react-native-async-storage/async-storage').default;

export const getDevToken = (): Promise<string | null> =>
  AsyncStorage().getItem(DEV_TOKEN_KEY);

export const setDevToken = (token: string): Promise<void> =>
  AsyncStorage().setItem(DEV_TOKEN_KEY, token);

export const removeDevToken = (): Promise<void> =>
  AsyncStorage().removeItem(DEV_TOKEN_KEY);

// URL do backend
// Em produção: usa EXPO_PUBLIC_API_URL (injetado pelo Vercel/EAS no build)
// Em dev: usa localhost (ou 10.0.2.2 para emulador Android)
const getBaseUrl = () => {
  if (!__DEV__) {
    return process.env.EXPO_PUBLIC_API_URL ?? 'https://api.lumenplus.app';
  }
  // Android Emulator: 10.0.2.2 aponta para o localhost da máquina host
  // iOS Simulator / Web: localhost funciona diretamente
  if (Platform.OS === 'android') return 'http://10.0.2.2:8000';
  return 'http://localhost:8000';
};

const API_BASE_URL = getBaseUrl();

class ApiClient {
  /**
   * Obtém o token de autenticação.
   * Modo DEV: lê do AsyncStorage (funciona em web, iOS e Android).
   * Modo produção: obtém do Firebase Auth (auto-renova se expirado).
   */
  async getToken(): Promise<string | null> {
    if (IS_DEV_AUTH) {
      return getDevToken();
    }
    try {
      await auth.authStateReady();
      return (await auth.currentUser?.getIdToken()) ?? null;
    } catch {
      return null;
    }
  }

  /**
   * Limpa o token de autenticação.
   * Chamado automaticamente em respostas 401.
   */
  async clearToken(): Promise<void> {
    if (IS_DEV_AUTH) {
      await removeDevToken();
      return;
    }
    try {
      await signOut(auth);
    } catch {
      // Ignora erros de logout
    }
  }

  private async request<T>(
    method: string,
    url: string,
    data?: Record<string, unknown>
  ): Promise<T> {
    const token = await this.getToken();

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const config: RequestInit = {
      method,
      headers,
    };

    if (data && (method === 'POST' || method === 'PUT' || method === 'PATCH')) {
      config.body = JSON.stringify(data);
    }

    const response = await fetch(`${API_BASE_URL}${url}`, config);

    if (!response.ok) {
      if (response.status === 401) {
        await this.clearToken();
      }
      const error = await response.json().catch(() => ({}));
      throw { response: { status: response.status, data: error } };
    }

    return response.json();
  }

  async get<T>(url: string): Promise<T> {
    return this.request<T>('GET', url);
  }

  async post<T>(url: string, data?: Record<string, unknown>): Promise<T> {
    return this.request<T>('POST', url, data);
  }

  async put<T>(url: string, data?: Record<string, unknown>): Promise<T> {
    return this.request<T>('PUT', url, data);
  }

  async patch<T>(url: string, data?: Record<string, unknown>): Promise<T> {
    return this.request<T>('PATCH', url, data);
  }

  async delete<T>(url: string): Promise<T> {
    return this.request<T>('DELETE', url);
  }

  get baseUrl(): string {
    return API_BASE_URL;
  }

  /**
   * Envia multipart/form-data (usado para upload de comprovantes).
   */
  async postForm<T>(url: string, formData: FormData): Promise<T> {
    const token = await this.getToken();
    const headers: Record<string, string> = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const response = await fetch(`${API_BASE_URL}${url}`, {
      method: 'POST',
      headers,
      body: formData,
    });

    if (!response.ok) {
      if (response.status === 401) await this.clearToken();
      const error = await response.json().catch(() => ({}));
      throw { response: { status: response.status, data: error } };
    }
    return response.json();
  }
}

export const api = new ApiClient();
export default api;
