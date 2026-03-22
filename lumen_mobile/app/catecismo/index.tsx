/**
 * Catecismo — Tela Principal
 * ==========================
 * Três modos:
 *  1. Leitura integral paginada (30 parágrafos por página)
 *  2. Busca por palavra
 *  3. Ir diretamente ao §número
 */

import { useState, useMemo, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  FlatList,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { router, Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { buscar, getMeta, getTodosParagrafos } from '@/services/catecismo';

const PRIMARY = '#7c3aed';
const PRIMARY_LIGHT = 'rgba(124,58,237,0.1)';
const WHITE = '#ffffff';
const GRAY = '#6b7280';
const BG = '#f5f5f5';
const DARK = '#171717';

const PAGE_SIZE = 30;

// =============================================================================
// MODO: LEITURA INTEGRAL PAGINADA
// =============================================================================

function ModoLer() {
  const todos = useMemo(() => getTodosParagrafos(), []);
  const totalPaginas = Math.ceil(todos.length / PAGE_SIZE);
  const [pagina, setPagina] = useState(0);
  const listRef = useRef<FlatList>(null);

  const paragrafos = useMemo(
    () => todos.slice(pagina * PAGE_SIZE, (pagina + 1) * PAGE_SIZE),
    [pagina]
  );

  const irPagina = (p: number) => {
    setPagina(p);
    listRef.current?.scrollToOffset({ offset: 0, animated: false });
  };

  return (
    <View style={{ flex: 1 }}>
      <FlatList
        ref={listRef}
        data={paragrafos}
        keyExtractor={item => String(item.num)}
        contentContainerStyle={styles.lerContent}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.paraCard}
            onPress={() =>
              router.push({ pathname: '/catecismo/reader', params: { num: String(item.num) } })
            }
            activeOpacity={0.7}
          >
            <Text style={styles.paraNum}>§{item.num}</Text>
            <Text style={styles.paraTexto}>{item.texto}</Text>
          </TouchableOpacity>
        )}
        ListFooterComponent={
          <View style={styles.paginacao}>
            <TouchableOpacity
              style={[styles.pageBtn, pagina === 0 && styles.pageBtnDisabled]}
              onPress={() => irPagina(pagina - 1)}
              disabled={pagina === 0}
            >
              <Ionicons name="chevron-back" size={18} color={pagina === 0 ? GRAY : PRIMARY} />
              <Text style={[styles.pageBtnText, pagina === 0 && { color: GRAY }]}>Anterior</Text>
            </TouchableOpacity>

            <Text style={styles.pageInfo}>
              {pagina + 1} / {totalPaginas}
            </Text>

            <TouchableOpacity
              style={[styles.pageBtn, pagina >= totalPaginas - 1 && styles.pageBtnDisabled]}
              onPress={() => irPagina(pagina + 1)}
              disabled={pagina >= totalPaginas - 1}
            >
              <Text style={[styles.pageBtnText, pagina >= totalPaginas - 1 && { color: GRAY }]}>
                Próxima
              </Text>
              <Ionicons
                name="chevron-forward"
                size={18}
                color={pagina >= totalPaginas - 1 ? GRAY : PRIMARY}
              />
            </TouchableOpacity>
          </View>
        }
      />
    </View>
  );
}

// =============================================================================
// MODO: BUSCA
// =============================================================================

function ModoBusca() {
  const [query, setQuery] = useState('');
  const resultados = useMemo(
    () => (query.trim().length >= 3 ? buscar(query, 40) : []),
    [query]
  );

  return (
    <View style={{ flex: 1, padding: 16 }}>
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

      <FlatList
        data={resultados}
        keyExtractor={item => String(item.num)}
        keyboardShouldPersistTaps="handled"
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.resultCard}
            onPress={() =>
              router.push({ pathname: '/catecismo/reader', params: { num: String(item.num) } })
            }
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
        ListEmptyComponent={
          query.trim().length >= 3 ? (
            <Text style={styles.emptyText}>Nenhum resultado para "{query}".</Text>
          ) : null
        }
      />
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
// TELA PRINCIPAL
// =============================================================================

type Modo = 'ler' | 'busca' | 'numero';

export default function CatecismoScreen() {
  const [modo, setModo] = useState<Modo>('ler');

  const tabs: { key: Modo; label: string; icon: string }[] = [
    { key: 'ler', label: 'Ler', icon: 'book-outline' },
    { key: 'busca', label: 'Buscar', icon: 'search' },
    { key: 'numero', label: 'Ir ao §', icon: 'bookmark-outline' },
  ];

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: BG }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Stack.Screen options={{ title: 'Catecismo da Igreja Católica' }} />

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

      {modo === 'ler' && <ModoLer />}
      {modo === 'busca' && <ModoBusca />}
      {modo === 'numero' && (
        <View style={{ flex: 1 }}>
          <ModoNumero />
        </View>
      )}
    </KeyboardAvoidingView>
  );
}

// =============================================================================
// ESTILOS
// =============================================================================

const styles = StyleSheet.create({
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
  tabActive: { borderBottomColor: PRIMARY },
  tabLabel: { fontSize: 13, color: GRAY, fontWeight: '500' },
  tabLabelActive: { color: PRIMARY, fontWeight: '700' },

  // Leitura
  lerContent: { padding: 16, paddingBottom: 8 },
  paraCard: {
    backgroundColor: WHITE,
    borderRadius: 10,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    flexDirection: 'row',
    gap: 10,
  },
  paraNum: {
    fontSize: 11,
    color: PRIMARY,
    fontWeight: '700',
    width: 34,
    marginTop: 2,
    flexShrink: 0,
  },
  paraTexto: { flex: 1, fontSize: 15, color: '#374151', lineHeight: 23 },

  paginacao: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    paddingHorizontal: 8,
    marginTop: 4,
  },
  pageBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 10,
    backgroundColor: PRIMARY_LIGHT,
  },
  pageBtnDisabled: { opacity: 0.35 },
  pageBtnText: { fontSize: 14, color: PRIMARY, fontWeight: '600' },
  pageInfo: { fontSize: 14, color: GRAY, fontWeight: '500' },

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
  numeroInput: { fontSize: 28, color: DARK, minWidth: 80, fontWeight: '600' },
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
});
