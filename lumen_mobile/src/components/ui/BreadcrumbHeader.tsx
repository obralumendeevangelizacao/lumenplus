/**
 * BreadcrumbHeader
 * ================
 * Cabeçalho com trilha de navegação estilo breadcrumb.
 * Uso no _layout.tsx:
 *   <Stack.Screen name="index" options={{
 *     header: () => <BreadcrumbHeader items={[{ label: 'Seção' }]} />,
 *   }} />
 */

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { Href } from 'expo-router';

export interface BreadcrumbItem {
  label: string;
  /** Se informado, o item é clicável e navega para essa rota. */
  href?: Href;
}

interface Props {
  items: BreadcrumbItem[];
  /** Elemento opcional renderizado à direita do breadcrumb (ex: botões de ação). */
  right?: React.ReactNode;
}

export function BreadcrumbHeader({ items, right }: Props) {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.wrapper, { paddingTop: insets.top }]}>
      <View style={styles.row}>
        {/* Botão voltar */}
        <TouchableOpacity
          onPress={() => (router.canGoBack() ? router.back() : router.replace('/(tabs)/home' as Href))}
          style={styles.backBtn}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons name="chevron-back" size={20} color="#374151" />
        </TouchableOpacity>

        {/* Trilha */}
        <View style={styles.crumbs}>
          {/* Home */}
          <TouchableOpacity
            onPress={() => router.replace('/(tabs)/home' as Href)}
            hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
          >
            <Ionicons name="home" size={15} color="#2563eb" />
          </TouchableOpacity>

          {items.map((item, i) => (
            <View key={i} style={styles.item}>
              <Ionicons name="chevron-forward" size={12} color="#9ca3af" style={styles.sep} />
              {item.href ? (
                <TouchableOpacity onPress={() => router.push(item.href!)}>
                  <Text style={styles.link} numberOfLines={1}>{item.label}</Text>
                </TouchableOpacity>
              ) : (
                <Text style={styles.current} numberOfLines={1}>{item.label}</Text>
              )}
            </View>
          ))}
        </View>

        {right ? <View style={styles.right}>{right}</View> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    ...Platform.select({
      web: { boxShadow: '0 1px 3px rgba(0,0,0,0.06)' } as any,
      default: {
        shadowColor: '#000',
        shadowOpacity: 0.05,
        shadowRadius: 3,
        shadowOffset: { width: 0, height: 1 },
        elevation: 2,
      },
    }),
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 10,
    gap: 4,
  },
  backBtn: {
    padding: 4,
    borderRadius: 6,
  },
  right: {
    marginLeft: 'auto',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  crumbs: {
    flexDirection: 'row',
    alignItems: 'center',
    flexShrink: 1,
    flexWrap: 'nowrap',
    overflow: 'hidden',
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  sep: {
    marginHorizontal: 3,
  },
  link: {
    fontSize: 13,
    color: '#2563eb',
    fontWeight: '500',
  },
  current: {
    fontSize: 13,
    color: '#374151',
    fontWeight: '600',
  },
});
