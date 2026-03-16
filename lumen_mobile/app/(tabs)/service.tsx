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
import { Ionicons } from '@expo/vector-icons';

// =============================================================================
// CORES
// =============================================================================
const PRIMARY = '#1A859B';
const WHITE = '#ffffff';
const GRAY = '#6b7280';
const BG = '#f5f5f5';
const ERROR_COLOR = '#ef4444';

// =============================================================================
// TIPOS
// =============================================================================
type MisterioItem = { titulo: string; texto: string };
type MisterioData = { label: string; emoji: string; cor: string; items: MisterioItem[] };
type Oracao = { id: string; titulo: string; texto: string };

// =============================================================================
// MISTÉRIOS DO SANTO TERÇO
// =============================================================================

const GOZOSOS: MisterioData = {
  label: 'Gozosos',
  emoji: '☀️',
  cor: '#f59e0b',
  items: [
    {
      titulo: '1º Mistério Gozoso — A Anunciação',
      texto: 'O Anjo Gabriel anuncia a Maria que ela será a Mãe do Salvador. Maria responde com total confiança: "Eis aqui a serva do Senhor; faça-se em mim segundo a tua palavra." (Lc 1, 38)',
    },
    {
      titulo: '2º Mistério Gozoso — A Visitação',
      texto: 'Maria visita sua prima Isabel, que estava grávida de João Batista. Ao ouvir a saudação de Maria, o menino saltou de alegria no seio de Isabel, que exclamou: "Bendita és tu entre as mulheres!" (Lc 1, 42)',
    },
    {
      titulo: '3º Mistério Gozoso — O Nascimento de Jesus',
      texto: 'Jesus nasce em Belém, numa manjedoura, por falta de lugar na hospedaria. Os anjos anunciam aos pastores: "Hoje, na cidade de Davi, nasceu para vós o Salvador, que é Cristo Senhor." (Lc 2, 11)',
    },
    {
      titulo: '4º Mistério Gozoso — A Apresentação no Templo',
      texto: 'Maria e José apresentam o Menino Jesus no Templo. O ancião Simeão proclama: "Agora, Senhor, podes deixar teu servo ir em paz, porque meus olhos viram a tua salvação." (Lc 2, 29-30)',
    },
    {
      titulo: '5º Mistério Gozoso — A Perda e o Achado de Jesus no Templo',
      texto: 'Aos doze anos, Jesus fica no Templo enquanto seus pais retornam para Nazaré. Após três dias de angústia, Maria e José o encontram entre os doutores, ouvindo-os e fazendo-lhes perguntas. (Lc 2, 46)',
    },
  ],
};

const LUMINOSOS: MisterioData = {
  label: 'Luminosos',
  emoji: '✨',
  cor: '#3b82f6',
  items: [
    {
      titulo: '1º Mistério Luminoso — O Batismo no Jordão',
      texto: 'Jesus é batizado por João no Rio Jordão. O Espírito Santo desce sobre Ele em forma de pomba, e uma voz do céu proclama: "Este é o meu Filho amado, em quem me comprazo." (Mt 3, 17)',
    },
    {
      titulo: '2º Mistério Luminoso — As Bodas de Caná',
      texto: 'No casamento em Caná, Maria intercede junto a Jesus pela família que ficou sem vinho. Jesus transforma a água em vinho, realizando seu primeiro milagre e manifestando a sua glória. (Jo 2, 1-11)',
    },
    {
      titulo: '3º Mistério Luminoso — O Anúncio do Reino de Deus',
      texto: 'Jesus percorre a Galileia pregando: "Convertei-vos, porque o Reino dos Céus está próximo." Chama os primeiros discípulos e anuncia a Boa Nova a todos, especialmente aos pobres. (Mc 1, 14-15)',
    },
    {
      titulo: '4º Mistério Luminoso — A Transfiguração',
      texto: 'No Monte Tabor, Jesus se transfigura diante de Pedro, Tiago e João. Seu rosto resplandece como o sol e uma voz do céu diz: "Este é o meu Filho amado, ouvi-o." (Mt 17, 5)',
    },
    {
      titulo: '5º Mistério Luminoso — A Instituição da Eucaristia',
      texto: 'Na Última Ceia, Jesus toma o pão e o cálice e diz: "Tomai e comei, isto é o meu Corpo... Este é o cálice do meu Sangue." Institui a Eucaristia como memorial perene de sua entrega. (Lc 22, 19-20)',
    },
  ],
};

