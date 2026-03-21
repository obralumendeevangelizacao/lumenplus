/**
 * Catecismo — Tela Principal
 * ==========================
 * Três modos de acesso:
 *  1. Busca por palavra
 *  2. Ir diretamente ao §número
 *  3. Índice hierárquico (Parte > Seção > Capítulo > Artigo)
 */

import { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  FlatList,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { router, Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import {
  buscar,
  getEstrutura,
  getMeta,
  type Paragrafo,
  type ParteEstrutura,
  type SecaoEstrutura,
  type CapituloEstrutura,
} from '@/services/catecismo';

const PRIMARY = '#7c3aed';
const PRIMARY_LIGHT = 'rgba(124,58,237,0.1)';
const WHITE = '#ffffff';
const GRAY = '#6b7280';
const BG = '#f5f5f5';
const DARK = '#171717';

// =============================================================================
// MODO: BUSCA
// =============================================================================

function ModoBusca() {
  const [query, setQuery] = useState('');
  const resultados = useMemo(
    () => (query.trim().length >= 3 ? buscar(query, 40) : []),
    [query]
  );

  const abrirParagrafo = (num: number) => {
    router.push({ pathname: '/catecismo/reader', params: { num: String(num) } });
  };

  return (
    <View style={{ flex: 1 }}>
      <View style={styles.searchBox}>
        <Ionicons name="search" size={18} color={GRAY} style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Buscar no Catecismo..."
          placeholderTextColor={GRAY}
          value={query}
          onChangeText={setQuery}
          returnKeyType="search"
          autoFocus
        />
        {query.length > 0 && (
          <TouchableOpacity onPress={() => setQuery('')}>
            <Ionicons name="close-circle" size={18} color={GRAY} />
          </TouchableOpacity>
        )}
      </View>

      {query.trim().length > 0 && query.trim().length < 3 && (
        <Text style={styles.hintText}>Digite pelo menos 3 caracteres</Text>
      )}

      {resultados.length > 0 && (
        <FlatList
          data={resultados}
          keyExtractor={item => String(item.num)}
          keyboardShouldPersistTaps="handled"
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.resultCard}
              onPress={() => abrirParagrafo(item.num)}
              activeOpacity={0.7}
            >
              <View style={styles.resultHeader}>
                <View style={styles.numBadge}>
                  <Text style={styles.numBadgeText}>§{item.num}</Text>
                </View>
                {item.artigo_titulo ? (
                  <Text style={styles.resultCtx} numberOfLines={1}>
                    {item.artigo_titulo}
                  </Text>
                ) : null}
              </View>
              <Text style={styles.resultTexto} numberOfLines={3}>
                {item.texto}
              </Text>
            </TouchableOpacity>
          )}
        />
      )}

      {query.trim().length >= 3 && resultados.length === 0 && (
        <Text style={styles.emptyText}>Nenhum resultado para "{query}".</Text>
      )}
    </View>
  );
}

// =============================================================================
// MODO: IR AO §
// =============================================================================

function ModoNumero() {
  const meta = getMeta();
  const [input, setInput] = useState('');
  const [error, setError] = useState('');

  const ir = () => {
    const num = parseInt(input, 10);
    if (isNaN(num) || num < meta.num_inicio || num > meta.num_fim) {
      setError(`Digite um número entre ${meta.num_inicio} e ${meta.num_fim}`);
      return;
    }
    setError('');
    router.push({ pathname: '/catecismo/reader', params: { num: String(num) } });
  };

  return (
    <View style={styles.numeroContainer}>
      <Ionicons name="bookmark" size={48} color={PRIMARY} style={{ marginBottom: 16 }} />
      <Text style={styles.numeroTitle}>Ir ao Parágrafo</Text>
      <Text style={styles.numeroSubtitle}>
        §{meta.num_inicio} — §{meta.num_fim}
      </Text>

      <View style={styles.numeroInputRow}>
        <Text style={styles.paragSymbol}>§</Text>
        <TextInput
          style={styles.numeroInput}
          keyboardType="number-pad"
          placeholder="Ex.: 27"
          placeholderTextColor={GRAY}
          value={input}
          onChangeText={v => { setInput(v); setError(''); }}
          onSubmitEditing={ir}
          returnKeyType="go"
          maxLength={4}
        />
      </View>

      {error ? <Text style={styles.errorText}>{error}</Text> : null}

      <TouchableOpacity
        style={[styles.irBtn, !input && styles.irBtnDisabled]}
        onPress={ir}
        disabled={!input}
      >
        <Text style={styles.irBtnText}>Ir</Text>
        <Ionicons name="arrow-forward" size={18} color={WHITE} />
      </TouchableOpacity>
    </View>
  );
}

