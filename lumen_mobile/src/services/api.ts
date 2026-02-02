/**
 * API Client
 * ==========
 * Cliente HTTP usando fetch nativo (sem axios).
 */

import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

// URL do backend
const getBaseUrl = () => {
  if (!__DEV__) return 'https://api.lumenplus.app';
  
  if (Platform.OS === 'android') {
    return 'http://10.0.2.2:8000';
  }
  return 'http://localhost:8000';
};

const API_BASE_URL = getBaseUrl();
const TOKEN_KEY = 'auth_token';

class ApiClient {
  private token: string | null = null;

  async getToken(): Promise<string | null> {
    if (this.token) return this.token;
    
    try {
      this.token = await SecureStore.getItemAsync(TOKEN_KEY);
      return this.token;
    } catch {
      return null;
    }
  }

  async setToken(token: string): Promise<void> {
    this.token = token;
    await SecureStore.setItemAsync(TOKEN_KEY, token);
  }

  async clearToken(): Promise<void> {
    this.token = null;
    await SecureStore.deleteItemAsync(TOKEN_KEY);
  }

  async setDevToken(userId: string, email: string): Promise<void> {
    const devToken = `dev:${userId}:${email}`;
    await this.setToken(devToken);
  }

  private async request<T>(
    method: string,
    url: string,
    data?: Record<string, any>
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

    if (data && (method === 'POST' || method === 'PUT')) {
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

  async post<T>(url: string, data?: Record<string, any>): Promise<T> {
    return this.request<T>('POST', url, data);
  }

  async put<T>(url: string, data?: Record<string, any>): Promise<T> {
    return this.request<T>('PUT', url, data);
  }

  async delete<T>(url: string): Promise<T> {
    return this.request<T>('DELETE', url);
  }
}

export const api = new ApiClient();
export default api;