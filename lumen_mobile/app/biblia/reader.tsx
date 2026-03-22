/**
 * Sagradas Escrituras — Leitor de Capítulo
 * ==========================================
 * Exibe os versículos de um capítulo com navegação prev/next.
 */

import { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal,
  FlatList,
} from 'react-native';
import { router, Stack, useLocalSearchParams, type Href } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { getLivro, getTodosOsLivros, type Livro } from '@/services/bible';
import { BreadcrumbHeader } from '@/src/components/ui/BreadcrumbHeader';

const PRIMARY = '#1A859B';
const WHITE = '#ffffff';
const GRAY = '#6b7280';
const BG = '#f9fafb';

export default function ReaderScreen() {
  const params = useLocalSearchParams<{
    livroIndex: string;
    capitulo: string;
    livroNome: string;
  }>();

  const [livroIndex, setLivroIndex] = useState(parseInt(params.livroIndex ?? '0', 10));
  const [capNum, setCapNum] = useState(parseInt(params.capitulo ?? '1', 10));
  const [fontSize, setFontSize] = useState(16);
  const [modalLivros, setModalLivros] = useState(false);
  const [modalCaps, setModalCaps] = useState(false);
  const scrollRef = useRef<ScrollView>(null);

  const livro = getLivro(livroIndex);
  const capitulo = livro?.capitulos.find(c => c.capitulo === capNum) ?? livro?.capitulos[0];
  const totalCaps = livro?.capitulos.length ?? 0;
  const todosOsLivros = getTodosOsLivros();

  // Scroll ao topo quando mudar capítulo ou livro
  useEffect(() => {
    scrollRef.current?.scrollTo({ y: 0, animated: false });
  }, [livroIndex, capNum]);

  if (!livro || !capitulo) return null;

  const irParaCapitulo = (num: number) => {
    if (num >= 1 && num <= totalCaps) setCapNum(num);
  };

  const anterior = () => {
    if (capNum > 1) {
      setCapNum(capNum - 1);
    } else if (livroIndex > 0) {
      const prev = getLivro(livroIndex - 1);
      if (prev) {
        setLivroIndex(livroIndex - 1);
        setCapNum(prev.capitulos.length);
      }
    }
  };

  const proximo = () => {
    if (capNum < totalCaps) {
      setCapNum(capNum + 1);
    } else if (livroIndex < 72) {
      setLivroIndex(livroIndex + 1);
      setCapNum(1);
    }
  };

  const temAnterior = capNum > 1 || livroIndex > 0;
  const temProximo = capNum < totalCaps || livroIndex < 72;

  return (
    <>
      <Stack.Screen
        options={{
          header: () => (
            <BreadcrumbHeader
              items={[
                { label: 'Sagradas Escrituras', href: '/biblia' as Href },
                { label: livro.nome },
              ]}
              right={
                <View style={styles.headerActions}>
                  <TouchableOpacity onPress={() => setFontSize(s => Math.max(12, s - 2))} style={styles.headerBtn}>
                    <Text style={styles.headerBtnText}>A-</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => setFontSize(s => Math.min(26, s + 2))} style={styles.headerBtn}>
                    <Text style={styles.headerBtnTextBig}>A+</Text>
                  </TouchableOpacity>
                </View>
              }
            />
          ),
        }}
      />

      <View style={styles.container}>
        {/* Barra de navegação — livro e capítulo */}
        <View style={styles.navBar}>
          <TouchableOpacity style={styles.navPill} onPress={() => setModalLivros(true)}>
            <Text style={styles.navPillText} numberOfLines={1}>{livro.nome}</Text>
            <Ionicons name="chevron-down" size={14} color={PRIMARY} />
          </TouchableOpacity>

          <TouchableOpacity style={styles.navPill} onPress={() => setModalCaps(true)}>
            <Text style={styles.navPillText}>Cap. {capNum}</Text>
            <Ionicons name="chevron-down" size={14} color={PRIMARY} />
          </TouchableOpacity>
        </View>

        {/* Texto */}
        <ScrollView
          ref={scrollRef}
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
        >
          <Text style={styles.capHeader}>{livro.nome} {capNum}</Text>

          {capitulo.versiculos.map(v => (
            <View key={v.versiculo} style={styles.versiculoRow}>
              <Text style={styles.versNum}>{v.versiculo}</Text>
              <Text style={[styles.versText, { fontSize }]}>{v.texto}</Text>
            </View>
          ))}

          <View style={{ height: 32 }} />
        </ScrollView>

        {/* Navegação prev/next */}
        <View style={styles.bottomNav}>
          <TouchableOpacity
            style={[styles.navBtn, !temAnterior && styles.navBtnDisabled]}
            onPress={anterior}
            disabled={!temAnterior}
          >
            <Ionicons name="chevron-back" size={20} color={temAnterior ? PRIMARY : GRAY} />
            <Text style={[styles.navBtnText, !temAnterior && { color: GRAY }]}>Anterior</Text>
          </TouchableOpacity>

          <Text style={styles.progressText}>{capNum} / {totalCaps}</Text>

          <TouchableOpacity
            style={[styles.navBtn, !temProximo && styles.navBtnDisabled]}
            onPress={proximo}
            disabled={!temProximo}
          >
            <Text style={[styles.navBtnText, !temProximo && { color: GRAY }]}>Próximo</Text>
            <Ionicons name="chevron-forward" size={20} color={temProximo ? PRIMARY : GRAY} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Modal: selecionar livro */}
      <Modal visible={modalLivros} animationType="slide" presentationStyle="pageSheet">
        <View style={styles.modal}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Selecionar livro</Text>
            <TouchableOpacity onPress={() => setModalLivros(false)}>
              <Ionicons name="close" size={24} color="#171717" />
            </TouchableOpacity>
          </View>
          <FlatList
            data={todosOsLivros}
            keyExtractor={item => String(item.index)}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={[styles.modalItem, item.index === livroIndex && styles.modalItemActive]}
                onPress={() => {
                  setLivroIndex(item.index);
                  setCapNum(1);
                  setModalLivros(false);
                }}
              >
                <Text style={[styles.modalItemText, item.index === livroIndex && styles.modalItemTextActive]}>
                  {item.nome}
                </Text>
                {item.index === livroIndex && (
                  <Ionicons name="checkmark" size={18} color={PRIMARY} />
                )}
              </TouchableOpacity>
            )}
          />
        </View>
      </Modal>

      {/* Modal: selecionar capítulo */}
      <Modal visible={modalCaps} animationType="slide" presentationStyle="pageSheet">
        <View style={styles.modal}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Capítulo</Text>
            <TouchableOpacity onPress={() => setModalCaps(false)}>
              <Ionicons name="close" size={24} color="#171717" />
            </TouchableOpacity>
          </View>
          <FlatList
            data={livro.capitulos}
            keyExtractor={item => String(item.capitulo)}
            numColumns={5}
            contentContainerStyle={styles.capsGrid}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={[styles.capPill, item.capitulo === capNum && styles.capPillActive]}
                onPress={() => {
                  irParaCapitulo(item.capitulo);
                  setModalCaps(false);
                }}
              >
                <Text style={[styles.capPillText, item.capitulo === capNum && styles.capPillTextActive]}>
                  {item.capitulo}
                </Text>
              </TouchableOpacity>
            )}
          />
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG },

  headerActions: { flexDirection: 'row', gap: 4 },
  headerBtn: { padding: 6 },
  headerBtnText: { fontSize: 14, color: PRIMARY, fontWeight: '600' },
  headerBtnTextBig: { fontSize: 16, color: PRIMARY, fontWeight: '700' },

  navBar: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: WHITE,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  navPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: `${PRIMARY}15`,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  navPillText: { fontSize: 14, color: PRIMARY, fontWeight: '600', maxWidth: 160 },

  scroll: { flex: 1 },
  scrollContent: { padding: 20 },
  capHeader: {
    fontSize: 20,
    fontWeight: '700',
    color: '#171717',
    marginBottom: 20,
    textAlign: 'center',
  },
  versiculoRow: {
    flexDirection: 'row',
    marginBottom: 10,
    alignItems: 'flex-start',
  },
  versNum: {
    fontSize: 11,
    color: PRIMARY,
    fontWeight: '700',
    width: 28,
    marginTop: 3,
  },
  versText: {
    flex: 1,
    color: '#374151',
    lineHeight: 26,
  },

  bottomNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: WHITE,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  navBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, padding: 8 },
  navBtnDisabled: { opacity: 0.4 },
  navBtnText: { fontSize: 14, color: PRIMARY, fontWeight: '600' },
  progressText: { fontSize: 13, color: GRAY },

  modal: { flex: 1, backgroundColor: WHITE },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  modalTitle: { fontSize: 18, fontWeight: '700', color: '#171717' },
  modalItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  modalItemActive: { backgroundColor: `${PRIMARY}10` },
  modalItemText: { fontSize: 16, color: '#374151' },
  modalItemTextActive: { color: PRIMARY, fontWeight: '600' },

  capsGrid: { padding: 16, gap: 8 },
  capPill: {
    flex: 1,
    margin: 4,
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f3f4f6',
    borderRadius: 8,
  },
  capPillActive: { backgroundColor: PRIMARY },
  capPillText: { fontSize: 15, color: '#374151', fontWeight: '500' },
  capPillTextActive: { color: WHITE, fontWeight: '700' },
});
