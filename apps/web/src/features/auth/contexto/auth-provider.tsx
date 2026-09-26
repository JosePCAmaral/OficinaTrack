import type { Permissao, RespostaSessao, UsuarioEu } from '@oficinatrack/shared';
import { createContext, useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { aoMudarSessao, definirToken, renovarSessao } from '@/lib/sessao';

export type EstadoAuth = 'carregando' | 'anonimo' | 'autenticado';
export type ValorAuth = {
  estado: EstadoAuth;
  usuario: UsuarioEu | null;
  entrar: (r: RespostaSessao) => void;
  sair: () => Promise<void>;
  recarregar: () => Promise<void>;
  tem: (p: Permissao) => boolean;
};
export const ContextoAuth = createContext<ValorAuth | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [usuario, setUsuario] = useState<UsuarioEu | null>(null);
  const [estado, setEstado] = useState<EstadoAuth>('carregando');
  const cliente = useQueryClient();

  useEffect(() => {
    let ativo = true;
    void renovarSessao().then((s) => {
      if (!ativo) return;
      setUsuario(s?.usuario ?? null);
      setEstado(s ? 'autenticado' : 'anonimo');
    });
    const parar = aoMudarSessao((t) => {
      if (t === null) {
        setUsuario(null);
        setEstado('anonimo');
        cliente.clear();
      }
    });
    return () => {
      ativo = false;
      parar();
    };
  }, [cliente]);

  const entrar = useCallback((r: RespostaSessao) => {
    definirToken(r.accessToken);
    setUsuario(r.usuario);
    setEstado('autenticado');
  }, []);

  const sair = useCallback(async () => {
    await api('/auth/logout', { method: 'POST' }).catch(() => undefined);
    definirToken(null);
  }, []);

  const recarregar = useCallback(async () => {
    setUsuario(await api<UsuarioEu>('/auth/eu'));
  }, []);

  const valor = useMemo<ValorAuth>(
    () => ({ estado, usuario, entrar, sair, recarregar, tem: (p) => usuario?.permissoes.includes(p) ?? false }),
    [estado, usuario, entrar, sair, recarregar],
  );
  return <ContextoAuth.Provider value={valor}>{children}</ContextoAuth.Provider>;
}
