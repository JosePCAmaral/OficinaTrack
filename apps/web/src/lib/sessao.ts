import type { RespostaSessao } from '@oficinatrack/shared';

let token: string | null = null;
/** Incrementa a cada `definirToken`: deixa uma renovação em voo perceber que a sessão mudou embaixo dela. */
let geracao = 0;
const ouvintes = new Set<(t: string | null) => void>();
let renovacao: Promise<RespostaSessao | null> | null = null;

export const obterToken = () => token;

export function definirToken(novo: string | null): void {
  token = novo;
  geracao++;
  for (const fn of ouvintes) fn(novo);
}

export function aoMudarSessao(fn: (t: string | null) => void): () => void {
  ouvintes.add(fn);
  return () => ouvintes.delete(fn);
}

async function pedirRefresh(): Promise<Response> {
  return fetch('/api/v1/auth/refresh', { method: 'POST', credentials: 'include' });
}

/**
 * Uma renovação por vez; se outra aba acabou de girar o cookie, a primeira tentativa perde e a
 * segunda acerta. Só limpamos a sessão quando o refresh responde 401 de verdade (sessão inválida);
 * erro de rede, 5xx ou 429 apenas devolvem `null` e quem chamou trata a falha normalmente — o
 * cookie pode estar bom, foi só uma falha passageira. Se a sessão mudou (novo login/token) enquanto
 * essa renovação estava em voo, um 401 atrasado dela não deve apagar a sessão mais nova.
 */
export function renovarSessao(): Promise<RespostaSessao | null> {
  renovacao ??= (async () => {
    const geracaoInicial = geracao;
    try {
      let r = await pedirRefresh();
      if (r.status === 401) {
        await new Promise((ok) => setTimeout(ok, 800));
        r = await pedirRefresh();
      }
      if (r.status === 401) {
        if (geracao === geracaoInicial) definirToken(null);
        return null;
      }
      if (!r.ok) return null;
      const sessao = (await r.json()) as RespostaSessao;
      definirToken(sessao.accessToken);
      return sessao;
    } catch {
      return null;
    } finally {
      renovacao = null;
    }
  })();
  return renovacao;
}
