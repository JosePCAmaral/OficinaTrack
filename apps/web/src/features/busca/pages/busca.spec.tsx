import type { ResultadoBusca } from '@oficinatrack/shared';
import { screen } from '@testing-library/react';
import { Route, Routes } from 'react-router';
import { renderizarPaginaAuth as renderizar } from '@/test/renderizar-auth';
import { Busca } from './busca';

function jsonResposta(corpo: unknown, status = 200) {
  return new Response(JSON.stringify(corpo), { status });
}

function renderizarBusca(rota: string) {
  return renderizar(
    <Routes>
      <Route path="/painel/busca" element={<Busca />} />
    </Routes>,
    { auth: { estado: 'autenticado', usuario: null, tem: () => true }, rota },
  );
}

describe('Busca', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('mostra os resultados em duas seções, Veículos e Clientes', async () => {
    const fetchMock = vi.fn<(u: string) => Promise<Response>>().mockImplementation(async (url) => {
      if (url.includes('/busca')) {
        return jsonResposta({
          clientes: [{ id: 'c1', nome: 'Maria Silva', telefone: '+5543988887777' }],
          veiculos: [{ id: 'v1', placa: 'ABC1234', marca: 'VW', modelo: 'Gol', cliente: { id: 'c1', nome: 'Maria Silva' } }],
        } satisfies ResultadoBusca);
      }
      return jsonResposta({});
    });
    vi.stubGlobal('fetch', fetchMock);
    renderizarBusca('/painel/busca?q=maria');

    expect(await screen.findByRole('heading', { name: 'Veículos' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Clientes' })).toBeInTheDocument();
    expect(screen.getByText(/ABC-1234/)).toBeInTheDocument();
    expect(screen.getAllByText('Maria Silva').length).toBe(2);

    // Veículos aparece antes de Clientes no documento.
    const titulos = screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent);
    expect(titulos.indexOf('Veículos')).toBeLessThan(titulos.indexOf('Clientes'));
  });

  it('sem resultado mostra "Nada encontrado" com botão "Abrir OS" pré-preenchendo a placa quando o termo é uma placa válida', async () => {
    const fetchMock = vi.fn<(u: string) => Promise<Response>>().mockImplementation(async (url) => {
      if (url.includes('/busca')) return jsonResposta({ clientes: [], veiculos: [] } satisfies ResultadoBusca);
      return jsonResposta({});
    });
    vi.stubGlobal('fetch', fetchMock);
    renderizarBusca('/painel/busca?q=ABC1234');

    expect(await screen.findByText('Nada encontrado para "ABC1234".')).toBeInTheDocument();
    const link = screen.getByRole('link', { name: 'Abrir OS' });
    expect(link).toHaveAttribute('href', '/painel/os/nova?placa=ABC1234');
  });

  it('sem resultado e termo que não é placa: botão "Abrir OS" não pré-preenche placa', async () => {
    const fetchMock = vi.fn<(u: string) => Promise<Response>>().mockImplementation(async (url) => {
      if (url.includes('/busca')) return jsonResposta({ clientes: [], veiculos: [] } satisfies ResultadoBusca);
      return jsonResposta({});
    });
    vi.stubGlobal('fetch', fetchMock);
    renderizarBusca('/painel/busca?q=fulano de tal');

    expect(await screen.findByText('Nada encontrado para "fulano de tal".')).toBeInTheDocument();
    const link = screen.getByRole('link', { name: 'Abrir OS' });
    expect(link).toHaveAttribute('href', '/painel/os/nova');
  });

  it('termo com 1 caractere mostra a mensagem do schema sem chamar a API', async () => {
    const fetchMock = vi.fn<(u: string) => Promise<Response>>().mockImplementation(async (url) => jsonResposta({ url }));
    vi.stubGlobal('fetch', fetchMock);
    renderizarBusca('/painel/busca?q=a');

    expect(await screen.findByText('Digite pelo menos 2 caracteres')).toBeInTheDocument();
    expect(fetchMock.mock.calls.some(([url]) => (url as string).includes('/busca'))).toBe(false);
  });
});
