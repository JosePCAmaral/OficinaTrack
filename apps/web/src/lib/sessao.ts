import type { RespostaSessao } from '@oficinatrack/shared';

let token: string | null = null;
const ouvintes = new Set<(t: string | null) => void>();
let renovacao: Promise<RespostaSessao | null> | null = null;

export const obterToken = () => token;

export function definirToken(novo: string | null): void {
  token = novo;
  for (const fn of ouvintes) fn(novo);
}

export function aoMudarSessao(fn: (t: string | null) => void): () => void {
  ouvintes.add(fn);
  return () => ouvintes.delete(fn);
}

async function pedirRefresh(): Promise<Response> {
  return fetch('/api/v1/auth/refresh', { method: 'POST', credentials: 'include' });
}

/** Uma renovação por vez; se outra aba acabou de girar o cookie, a primeira tentativa perde e a segunda acerta. */
export function renovarSessao(): Promise<RespostaSessao | null> {
  renovacao ??= (async () => {
    try {
      let r = await pedirRefresh();
      if (r.status === 401) {
        await new Promise((ok) => setTimeout(ok, 800));
        r = await pedirRefresh();
      }
      if (!r.ok) {
        definirToken(null);
        return null;
      }
      const sessao = (await r.json()) as RespostaSessao;
      definirToken(sessao.accessToken);
      return sessao;
    } catch {
      definirToken(null);
      return null;
    } finally {
      renovacao = null;
    }
  })();
  return renovacao;
}
