import { obterToken, renovarSessao } from './sessao';

export class ErroApi extends Error {
  constructor(
    readonly statusCode: number,
    readonly code: string,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = 'ErroApi';
  }
}

type CorpoErro = { code?: string; message?: string; details?: unknown };

/**
 * Rotas públicas de auth/convites: um 401 nelas é uma credencial errada ou token inválido, não uma
 * sessão expirada — tentar renovar não ajuda. Todas as outras rotas autenticadas (inclusive
 * `/auth/eu` e `/auth/senha`) devem tentar renovar normalmente.
 */
const ROTAS_SEM_RENOVACAO = new Set([
  '/auth/refresh',
  '/auth/login',
  '/auth/logout',
  '/auth/cadastro',
  '/auth/confirmar-email',
  '/auth/reenviar-confirmacao',
  '/auth/esqueci-senha',
  '/auth/redefinir-senha',
  '/convites/consultar',
  '/convites/aceitar',
]);

export async function api<T>(caminho: string, init?: RequestInit, jaRenovou = false): Promise<T> {
  // Content-Type JSON só para corpo string: FormData (upload) precisa do boundary que o navegador define.
  const headers = new Headers(init?.headers);
  if (typeof init?.body === 'string' && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
  const atual = obterToken();
  if (atual) headers.set('Authorization', `Bearer ${atual}`);
  const resposta = await fetch(`/api/v1${caminho}`, { ...init, credentials: 'include', headers });
  if (resposta.status === 401 && !jaRenovou && !ROTAS_SEM_RENOVACAO.has(caminho)) {
    const sessao = await renovarSessao();
    if (sessao) return api<T>(caminho, init, true);
  }
  const corpo: unknown = resposta.status === 204 ? undefined : await resposta.json().catch(() => undefined);
  if (!resposta.ok) {
    const erro = (corpo ?? {}) as CorpoErro;
    throw new ErroApi(
      resposta.status,
      erro.code ?? 'ERRO_DESCONHECIDO',
      erro.message ?? 'Não foi possível completar a ação. Tente de novo.',
      erro.details,
    );
  }
  return corpo as T;
}