const DOLOROSOS: MisterioData = {
  label: 'Dolorosos',
  emoji: '🕊️',
  cor: '#7c3aed',
  items: [
    {
      titulo: '1º Mistério Doloroso — A Agonia no Horto',
      texto: 'No Jardim das Oliveiras, Jesus ora em angústia: "Pai, se queres, afasta de mim este cálice! Contudo, não se faça a minha vontade, mas a tua." Um anjo aparece para confortá-lo. (Lc 22, 42-43)',
    },
    {
      titulo: '2º Mistério Doloroso — A Flagelação',
      texto: 'Jesus é preso, levado a Pilatos e condenado. É amarrado a uma coluna e flagelado pelos soldados romanos, cumprindo a profecia: "Pelas suas chagas fomos curados." (Is 53, 5)',
    },
    {
      titulo: '3º Mistério Doloroso — A Coroação de Espinhos',
      texto: 'Os soldados trançam uma coroa de espinhos e a impõem sobre a cabeça de Jesus, vestem-no com um manto vermelho e, em escárnio, dobram os joelhos diante dele dizendo: "Salve, Rei dos Judeus!" (Jo 19, 2-3)',
    },
    {
      titulo: '4º Mistério Doloroso — Jesus Carrega a Cruz',
      texto: 'Condenado à morte, Jesus carrega a pesada cruz pelo Caminho da Cruz até o Calvário. Cai várias vezes sob o peso. Simão de Cirene é obrigado a ajudá-lo a carregar a cruz. (Lc 23, 26)',
    },
    {
      titulo: '5º Mistério Doloroso — A Crucificação e Morte',
      texto: 'Jesus é pregado na cruz entre dois ladrões no Gólgota. Após três horas de agonia, entrega seu espírito ao Pai: "Pai, nas tuas mãos entrego o meu espírito." O véu do Templo rasga-se ao meio. (Lc 23, 46)',
    },
  ],
};

const GLORIOSOS: MisterioData = {
  label: 'Gloriosos',
  emoji: '👑',
  cor: '#d97706',
  items: [
    {
      titulo: '1º Mistério Glorioso — A Ressurreição',
      texto: 'No terceiro dia, Jesus ressuscita dos mortos conforme as Escrituras. As mulheres vão ao sepulcro e encontram-no vazio. O Anjo anuncia: "Não está aqui, ressuscitou!" (Lc 24, 6)',
    },
    {
      titulo: '2º Mistério Glorioso — A Ascensão',
      texto: 'Quarenta dias após a Ressurreição, Jesus sobe ao Céu à vista dos discípulos no Monte das Oliveiras. Prometendo enviar o Espírito Santo, é elevado e uma nuvem o subtrai aos seus olhos. (At 1, 9)',
    },
    {
      titulo: '3º Mistério Glorioso — A Vinda do Espírito Santo',
      texto: 'No dia de Pentecostes, o Espírito Santo desce sobre Maria e os Apóstolos reunidos no cenáculo, em forma de línguas de fogo. Todos ficam cheios do Espírito Santo e começam a pregar. (At 2, 1-4)',
    },
    {
      titulo: '4º Mistério Glorioso — A Assunção de Maria',
      texto: 'Ao fim de sua vida terrena, Maria é assunta em corpo e alma ao Céu. Ela que foi digna de conceber o Filho de Deus é elevada à glória celeste como Rainha de todos os santos e anjos.',
    },
    {
      titulo: '5º Mistério Glorioso — A Coroação de Maria',
      texto: 'Maria é coroada Rainha do Céu e da Terra pela Santíssima Trindade. Ela intercede por nós como Mãe de misericórdia e advogada dos pecadores, até que todos seus filhos cheguem à pátria celestial.',
    },
  ],
};

const MISTERIO_POR_DIA: { [key: number]: MisterioData } = {
  0: GLORIOSOS,
  1: GOZOSOS,
  2: DOLOROSOS,
  3: GLORIOSOS,
  4: LUMINOSOS,
  5: DOLOROSOS,
  6: GOZOSOS,
};

