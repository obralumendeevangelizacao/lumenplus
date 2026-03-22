/**
 * Orações Screen
 * ==============
 * Liturgia Diária, Mistérios do Terço e Orações fixas.
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import {
  GOZOSOS, LUMINOSOS, DOLOROSOS, GLORIOSOS,
  MISTERIO_POR_DIA, DIAS_SEMANA,
} from '@/data/terco';
import type { MisterioData } from '@/data/terco';
import { ORACOES, ORACOES_LUMEN } from '@/data/oracoes';

// =============================================================================
// CORES
// =============================================================================
const PRIMARY = '#1A859B';
const WHITE = '#ffffff';
const GRAY = '#6b7280';
const BG = '#f5f5f5';
const ERROR_COLOR = '#ef4444';


// =============================================================================
// CARD EXPANSÍVEL
// =============================================================================

type ExpandableCardProps = {
  id: string;
  titulo: string;
  subtitulo?: string;
  children: React.ReactNode;
  expanded: string | null;
  onToggle: (id: string) => void;
  accentColor?: string;
};

function ExpandableCard(props: ExpandableCardProps) {
  const { id, titulo, subtitulo, children, expanded, onToggle, accentColor } = props;
  const isOpen = expanded === id;

  return (
    <View style={[styles.card, isOpen ? styles.cardOpen : null]}>
      <TouchableOpacity
        style={styles.cardHeader}
        onPress={() => onToggle(id)}
        activeOpacity={0.7}
      >
        {accentColor ? (
          <View style={[styles.cardAccent, { backgroundColor: accentColor }]} />
        ) : null}
        <View style={styles.cardHeaderText}>
          <Text style={styles.cardTitle}>{titulo}</Text>
          {subtitulo ? (
            <Text style={styles.cardSubtitle} numberOfLines={1}>
              {subtitulo}
            </Text>
          ) : null}
        </View>
        <Ionicons name={isOpen ? 'chevron-up' : 'chevron-down'} size={18} color={GRAY} />
      </TouchableOpacity>
      {isOpen ? <View style={styles.cardBody}>{children}</View> : null}
    </View>
  );
}

// =============================================================================
// TELA PRINCIPAL
// =============================================================================

export default function OracoesScreen() {
  const [expanded, setExpanded] = useState<string | null>(null);
  const [liturgia, setLiturgia] = useState<any>(null);
  const [liturgiaLoading, setLiturgiaLoading] = useState(true);
  const [liturgiaError, setLiturgiaError] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const today = new Date();
  const diaSemana = today.getDay();
  const misterio: MisterioData = MISTERIO_POR_DIA[diaSemana] || GOZOSOS;

  const toggle = (id: string) => {
    setExpanded((prev) => (prev === id ? null : id));
  };

  const fetchLiturgia = useCallback(async () => {
    try {
      setLiturgiaLoading(true);
      setLiturgiaError(false);

      const res = await fetch('https://liturgia.up.railway.app/v2/');
      if (!res.ok) {
        throw new Error('HTTP ' + res.status);
      }
      const data = await res.json();

      // Normaliza para o formato usado pela tela
      const r1 = data.leituras?.primeiraLeitura?.[0] || null;
      const ps = data.leituras?.salmo?.[0] || null;
      const r2 = data.leituras?.segundaLeitura?.[0] || null;
      const gp = data.leituras?.evangelho?.[0] || null;

      setLiturgia({
        color: data.cor || '',
        date: data.data || '',
        entry_title: data.liturgia || '',
        readings: {
          first_reading: r1
            ? { head: r1.referencia || '', text: r1.texto || '' }
            : null,
          psalm: ps
            ? {
                response: ps.refrao || '',
                content_psalm: ps.texto
                  ? ps.texto.split('\n').filter((v: string) => v.trim())
                  : [],
              }
            : null,
          second_reading: r2
            ? { head: r2.referencia || '', text: r2.texto || '' }
            : null,
          gospel: gp
            ? { head: gp.referencia || '', text: gp.texto || '' }
            : null,
        },
      });
    } catch (e) {
      setLiturgiaError(true);
    } finally {
      setLiturgiaLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLiturgia();
  }, [fetchLiturgia]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchLiturgia();
    setRefreshing(false);
  }, [fetchLiturgia]);

  const getLiturgicalColor = (colorName: string) => {
    const n = (colorName || '').toLowerCase();
    if (n.includes('branco')) { return '#d4a017'; }
    if (n.includes('verde')) { return '#16a34a'; }
    if (n.includes('vermelho')) { return '#dc2626'; }
    if (n.includes('roxo') || n.includes('violeta')) { return '#7c3aed'; }
    if (n.includes('rosa')) { return '#ec4899'; }
    if (n.includes('preto')) { return '#171717'; }
    return PRIMARY;
  };

  const getLiturgicalBg = (colorName: string) => {
    const n = (colorName || '').toLowerCase();
    if (n.includes('branco')) { return '#fffbeb'; }
    if (n.includes('verde')) { return '#f0fdf4'; }
    if (n.includes('vermelho')) { return '#fef2f2'; }
    if (n.includes('roxo') || n.includes('violeta')) { return '#f5f3ff'; }
    if (n.includes('rosa')) { return '#fdf2f8'; }
    if (n.includes('preto')) { return '#f9fafb'; }
    return '#e0f2f7';
  };

  const liturgicalColor = getLiturgicalColor(liturgia ? liturgia.color : '');
  const liturgicalBg = getLiturgicalBg(liturgia ? liturgia.color : '');
  const readings = liturgia ? liturgia.readings : null;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[PRIMARY]} />
      }
    >
      {/* ── LITURGIA DIÁRIA ─────────────────────────────────────────── */}
      <Text style={styles.sectionTitle}>Liturgia Diária</Text>

      {liturgiaLoading ? (
        <View style={styles.loadingCard}>
          <ActivityIndicator size="large" color={PRIMARY} />
          <Text style={styles.loadingText}>Carregando leituras do dia...</Text>
        </View>
      ) : null}

      {liturgiaError && !liturgiaLoading ? (
        <View style={styles.errorCard}>
          <Ionicons name="wifi-outline" size={32} color={ERROR_COLOR} />
          <Text style={styles.errorText}>
            Não foi possível carregar a Liturgia Diária.
          </Text>
          <TouchableOpacity style={styles.retryButton} onPress={fetchLiturgia}>
            <Text style={styles.retryText}>Tentar novamente</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      {liturgia && !liturgiaLoading ? (
        <View>
          <View
            style={[
              styles.liturgiaHeader,
              { backgroundColor: liturgicalBg, borderLeftColor: liturgicalColor },
            ]}
          >
            <View style={styles.liturgiaHeaderRow}>
              <View style={[styles.corChip, { backgroundColor: liturgicalColor }]}>
                <Text style={styles.corChipText}>{liturgia.color || ''}</Text>
              </View>
              <Text style={styles.liturgiaData}>{liturgia.date || ''}</Text>
            </View>
            <Text style={styles.liturgiaTitulo}>{liturgia.entry_title || ''}</Text>
          </View>

          {readings && readings.first_reading && readings.first_reading.text ? (
            <ExpandableCard
              id="l-first"
              titulo="1ª Leitura"
              subtitulo={readings.first_reading.head}
              expanded={expanded}
              onToggle={toggle}
              accentColor={liturgicalColor}
            >
              <Text style={styles.leituraRef}>{readings.first_reading.head || ''}</Text>
              <Text style={styles.leituraTexto}>{readings.first_reading.text || ''}</Text>
            </ExpandableCard>
          ) : null}

          {readings && readings.psalm ? (
            <ExpandableCard
              id="l-psalm"
              titulo="Salmo Responsorial"
              subtitulo={
                readings.psalm.response ? 'R/. ' + readings.psalm.response : undefined
              }
              expanded={expanded}
              onToggle={toggle}
              accentColor={liturgicalColor}
            >
              {readings.psalm.response ? (
                <Text style={styles.salmoResposta}>R/. {readings.psalm.response}</Text>
              ) : null}
              {readings.psalm.content_psalm
                ? readings.psalm.content_psalm.map((v: string, i: number) => (
                    <Text key={String(i)} style={styles.salmoVerso}>
                      {v}
                    </Text>
                  ))
                : null}
              {readings.psalm.text && !readings.psalm.content_psalm ? (
                <Text style={styles.leituraTexto}>{readings.psalm.text}</Text>
              ) : null}
            </ExpandableCard>
          ) : null}

          {readings && readings.second_reading && readings.second_reading.text ? (
            <ExpandableCard
              id="l-second"
              titulo="2ª Leitura"
              subtitulo={readings.second_reading.head}
              expanded={expanded}
              onToggle={toggle}
              accentColor={liturgicalColor}
            >
              <Text style={styles.leituraRef}>{readings.second_reading.head || ''}</Text>
              <Text style={styles.leituraTexto}>{readings.second_reading.text || ''}</Text>
            </ExpandableCard>
          ) : null}

          {readings && readings.gospel && readings.gospel.text ? (
            <ExpandableCard
              id="l-gospel"
              titulo="Evangelho"
              subtitulo={readings.gospel.head}
              expanded={expanded}
              onToggle={toggle}
              accentColor={liturgicalColor}
            >
              <Text style={styles.leituraRef}>{readings.gospel.head || ''}</Text>
              <Text style={styles.leituraTexto}>{readings.gospel.text || ''}</Text>
            </ExpandableCard>
          ) : null}
        </View>
      ) : null}

      {/* ── ESCRITURAS E MAGISTÉRIO ─────────────────────────────────── */}
      <Text style={[styles.sectionTitle, styles.sectionTitleSpaced]}>
        Escrituras e Magistério
      </Text>

      <TouchableOpacity
        style={styles.escriturasCard}
        onPress={() => router.push('/biblia' as any)}
        activeOpacity={0.7}
      >
        <View style={styles.escriturasIconContainer}>
          <Ionicons name="book" size={28} color={WHITE} />
        </View>
        <View style={styles.escriturasTextContainer}>
          <Text style={styles.escriturasTitle}>Bíblia Ave Maria</Text>
          <Text style={styles.escriturasSubtitle}>73 livros • Edição Católica</Text>
        </View>
        <Ionicons name="chevron-forward" size={20} color={PRIMARY} />
      </TouchableOpacity>

      {/* ── CATECISMO ───────────────────────────────────────────────── */}
      <TouchableOpacity
        style={styles.catecismoCard}
        onPress={() => router.push('/catecismo' as any)}
        activeOpacity={0.7}
      >
        <View style={styles.catecismoIconContainer}>
          <Ionicons name="library" size={28} color={WHITE} />
        </View>
        <View style={styles.escriturasTextContainer}>
          <Text style={styles.catecismoTitle}>Catecismo da Igreja Católica</Text>
          <Text style={styles.escriturasSubtitle}>2537 parágrafos • Edição Loyola</Text>
        </View>
        <Ionicons name="chevron-forward" size={20} color="#7c3aed" />
      </TouchableOpacity>

      {/* ── MISTÉRIOS DO SANTO TERÇO ────────────────────────────────── */}
      <Text style={[styles.sectionTitle, styles.sectionTitleSpaced]}>
        Mistérios do Santo Terço
      </Text>

      <View style={styles.misterioHeader}>
        <Text style={styles.misterioEmoji}>{misterio.emoji}</Text>
        <View>
          <Text style={styles.misterioLabel}>Mistérios {misterio.label}</Text>
          <Text style={styles.misterioDia}>{DIAS_SEMANA[diaSemana]}</Text>
        </View>
      </View>

      {misterio.items.map((m, i) => (
        <ExpandableCard
          key={'m' + String(i)}
          id={'m' + String(i)}
          titulo={m.titulo}
          expanded={expanded}
          onToggle={toggle}
          accentColor={misterio.cor}
        >
          <Text style={styles.leituraTexto}>{m.texto}</Text>
        </ExpandableCard>
      ))}

      {/* ── ORAÇÕES ─────────────────────────────────────────────────── */}
      <Text style={[styles.sectionTitle, styles.sectionTitleSpaced]}>Orações</Text>

      {ORACOES.map((o) => (
        <ExpandableCard
          key={o.id}
          id={o.id}
          titulo={o.titulo}
          expanded={expanded}
          onToggle={toggle}
          accentColor={PRIMARY}
        >
          <Text style={styles.leituraTexto}>{o.texto}</Text>
        </ExpandableCard>
      ))}

      {/* ── ORAÇÕES DA OBRA LUMEN ───────────────────────────────────── */}
      {ORACOES_LUMEN.length > 0 ? (
        <View>
          <Text style={[styles.sectionTitle, styles.sectionTitleSpaced]}>
            Orações da Obra Lumen
          </Text>
          {ORACOES_LUMEN.map((o) => (
            <ExpandableCard
              key={o.id}
              id={o.id}
              titulo={o.titulo}
              expanded={expanded}
              onToggle={toggle}
              accentColor="#b45309"
            >
              <Text style={styles.leituraTexto}>{o.texto}</Text>
            </ExpandableCard>
          ))}
        </View>
      ) : null}

      <View style={styles.spacer} />
    </ScrollView>
  );
}

