/**
 * Firebase Configuration
 * ======================
 * Inicializa o Firebase App e Auth para uso universal (web + iOS + Android).
 * Os valores são lidos de variáveis de ambiente EXPO_PUBLIC_FIREBASE_*.
 *
 * Para desenvolvimento local: copie .env.example → .env.local e preencha os valores.
 * Para produção (Vercel/EAS): configure as variáveis no painel do serviço.
 */

import { Platform } from 'react-native';
import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getAuth,
  initializeAuth,
  getReactNativePersistence,
  Auth,
} from 'firebase/auth';

const firebaseConfig = {
  apiKey:            process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain:        process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId:         process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket:     process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId:             process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
  measurementId:     process.env.EXPO_PUBLIC_FIREBASE_MEASUREMENT_ID,
};

// Evita re-inicialização em hot reload
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

// Persistência nativa via AsyncStorage; web usa localStorage por padrão
function createAuth(): Auth {
  if (Platform.OS === 'web') {
    return getAuth(app);
  }
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const AsyncStorage = require('@react-native-async-storage/async-storage').default;
    return initializeAuth(app, {
      persistence: getReactNativePersistence(AsyncStorage),
    });
  } catch {
    // Já inicializado (hot reload) — retorna instância existente
    return getAuth(app);
  }
}

export const auth = createAuth();
export default app;