const DIAS_SEMANA = [
  'Domingo',
  'Segunda-feira',
  'Terça-feira',
  'Quarta-feira',
  'Quinta-feira',
  'Sexta-feira',
  'Sábado',
];

// =============================================================================
// ORAÇÕES FIXAS
// =============================================================================

const PAI_NOSSO = 'Pai nosso que estais no céu,\nsantificado seja o vosso nome,\nvenha a nós o vosso reino,\nseja feita a vossa vontade,\nassim na terra como no céu.\n\nO pão nosso de cada dia nos dai hoje,\nperdoai-nos as nossas ofensas,\nassim como nós perdoamos a quem nos tem ofendido,\ne não nos deixeis cair em tentação,\nmas livrai-nos do mal.\nAmém.';

const AVE_MARIA = 'Ave Maria, cheia de graça,\no Senhor é convosco,\nbendita sois vós entre as mulheres\ne bendito é o fruto do vosso ventre, Jesus.\n\nSanta Maria, Mãe de Deus,\nrogai por nós, pecadores,\nagora e na hora da nossa morte.\nAmém.';

const GLORIA = 'Glória ao Pai, ao Filho e ao Espírito Santo,\ncomo era no princípio, agora e sempre,\npor todos os séculos dos séculos.\nAmém.';

const FATIMA = 'Ó meu Jesus, perdoai-nos, livrai-nos do fogo do inferno,\nlevai as almas todas para o Céu,\nespecialmente as que mais precisarem da vossa misericórdia.\nAmém.';

const SALVE_RAINHA = 'Salve Rainha, Mãe de misericórdia,\nvida, doçura e esperança nossa, salve!\n\nA vós bradamos, os degredados filhos de Eva;\na vós suspiramos, gemendo e chorando\nneste vale de lágrimas.\n\nEia, pois, advogada nossa,\nessas vossas misericordiosas vistas a nós volveis,\ne depois deste desterro,\nmostrai-nos Jesus, fruto bendito do vosso ventre.\n\nÓ clemente, ó piedosa,\nó doce sempre Virgem Maria!\nAmém.';

const CREDO = 'Creio em Deus Pai todo-poderoso,\nCriador do céu e da terra.\n\nCreio em Jesus Cristo,\nseu único Filho, nosso Senhor,\nque foi concebido pelo poder do Espírito Santo,\nnasceu da Virgem Maria,\npadeceu sob Pôncio Pilatos,\nfoi crucificado, morto e sepultado,\ndesceu à mansão dos mortos,\nressuscitou ao terceiro dia,\nsubiu aos céus,\nestá sentado à direita de Deus Pai todo-poderoso,\nonde há de vir a julgar os vivos e os mortos.\n\nCreio no Espírito Santo,\nna santa Igreja Católica,\nna comunhão dos santos,\nna remissão dos pecados,\nna ressurreição da carne,\nna vida eterna.\nAmém.';

const CONFITEOR = 'Confesso a Deus todo-poderoso,\ne a vós, irmãos,\nque pequei muitas vezes\npor pensamentos e palavras,\natos e omissões,\npor minha culpa, minha culpa,\nminha tão grande culpa.\n\nE peço à Virgem Maria,\naos anjos e santos,\ne a vós, irmãos,\nque rogueis por mim\na Deus, nosso Senhor.\nAmém.';

const ORACOES: Oracao[] = [
  { id: 'pai-nosso', titulo: 'Pai Nosso', texto: PAI_NOSSO },
  { id: 'ave-maria', titulo: 'Ave Maria', texto: AVE_MARIA },
  { id: 'gloria', titulo: 'Glória', texto: GLORIA },
  { id: 'fatima', titulo: 'Oração de Fátima', texto: FATIMA },
  { id: 'salve-rainha', titulo: 'Salve Rainha', texto: SALVE_RAINHA },
  { id: 'credo', titulo: 'Credo Apostólico', texto: CREDO },
  { id: 'confiteor', titulo: 'Confiteor', texto: CONFITEOR },
];

// TODO: Adicionar orações personalizadas da Obra Lumen
const ORACOES_LUMEN: Oracao[] = [];

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
  spacer: {
    height: 20,
  },
});