// =============================================================================
// MODO: ÍNDICE HIERÁRQUICO
// =============================================================================

function ModoIndice() {
  const estrutura = getEstrutura();
  const [expandidos, setExpandidos] = useState<Set<string>>(new Set());

  const toggle = (key: string) => {
    setExpandidos(prev => {
      const n = new Set(prev);
      n.has(key) ? n.delete(key) : n.add(key);
      return n;
    });
  };

  const abrirArtigo = (paragrafoInicio: number) => {
    router.push({ pathname: '/catecismo/reader', params: { num: String(paragrafoInicio) } });
  };

  return (
    <ScrollView style={{ flex: 1 }} keyboardShouldPersistTaps="handled">
      {estrutura.map((parte, pi) => {
        const parteKey = `p${pi}`;
        const parteOpen = expandidos.has(parteKey);
        return (
          <View key={parteKey} style={styles.parteSection}>
            <TouchableOpacity
              style={styles.parteHeader}
              onPress={() => toggle(parteKey)}
              activeOpacity={0.7}
            >
              <Text style={styles.parteTitulo} numberOfLines={2}>
                {parte.titulo || `Parte ${pi + 1}`}
              </Text>
              <Ionicons
                name={parteOpen ? 'chevron-up' : 'chevron-down'}
                size={18}
                color={WHITE}
              />
            </TouchableOpacity>

            {parteOpen &&
              parte.secoes.map((secao, si) => {
                const secaoKey = `${parteKey}s${si}`;
                const secaoOpen = expandidos.has(secaoKey);
                return (
                  <View key={secaoKey} style={styles.secaoSection}>
                    {secao.titulo ? (
                      <TouchableOpacity
                        style={styles.secaoHeader}
                        onPress={() => toggle(secaoKey)}
                        activeOpacity={0.7}
                      >
                        <Text style={styles.secaoTitulo} numberOfLines={2}>
                          {secao.titulo}
                        </Text>
                        <Ionicons
                          name={secaoOpen ? 'chevron-up' : 'chevron-down'}
                          size={16}
                          color={PRIMARY}
                        />
                      </TouchableOpacity>
                    ) : null}

                    {(!secao.titulo || secaoOpen) &&
                      secao.capitulos.map((cap, ci) => {
                        const capKey = `${secaoKey}c${ci}`;
                        const capOpen = expandidos.has(capKey);
                        return (
                          <View key={capKey} style={styles.capSection}>
                            {cap.titulo ? (
                              <TouchableOpacity
                                style={styles.capHeader}
                                onPress={() => toggle(capKey)}
                                activeOpacity={0.7}
                              >
                                <Text style={styles.capTitulo} numberOfLines={2}>
                                  {cap.titulo}
                                </Text>
                                <Ionicons
                                  name={capOpen ? 'chevron-up' : 'chevron-down'}
                                  size={14}
                                  color={GRAY}
                                />
                              </TouchableOpacity>
                            ) : null}

                            {(!cap.titulo || capOpen) &&
                              cap.artigos.map((art, ai) => (
                                <TouchableOpacity
                                  key={ai}
                                  style={styles.artigoRow}
                                  onPress={() => abrirArtigo(art.paragrafo_inicio)}
                                  activeOpacity={0.7}
                                >
                                  <View>
                                    {art.num ? (
                                      <Text style={styles.artigoNum}>
                                        Artigo {art.num}
                                      </Text>
                                    ) : null}
                                    <Text style={styles.artigoTitulo} numberOfLines={2}>
                                      {art.titulo || `§${art.paragrafo_inicio}`}
                                    </Text>
                                    <Text style={styles.artigoRange}>
                                      §{art.paragrafo_inicio}–§{art.paragrafo_fim}
                                    </Text>
                                  </View>
                                  <Ionicons name="chevron-forward" size={16} color={GRAY} />
                                </TouchableOpacity>
                              ))}
                          </View>
                        );
                      })}
                  </View>
                );
              })}
          </View>
        );
      })}
      <View style={{ height: 32 }} />
    </ScrollView>
  );
}

// =============================================================================
// TELA PRINCIPAL
// =============================================================================

type Modo = 'busca' | 'numero' | 'indice';

