/**
 * Catecismo Service
 * =================
 * Acesso offline ao Catecismo da Igreja Católica (edição Loyola).
 * Dados bundled em assets/catecismo.json — RAG-ready.
 */

// eslint-disable-next-line @typescript-eslint/no-require-imports
const DATA = require('../../assets/catecismo.json') as CatecismoJSON;

// =============================================================================
// TIPOS
// =============================================================================

export interface Paragrafo {
  num: number;
  texto: string;
  parte: string;
  parte_titulo: string;
  secao: string;
  secao_titulo: string;
  capitulo: string;
  capitulo_titulo: string;
  artigo: number;
  artigo_titulo: string;
}

export interface ArtigoEstrutura {
  num: number;
  titulo: string;
  paragrafo_inicio: number;
  paragrafo_fim: number;
}

export interface CapituloEstrutura {
  titulo: string;
  artigos: ArtigoEstrutura[];
  paragrafos_inicio: number;
}

export interface SecaoEstrutura {
  titulo: string;
  capitulos: CapituloEstrutura[];
  paragrafos_inicio: number;
}

export interface ParteEstrutura {
  titulo: string;
  secoes: SecaoEstrutura[];
  paragrafos_inicio: number;
}

interface CatecismoMeta {
  titulo: string;
  edicao: string;
  total_paragrafos: number;
  num_inicio: number;
  num_fim: number;
}

interface CatecismoJSON {
  meta: CatecismoMeta;
  paragrafos: Paragrafo[];
  estrutura: ParteEstrutura[];
}

// =============================================================================
// ÍNDICE RÁPIDO — mapa num → posição no array
// =============================================================================

const INDEX_MAP: Map<number, number> = new Map(
  DATA.paragrafos.map((p, i) => [p.num, i])
);

// =============================================================================
// HELPERS
// =============================================================================

export function getMeta(): CatecismoMeta {
  return DATA.meta;
}

export function getParagrafo(num: number): Paragrafo | null {
  const idx = INDEX_MAP.get(num);
  return idx !== undefined ? DATA.paragrafos[idx] : null;
}

/** Retorna até `count` parágrafos ao redor do §num (mesmo artigo quando possível). */
export function getContexto(num: number, count = 10): Paragrafo[] {
  const idx = INDEX_MAP.get(num);
  if (idx === undefined) return [];

  const artigo = DATA.paragrafos[idx].artigo;
  const parte = DATA.paragrafos[idx].parte;

  // Pega parágrafos do mesmo artigo/parte próximos
  const start = Math.max(0, idx - Math.floor(count / 2));
  const end = Math.min(DATA.paragrafos.length - 1, start + count - 1);

  return DATA.paragrafos.slice(start, end + 1);
}

/** Busca por texto. Retorna até `limit` resultados com destaque. */
export function buscar(query: string, limit = 30): Paragrafo[] {
  if (!query.trim()) return [];
  const q = query.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  return DATA.paragrafos
    .filter(p => {
      const t = p.texto.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      return t.includes(q);
    })
    .slice(0, limit);
}

/** Estrutura hierárquica completa para o índice. */
export function getEstrutura(): ParteEstrutura[] {
  return DATA.estrutura;
}

/** Todos os parágrafos (para uso do RAG / embeddings). */
export function getTodosParagrafos(): Paragrafo[] {
  return DATA.paragrafos;
}

/** Parágrafos de um artigo específico. */
export function getParagrafosArtigo(
  parte: string,
  capitulo: string,
  artigo: number
): Paragrafo[] {
  return DATA.paragrafos.filter(
    p => p.parte === parte && p.capitulo === capitulo && p.artigo === artigo
  );
}

/** Navegação: parágrafo anterior (pode ser de artigo diferente). */
export function getParagrafoAnterior(num: number): Paragrafo | null {
  const idx = INDEX_MAP.get(num);
  if (idx === undefined || idx === 0) return null;
  return DATA.paragrafos[idx - 1];
}

/** Navegação: próximo parágrafo. */
export function getParagrafoProximo(num: number): Paragrafo | null {
  const idx = INDEX_MAP.get(num);
  if (idx === undefined || idx >= DATA.paragrafos.length - 1) return null;
  return DATA.paragrafos[idx + 1];
}
