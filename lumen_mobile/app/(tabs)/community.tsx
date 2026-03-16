/**
 * Community Screen (Grupo)
 * ========================
 * Tela de grupos - Em construção.
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const colors = {
  primary: '#1A859B',
  gray: '#6b7280',
  lightGray: '#E8E8E8',
};

export default function CommunityScreen() {
  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <View style={styles.iconContainer}>
          <Ionicons name="construct-outline" size={64} color={colors.primary} />
        </View>
        <Text style={styles.title}>Em Construcao</Text>
        <Text style={styles.description}>
          Esta funcionalidade sera adicionada em breve.
        </Text>
        <Text style={styles.hint}>
          Aqui voce podera acompanhar as novidades do seu grupo da sua realidade vocacional. Contamos com sua oracao.
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.lightGray,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  iconContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(26, 133, 155, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#171717',
    marginBottom: 12,
  },
  description: {
    fontSize: 16,
    color: colors.gray,
    textAlign: 'center',
    marginBottom: 8,
  },
  hint: {
    fontSize: 14,
    color: colors.gray,
    textAlign: 'center',
    fontStyle: 'italic',
  },
});