export default function CatecismoScreen() {
  const [modo, setModo] = useState<Modo>('indice');

  const tabs: { key: Modo; label: string; icon: string }[] = [
    { key: 'indice', label: 'Índice', icon: 'list' },
    { key: 'busca', label: 'Buscar', icon: 'search' },
    { key: 'numero', label: 'Ir ao §', icon: 'bookmark' },
  ];

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: BG }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Stack.Screen options={{ title: 'Catecismo da Igreja Católica' }} />

      {/* Tab bar */}
      <View style={styles.tabBar}>
        {tabs.map(tab => (
          <TouchableOpacity
            key={tab.key}
            style={[styles.tab, modo === tab.key && styles.tabActive]}
            onPress={() => setModo(tab.key)}
          >
            <Ionicons
              name={tab.icon as any}
              size={18}
              color={modo === tab.key ? PRIMARY : GRAY}
            />
            <Text style={[styles.tabLabel, modo === tab.key && styles.tabLabelActive]}>
              {tab.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Conteúdo do modo */}
      <View style={{ flex: 1, padding: modo === 'indice' ? 0 : 16 }}>
        {modo === 'busca' && <ModoBusca />}
        {modo === 'numero' && <ModoNumero />}
        {modo === 'indice' && <ModoIndice />}
      </View>
    </KeyboardAvoidingView>
  );
}

// =============================================================================
// ESTILOS
// =============================================================================

const styles = StyleSheet.create({
  // Tab bar
  tabBar: {
    flexDirection: 'row',
    backgroundColor: WHITE,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabActive: {
    borderBottomColor: PRIMARY,
  },
  tabLabel: { fontSize: 13, color: GRAY, fontWeight: '500' },
  tabLabelActive: { color: PRIMARY, fontWeight: '700' },

  // Busca
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: WHITE,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  searchIcon: { marginRight: 8 },
  searchInput: { flex: 1, fontSize: 15, color: DARK },
  hintText: { fontSize: 13, color: GRAY, textAlign: 'center', marginTop: 8 },
  emptyText: { fontSize: 14, color: GRAY, textAlign: 'center', marginTop: 24 },
  resultCard: {
    backgroundColor: WHITE,
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  resultHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  numBadge: {
    backgroundColor: PRIMARY_LIGHT,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  numBadgeText: { fontSize: 12, color: PRIMARY, fontWeight: '700' },
  resultCtx: { flex: 1, fontSize: 12, color: GRAY },
  resultTexto: { fontSize: 14, color: '#374151', lineHeight: 20 },

  // Número
  numeroContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  numeroTitle: { fontSize: 22, fontWeight: '700', color: DARK, marginBottom: 4 },
  numeroSubtitle: { fontSize: 14, color: GRAY, marginBottom: 32 },
  numeroInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: WHITE,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: PRIMARY,
    paddingHorizontal: 16,
    paddingVertical: 4,
    marginBottom: 12,
  },
  paragSymbol: { fontSize: 28, color: PRIMARY, fontWeight: '700', marginRight: 8 },
  numeroInput: {
    fontSize: 28,
    color: DARK,
    minWidth: 80,
    fontWeight: '600',
  },
  errorText: { fontSize: 13, color: '#ef4444', marginBottom: 12 },
  irBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: PRIMARY,
    borderRadius: 12,
    paddingHorizontal: 32,
    paddingVertical: 14,
  },
  irBtnDisabled: { opacity: 0.4 },
  irBtnText: { fontSize: 16, color: WHITE, fontWeight: '700' },

  // Índice
  parteSection: { marginBottom: 2 },
  parteHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: PRIMARY,
    padding: 14,
    paddingHorizontal: 16,
  },
  parteTitulo: { flex: 1, fontSize: 15, fontWeight: '700', color: WHITE, marginRight: 8 },

  secaoSection: { backgroundColor: WHITE },
  secaoHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    paddingHorizontal: 16,
    backgroundColor: PRIMARY_LIGHT,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  secaoTitulo: { flex: 1, fontSize: 13, fontWeight: '600', color: PRIMARY, marginRight: 8 },

  capSection: {},
  capHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
    backgroundColor: '#fafafa',
  },
  capTitulo: { flex: 1, fontSize: 13, fontWeight: '600', color: DARK, marginRight: 8 },

  artigoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  artigoNum: { fontSize: 11, color: PRIMARY, fontWeight: '700', marginBottom: 2 },
  artigoTitulo: { fontSize: 14, color: DARK, maxWidth: 260 },
  artigoRange: { fontSize: 11, color: GRAY, marginTop: 2 },
});
