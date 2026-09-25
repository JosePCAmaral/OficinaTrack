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

export async function api<T>(caminho: string, init?: RequestInit): Promise<T> {
  const resposta = await fetch(`/api/v1${caminho}`, {
    ...init,
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...init?.headers },
  });
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
