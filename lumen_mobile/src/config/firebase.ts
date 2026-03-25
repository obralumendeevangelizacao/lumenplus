/**
 * Firebase Configuration
 * ======================
 * Inicializa o Firebase App e Auth para uso universal (web + iOS + Android).
 * Os valores são lidos de variáveis de ambiente EXPO_PUBLIC_FIREBASE_*.
 *
 * Para desenvolvimento local: copie .env.example → .env.local e preencha os valores.
 * Para produção (Vercel/EAS): configure as variáveis no painel do serviço.
 *
 * Modo DEV (sem credenciais Firebase): IS_DEV_AUTH=true.
 * O auth exportado é um mock — tokens são gerenciados via AsyncStorage.
 */

import { Platform } from 'react-native';
import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import {
  getAuth,
  initializeAuth,
  getReactNativePersistence,
  Auth,
} from 'firebase/auth';

/** true quando não há credenciais Firebase configuradas (ambiente local/dev) */
export const IS_DEV_AUTH = !process.env.EXPO_PUBLIC_FIREBASE_API_KEY;

// Mock auth para modo DEV — evita crash por API key ausente
const mockAuth = {
  authStateReady: () => Promise.resolve(),
  get currentUser() { return null; },
  onAuthStateChanged: (_cb: (u: null) => void) => { _cb(null); return () => {}; },
} as unknown as Auth;

function initFirebase(): { app: FirebaseApp; auth: Auth } {
  const firebaseConfig = {
    apiKey:            process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
    authDomain:        process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId:         process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
    storageBucket:     process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId:             process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
    measurementId:     process.env.EXPO_PUBLIC_FIREBASE_MEASUREMENT_ID,
  };

  const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

  function createAuth(): Auth {
    if (Platform.OS === 'web') return getAuth(app);
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const AsyncStorage = require('@react-native-async-storage/async-storage').default;
      return initializeAuth(app, { persistence: getReactNativePersistence(AsyncStorage) });
    } catch {
      return getAuth(app);
    }
  }

  return { app, auth: createAuth() };
}

const firebase = IS_DEV_AUTH ? null : initFirebase();

export const auth: Auth = IS_DEV_AUTH ? mockAuth : firebase!.auth;
export default IS_DEV_AUTH ? {} as FirebaseApp : firebase!.app;
