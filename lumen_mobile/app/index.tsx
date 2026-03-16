/**
 * Index Screen
 * ============
 * Verifica o estado do Firebase e redireciona:
 * - Logado → tabs/home
 * - Não logado → auth/login
 */

import { useEffect, useState } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { Redirect } from 'expo-router';
import { auth } from '@/config/firebase';

export default function Index() {
  const [isReady, setIsReady] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  useEffect(() => {
    auth.authStateReady().then(() => {
      setIsLoggedIn(!!auth.currentUser);
      setIsReady(true);
    });
  }, []);

  if (!isReady) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#1A859B' }}>
        <ActivityIndicator size="large" color="#ffffff" />
      </View>
    );
  }

  if (isLoggedIn) {
    return <Redirect href="/(tabs)/home" />;
  }

  return <Redirect href="/(auth)/login" />;
}
