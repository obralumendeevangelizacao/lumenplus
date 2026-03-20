/**
 * API Client
 * ==========
 * Cliente HTTP usando fetch nativo (sem axios).
 * Tokens são obtidos diretamente do Firebase Auth (sem SecureStore manual).
 */

import { Platform } from 'react-native';
import { signOut } from 'firebase/auth';
import { auth } from '@/config/firebase';

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
   * Obtém o ID Token do Firebase (auto-renova se expirado).
   * Retorna null se o usuário não está autenticado.
   */
  async getToken(): Promise<string | null> {
    try {
      // Aguarda o Firebase carregar a sessão persistida antes de pegar o token.
      // Sem isso há race condition: auth.currentUser é null na primeira renderização.
      await auth.authStateReady();
      return (await auth.currentUser?.getIdToken()) ?? null;
    } catch {
      return null;
    }
  }

  /**
   * Faz logout do Firebase.
   * Chamado automaticamente em respostas 401.
   */
  async clearToken(): Promise<void> {
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