// =============================================================================
// ESTILOS
// =============================================================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BG,
  },
  content: {
    padding: 16,
    paddingBottom: 40,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#171717',
    marginBottom: 12,
  },
  sectionTitleSpaced: {
    marginTop: 24,
  },
  loadingCard: {
    backgroundColor: WHITE,
    borderRadius: 12,
    padding: 32,
    alignItems: 'center',
    marginBottom: 12,
  },
  loadingText: {
    fontSize: 14,
    color: GRAY,
    marginTop: 12,
  },
  errorCard: {
    backgroundColor: '#fef2f2',
    borderRadius: 12,
    padding: 24,
    alignItems: 'center',
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#fecaca',
  },
  errorText: {
    fontSize: 14,
    color: ERROR_COLOR,
    textAlign: 'center',
    marginTop: 8,
    marginBottom: 8,
  },
  retryButton: {
    backgroundColor: PRIMARY,
    borderRadius: 8,
    paddingHorizontal: 20,
    paddingVertical: 10,
    marginTop: 8,
  },
  retryText: {
    color: WHITE,
    fontSize: 14,
    fontWeight: '600',
  },
  liturgiaHeader: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
    borderLeftWidth: 4,
  },
  liturgiaHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  corChip: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 12,
    marginRight: 10,
  },
  corChipText: {
    color: WHITE,
    fontSize: 11,
    fontWeight: '700',
  },
  liturgiaData: {
    fontSize: 13,
    color: GRAY,
  },
  liturgiaTitulo: {
    fontSize: 15,
    fontWeight: '600',
    color: '#171717',
    lineHeight: 22,
  },
  card: {
    backgroundColor: WHITE,
    borderRadius: 12,
    marginBottom: 8,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  cardOpen: {
    borderColor: PRIMARY,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
  },
  cardAccent: {
    width: 4,
    alignSelf: 'stretch',
    borderRadius: 2,
    minHeight: 32,
    marginRight: 10,
  },
  cardHeaderText: {
    flex: 1,
    marginRight: 8,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#171717',
  },
  cardSubtitle: {
    fontSize: 12,
    color: GRAY,
    marginTop: 2,
  },
  cardBody: {
    paddingHorizontal: 16,
    paddingBottom: 16,
    paddingTop: 4,
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
  },
  leituraRef: {
    fontSize: 13,
    color: PRIMARY,
    fontWeight: '600',
    marginBottom: 10,
  },
  leituraTexto: {
    fontSize: 15,
    color: '#374151',
    lineHeight: 24,
  },
  salmoResposta: {
    fontSize: 14,
    color: PRIMARY,
    fontWeight: '600',
    marginBottom: 10,
    fontStyle: 'italic',
  },
  salmoVerso: {
    fontSize: 15,
    color: '#374151',
    lineHeight: 24,
    marginBottom: 4,
  },
  misterioHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: WHITE,
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  misterioEmoji: {
    fontSize: 36,
    marginRight: 14,
  },
  misterioLabel: {
    fontSize: 16,
    fontWeight: '700',
    color: '#171717',
  },
  misterioDia: {
    fontSize: 13,
    color: GRAY,
    marginTop: 2,
  },
  catecismoCard: {
    backgroundColor: WHITE,
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    borderWidth: 1,
    borderColor: 'rgba(124,58,237,0.3)',
  },
  catecismoIconContainer: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#7c3aed',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  catecismoTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#171717',
  },
  escriturasCard: {
    backgroundColor: WHITE,
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    borderWidth: 1,
    borderColor: `${PRIMARY}40`,
  },
  escriturasIconContainer: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: PRIMARY,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  escriturasTextContainer: {
    flex: 1,
  },
  escriturasTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#171717',
  },
  escriturasSubtitle: {
    fontSize: 13,
    color: GRAY,
    marginTop: 2,
  },
  spacer: {
    height: 20,
  },
});
