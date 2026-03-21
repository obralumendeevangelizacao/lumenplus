/**
 * Bible Service
 * =============
 * Acesso offline à Bíblia Ave Maria (73 livros, edição católica).
 * Os dados ficam bundled em assets/biblia.json.
 */

// eslint-disable-next-line @typescript-eslint/no-require-imports
const BIBLIA_DATA = require('../../assets/biblia.json') as BibliaJSON;

// =============================================================================
// TIPOS
// =============================================================================

export interface Versiculo {
  versiculo: number;
  texto: string;
}

export interface Capitulo {
  capitulo: number;
  versiculos: Versiculo[];
}

export interface Livro {
  nome: string;
  capitulos: Capitulo[];
  testamento: 'AT' | 'NT';
  index: number; // índice global (0-72)
}

interface BibliaJSON {
  antigoTestamento: { nome: string; capitulos: Capitulo[] }[];
  novoTestamento: { nome: string; capitulos: Capitulo[] }[];
}

// =============================================================================
// DADOS PROCESSADOS
// =============================================================================

const TODOS_OS_LIVROS: Livro[] = [
  ...BIBLIA_DATA.antigoTestamento.map((l, i) => ({
    ...l,
    testamento: 'AT' as const,
    index: i,
  })),
  ...BIBLIA_DATA.novoTestamento.map((l, i) => ({
    ...l,
    testamento: 'NT' as const,
    index: 46 + i,
  })),
];

// Grupos para exibição
export const GRUPOS_AT = [
  { label: 'Pentateuco', indices: [0, 1, 2, 3, 4] },
  { label: 'Livros Históricos', indices: [5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21] },
  { label: 'Livros Sapienciais', indices: [22, 23, 24, 25, 26, 27, 28, 29, 30] },
  { label: 'Profetas Maiores', indices: [31, 32, 33, 34, 35, 36] },
  { label: 'Profetas Menores', indices: [37, 38, 39, 40, 41, 42, 43, 44, 45] },
];

export const GRUPOS_NT = [
  { label: 'Evangelhos', indices: [46, 47, 48, 49] },
  { label: 'Atos dos Apóstolos', indices: [50] },
  { label: 'Cartas de Paulo', indices: [51, 52, 53, 54, 55, 56, 57, 58, 59, 60, 61, 62, 63] },
  { label: 'Cartas Católicas', indices: [64, 65, 66, 67, 68, 69, 70, 71, 72] },
];

// =============================================================================
// HELPERS
// =============================================================================

export function getTodosOsLivros(): Livro[] {
  return TODOS_OS_LIVROS;
}

export function getLivro(index: number): Livro | null {
  return TODOS_OS_LIVROS[index] ?? null;
}

export function getCapitulo(livroIndex: number, capituloNum: number): Capitulo | null {
  const livro = TODOS_OS_LIVROS[livroIndex];
  if (!livro) return null;
  return livro.capitulos.find(c => c.capitulo === capituloNum) ?? null;
}

/** Versículo do dia — determinístico pelo dia do ano (mesmo versículo para todos os usuários no mesmo dia). */
export function getVersiculoDoDia(): { livro: string; referencia: string; texto: string } {
  const hoje = new Date();
  const inicioAno = new Date(hoje.getFullYear(), 0, 0);
  const diffMs = hoje.getTime() - inicioAno.getTime();
  const diaDoAno = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  // Prioriza Salmos, Evangelhos e Cartas para o versículo do dia
  const LIVROS_PRIVILEGIADOS = [
    ...Array.from({ length: 150 }, (_, i) => ({ livroIndex: 22, capOffset: i })), // Salmos
    ...Array.from({ length: 28 }, (_, i) => ({ livroIndex: 46, capOffset: i })),  // Mateus
    ...Array.from({ length: 16 }, (_, i) => ({ livroIndex: 47, capOffset: i })),  // Marcos
    ...Array.from({ length: 24 }, (_, i) => ({ livroIndex: 48, capOffset: i })),  // Lucas
    ...Array.from({ length: 21 }, (_, i) => ({ livroIndex: 49, capOffset: i })),  // João
  ];

  const entry = LIVROS_PRIVILEGIADOS[diaDoAno % LIVROS_PRIVILEGIADOS.length];
  const livro = TODOS_OS_LIVROS[entry.livroIndex];
  if (!livro) return { livro: '', referencia: '', texto: '' };

  const cap = livro.capitulos[entry.capOffset % livro.capitulos.length];
  if (!cap) return { livro: '', referencia: '', texto: '' };

  const versIdx = diaDoAno % cap.versiculos.length;
  const vers = cap.versiculos[versIdx];
  if (!vers) return { livro: '', referencia: '', texto: '' };

  return {
    livro: livro.nome,
    referencia: `${livro.nome} ${cap.capitulo},${vers.versiculo}`,
    texto: vers.texto,
  };
}
