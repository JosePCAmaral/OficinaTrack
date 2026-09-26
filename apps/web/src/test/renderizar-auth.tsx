import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render } from '@testing-library/react';
import type { ReactElement } from 'react';
import { MemoryRouter, useLocation } from 'react-router';
import { ContextoAuth, type ValorAuth } from '@/features/auth/contexto/auth-provider';

/** Mostra a rota atual em texto, para os testes afirmarem que houve navegação sem precisar montar as telas de destino. */
function SondaDeRota() {
  const location = useLocation();
  return <p data-testid="rota-atual">{location.pathname}</p>;
}

/**
 * Renderiza uma página pública isolada, sem o `AuthProvider` real (que chama `/auth/refresh` ao
 * montar): usamos o contexto diretamente com um valor de teste para poder afirmar "nenhuma
 * chamada à API" nas telas que só devem agir depois de um clique (Review Focus 3).
 */
export function renderizarPaginaAuth(ui: ReactElement, opcoes: { auth?: Partial<ValorAuth>; rota?: string } = {}) {
  const cliente = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const valorAuth: ValorAuth = {
    estado: 'anonimo',
    usuario: null,
    entrar: () => {},
    sair: async () => {},
    recarregar: async () => {},
    tem: () => false,
    ...opcoes.auth,
  };
  return render(
    <QueryClientProvider client={cliente}>
      <MemoryRouter initialEntries={[opcoes.rota ?? '/']}>
        <ContextoAuth.Provider value={valorAuth}>
          {ui}
          <SondaDeRota />
        </ContextoAuth.Provider>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}
