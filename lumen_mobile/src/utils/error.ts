/**
 * API Error Utilities
 * ===================
 * Helpers para lidar com erros retornados pelo backend Lumen+.
 *
 * O backend sempre retorna erros no formato:
 *   { detail: { error: string; message: string; field?: string } }
 *
 * Em casos de validação Pydantic, o formato pode ser uma lista:
 *   { detail: [{ loc: string[]; msg: string; type: string }] }
 */

/** Formato padrão de erro da API Lumen+. */
export interface ApiErrorDetail {
  error: string;
  message: string;
  field?: string;
}

/** Formato de erro de validação Pydantic. */
interface PydanticValidationError {
  loc: string[];
  msg: string;
  type: string;
}

/** Shape bruta de um erro de resposta HTTP (lançado pelo ApiClient). */
interface ApiErrorResponse {
  response?: {
    status: number;
    data?: {
      detail?: ApiErrorDetail | PydanticValidationError[] | string;
    };
  };
}

/**
 * Extrai a mensagem de erro legível de qualquer resposta de erro da API.
 *
 * Trata três formatos possíveis:
 *   1. `{ detail: { error, message } }` — formato padrão Lumen+
 *   2. `{ detail: [{ msg }] }` — validação Pydantic
 *   3. `{ detail: "string" }` — mensagem simples
 *
 * @param error - Valor capturado pelo `catch` (unknown)
 * @param fallback - Mensagem padrão caso nenhum formato seja reconhecido
 */
export function parseApiError(error: unknown, fallback = 'Ocorreu um erro inesperado'): string {
  const apiError = error as ApiErrorResponse;
  const raw = apiError?.response?.data?.detail;

  if (!raw) return fallback;

  // Formato padrão Lumen+: { error, message }
  if (typeof raw === 'object' && !Array.isArray(raw) && 'message' in raw) {
    return (raw as ApiErrorDetail).message || fallback;
  }

  // Validação Pydantic: array de { msg }
  if (Array.isArray(raw) && raw.length > 0) {
    return (raw[0] as PydanticValidationError).msg || fallback;
  }

  // Mensagem simples em string
  if (typeof raw === 'string') return raw;

  return fallback;
}

/**
 * Verifica se um erro é de API (tem response.status).
 * Útil para distinguir erros de rede de erros do servidor.
 */
export function isApiError(error: unknown): error is ApiErrorResponse {
  return (
    typeof error === 'object' &&
    error !== null &&
    'response' in error &&
    typeof (error as ApiErrorResponse).response?.status === 'number'
  );
}

/**
 * Retorna o HTTP status code do erro, ou undefined se não for erro de API.
 */
export function getApiErrorStatus(error: unknown): number | undefined {
  return isApiError(error) ? (error as ApiErrorResponse).response?.status : undefined;
}
