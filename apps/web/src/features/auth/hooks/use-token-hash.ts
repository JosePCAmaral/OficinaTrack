import { useState } from 'react';

/**
 * Lê o token de `location.hash` uma única vez e limpa o hash da URL (evita reenvio se a
 * página recarregar e evita que fique no histórico/encaminhamentos).
 */
export function useTokenHash(): string {
  const [token] = useState(() => {
    const hash = window.location.hash.replace(/^#/, '');
    if (hash) window.history.replaceState(null, '', window.location.pathname);
    return hash;
  });
  return token;
}
