/**
 * Tabs Layout
 * ===========
 * Layout das tabs principais do app com novo design.
 * Verifica se o perfil está completo (has_documents) e redireciona
 * para preenchimento de CPF/RG se necessário.
 */

import { useEffect } from 'react';
import { Tabs, router } from 'expo-router';
import { View, Image, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { authService, profileService } from '@/services';

const colors = {
  primary: '#1A859B',
  white: '#ffffff',
  gray: '#a3a3a3',
};

export default function TabsLayout() {
  useEffect(() => {
    (async () => {
      try {
        // 1. Verifica consentimento dos termos (LGPD) — tem prioridade
        const me = await authService.getMe();
        if (me.consents.pending_terms || me.consents.pending_privacy) {
          router.replace('/(onboarding)/terms');
          return;
        }

        // 2. Verifica documentos obrigatórios (CPF/RG)
        const profile = await profileService.getProfile();
        if (!profile.has_documents) {
          router.replace('/(onboarding)/complete-documents');
        }
      } catch {
        // Ignora erros de rede — não bloqueia a navegação
      }
    })();
  }, []);

  return (
    <Tabs
      screenOptions={{
        header: () => (
          <View style={styles.header}>
            <Image 
              source={require('../../assets/images/logo.png')} 
              style={styles.logo}
              resizeMode="contain"
            />
          </View>
        ),
        tabBarActiveTintColor: colors.white,
        tabBarInactiveTintColor: 'rgba(255,255,255,0.6)',
        tabBarStyle: {
          backgroundColor: colors.primary,
          borderTopWidth: 0,
          height: 70,
          paddingBottom: 10,
          paddingTop: 10,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '500',
        },
      }}
    >
      <Tabs.Screen
        name="service"
        options={{
          title: 'Orações',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? "book" : "book-outline"} size={24} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="community"
        options={{
          title: 'Convites',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? "mail-open" : "mail-open-outline"} size={24} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="home"
        options={{
          title: 'Início',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? "home" : "home-outline"} size={24} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="invites"
        options={{
          title: 'Inbox',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? "mail" : "mail-outline"} size={24} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Perfil',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? "person" : "person-outline"} size={24} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  header: {
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 50,
    paddingBottom: 15,
    paddingHorizontal: 16,
  },
  logo: {
    height: 30,
    width: 120,
  },
});
