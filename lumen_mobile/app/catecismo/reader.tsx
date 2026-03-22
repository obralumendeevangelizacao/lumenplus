/**
 * Catecismo — Leitor de Parágrafo
 * ================================
 * Exibe o parágrafo selecionado com contexto (parágrafos vizinhos).
 * Navegação prev/next, ajuste de fonte.
 */

import { useState, useRef, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { router, Stack, useLocalSearchParams, type Href } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { BreadcrumbHeader } from '@/src/components/ui/BreadcrumbHeader';
import {
  getParagrafo,
  getContexto,
  getParagrafoAnterior,
  getParagrafoProximo,
  getMeta,
  type Paragrafo,
} from '@/services/catecismo';

const PRIMARY = '#7c3aed';
const WHITE = '#ffffff';
const GRAY = '#6b7280';
const BG = '#f9fafb';
const CONTEXT_SIZE = 6; // parágrafos antes e depois

export default function CatecismoReaderScreen() {
  const params = useLocalSearchParams<{ num: string }>();
  const [num, setNum] = useState(parseInt(params.num ?? '1', 10));
  const [fontSize, setFontSize] = useState(16);
  const scrollRef = useRef<ScrollView>(null);
  const meta = getMeta();

  const paragrafo = getParagrafo(num);
  const contexto = getContexto(num, CONTEXT_SIZE * 2 + 1);
  const anterior = getParagrafoAnterior(num);
  const proximo = getParagrafoProximo(num);

  useEffect(() => {
    scrollRef.current?.scrollTo({ y: 0, animated: false });
  }, [num]);

  const irPara = useCallback((n: number) => {
    setNum(n);
  }, []);

  if (!paragrafo) {
    return (
      <View style={styles.centered}>
        <Text style={styles.notFoundText}>Parágrafo §{num} não encontrado.</Text>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.backLink}>Voltar</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const breadcrumb = [
    paragrafo.parte_titulo,
    paragrafo.secao_titulo,
    paragrafo.capitulo_titulo,
    paragrafo.artigo_titulo,
  ]
    .filter(Boolean)
    .join(' › ');

  return (
    <>
      <Stack.Screen
        options={{
          header: () => (
            <BreadcrumbHeader
              items={[
                { label: 'Catecismo', href: '/catecismo' as Href },
                { label: `§${num}` },
              ]}
              right={
                <View style={styles.headerActions}>
                  <TouchableOpacity onPress={() => setFontSize(s => Math.max(12, s - 2))} style={styles.headerBtn}>
                    <Text style={styles.headerBtnTextSm}>A-</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => setFontSize(s => Math.min(26, s + 2))} style={styles.headerBtn}>
                    <Text style={styles.headerBtnTextLg}>A+</Text>
                  </TouchableOpacity>
                </View>
              }
            />
          ),
        }}
      />

      <View style={styles.container}>
        {/* Breadcrumb */}
        {breadcrumb ? (
          <View style={styles.breadcrumb}>
            <Text style={styles.breadcrumbText} numberOfLines={2}>
              {breadcrumb}
            </Text>
          </View>
        ) : null}

        <ScrollView
          ref={scrollRef}
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
        >
          {contexto.map(p => (
            <TouchableOpacity
              key={p.num}
              style={[styles.paragrafoCard, p.num === num && styles.paragrafoCardActive]}
              onPress={() => irPara(p.num)}
              activeOpacity={p.num === num ? 1 : 0.7}
            >
              <Text
                style={[styles.paraNum, p.num === num && styles.paraNumActive]}
              >
                §{p.num}
              </Text>
              <Text
                style={[
                  styles.paraTexto,
                  { fontSize },
                  p.num === num && styles.paraTextoActive,
                ]}
              >
                {p.texto}
              </Text>
            </TouchableOpacity>
          ))}

          <View style={{ height: 32 }} />
        </ScrollView>

        {/* Navegação */}
        <View style={styles.bottomNav}>
          <TouchableOpacity
            style={[styles.navBtn, !anterior && styles.navBtnDisabled]}
            onPress={() => anterior && irPara(anterior.num)}
            disabled={!anterior}
          >
            <Ionicons
              name="chevron-back"
              size={20}
              color={anterior ? PRIMARY : GRAY}
            />
            <Text style={[styles.navBtnText, !anterior && { color: GRAY }]}>
              §{anterior?.num ?? '—'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.numPill}
            onPress={() => router.push('/catecismo' as any)}
          >
            <Text style={styles.numPillText}>§{num}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.navBtn, !proximo && styles.navBtnDisabled]}
            onPress={() => proximo && irPara(proximo.num)}
            disabled={!proximo}
          >
            <Text style={[styles.navBtnText, !proximo && { color: GRAY }]}>
              §{proximo?.num ?? '—'}
            </Text>
            <Ionicons
              name="chevron-forward"
              size={20}
              color={proximo ? PRIMARY : GRAY}
            />
          </TouchableOpacity>
        </View>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  notFoundText: { fontSize: 16, color: GRAY, marginBottom: 12 },
  backLink: { fontSize: 15, color: PRIMARY, fontWeight: '600' },

  headerActions: { flexDirection: 'row', gap: 4 },
  headerBtn: { padding: 6 },
  headerBtnTextSm: { fontSize: 13, color: WHITE, fontWeight: '600' },
  headerBtnTextLg: { fontSize: 15, color: WHITE, fontWeight: '700' },

  breadcrumb: {
    backgroundColor: `${PRIMARY}12`,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: `${PRIMARY}20`,
  },
  breadcrumbText: { fontSize: 11, color: PRIMARY, fontWeight: '500' },

  scroll: { flex: 1 },
  scrollContent: { padding: 16 },

  paragrafoCard: {
    flexDirection: 'row',
    marginBottom: 14,
    padding: 12,
    borderRadius: 10,
    backgroundColor: WHITE,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  paragrafoCardActive: {
    borderColor: PRIMARY,
    borderWidth: 2,
    backgroundColor: '#faf5ff',
  },
  paraNum: {
    fontSize: 11,
    color: GRAY,
    fontWeight: '700',
    width: 36,
    marginTop: 2,
    flexShrink: 0,
  },
  paraNumActive: { color: PRIMARY },
  paraTexto: {
    flex: 1,
    color: '#374151',
    lineHeight: 26,
  },
  paraTextoActive: { color: '#1f1f1f' },

  bottomNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: WHITE,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  navBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    padding: 8,
    minWidth: 70,
  },
  navBtnDisabled: { opacity: 0.35 },
  navBtnText: { fontSize: 13, color: PRIMARY, fontWeight: '600' },
  numPill: {
    backgroundColor: PRIMARY,
    borderRadius: 20,
    paddingHorizontal: 20,
    paddingVertical: 8,
  },
  numPillText: { fontSize: 14, color: WHITE, fontWeight: '700' },
});
