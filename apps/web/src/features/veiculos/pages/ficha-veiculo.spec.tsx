import type { FichaVeiculo as FichaVeiculoDto, Pagina, ResumoOS } from '@oficinatrack/shared';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes } from 'react-router';
import { renderizarPaginaAuth as renderizar } from '@/test/renderizar-auth';
import { FichaVeiculo } from './ficha-veiculo';

function jsonResposta(corpo: unknown, status = 200) {
  return new Response(JSON.stringify(corpo), { status });
}

function fichaMock(overrides: Partial<FichaVeiculoDto> = {}): FichaVeiculoDto {
  return {
    id: 'v1',
    placa: 'ABC1234',
    marca: 'VW',
    modelo: 'Gol',
    anoModelo: 2015,
    cor: 'Prata',
    chassi: null,
    kmAtual: 45000,
    criadoEm: new Date().toISOString(),
    cliente: { id: 'c1', nome: 'Maria Silva', telefone: '+5543988887777' },
    ...overrides,
  };
}

function renderizarFicha(opts: { patch?: (corpo: Record<string, unknown>) => Response } = {}) {
  const fetchMock = vi.fn<(u: string, i?: RequestInit) => Promise<Response>>().mockImplementation(async (url, init) => {
    const metodo = init?.method ?? 'GET';
    if (url.endsWith('/veiculos/v1') && metodo === 'GET') return jsonResposta(fichaMock());
    if (url.endsWith('/veiculos/v1') && metodo === 'PATCH') {
      const corpo = JSON.parse(init!.body as string) as Record<string, unknown>;
      return opts.patch ? opts.patch(corpo) : jsonResposta(fichaMock());
    }
    if (url.includes('/veiculos/v1/ordens-servico')) return jsonResposta({ itens: [], proximoCursor: null } satisfies Pagina<ResumoOS>);
    return jsonResposta({});
  });
  vi.stubGlobal('fetch', fetchMock);
  renderizar(
    <Routes>
      <Route path="/painel/veiculos/:id" element={<FichaVeiculo />} />
    </Routes>,
    { auth: { estado: 'autenticado', usuario: null, tem: () => true }, rota: '/painel/veiculos/v1' },
  );
  return fetchMock;
}

describe('FichaVeiculo', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('mostra os dados, o dono com link para a ficha do cliente, e "Abrir OS para este carro" navega com a placa', async () => {
    renderizarFicha();

    expect(await screen.findByText('ABC-1234')).toBeInTheDocument();
    expect(screen.getByText('Maria Silva')).toBeInTheDocument();

    const linkDono = screen.getByRole('link', { name: /Maria Silva/ });
    expect(linkDono).toHaveAttribute('href', '/painel/clientes/c1');

    const linkAbrirOs = screen.getByRole('link', { name: 'Abrir OS para este carro' });
    expect(linkAbrirOs).toHaveAttribute('href', '/painel/os/nova?placa=ABC1234');
  });

  it('editar com placa já usada por outro veículo mostra o erro no campo placa', async () => {
    const usuario = userEvent.setup();
    renderizarFicha({
      patch: () => jsonResposta({ statusCode: 409, code: 'PLACA_JA_CADASTRADA', message: 'Placa já cadastrada para outro veículo' }, 409),
    });

    await screen.findByText('ABC-1234');
    await usuario.click(screen.getByRole('button', { name: 'Editar' }));

    const campoPlaca = await screen.findByLabelText('Placa');
    await usuario.clear(campoPlaca);
    await usuario.type(campoPlaca, 'XYZ9876');
    await usuario.click(screen.getByRole('button', { name: 'Salvar' }));

    expect(await screen.findByText('Placa já cadastrada para outro veículo')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Salvar' })).toBeInTheDocument();
  });

  it('editar com sucesso fecha a sheet e atualiza os dados exibidos', async () => {
    const usuario = userEvent.setup();
    renderizarFicha({ patch: (corpo) => jsonResposta(fichaMock({ cor: corpo.cor as string })) });

    await screen.findByText('ABC-1234');
    await usuario.click(screen.getByRole('button', { name: 'Editar' }));

    const campoCor = await screen.findByLabelText('Cor');
    await usuario.clear(campoCor);
    await usuario.type(campoCor, 'Preto');
    await usuario.click(screen.getByRole('button', { name: 'Salvar' }));

    await waitFor(() => expect(screen.queryByRole('button', { name: 'Salvar' })).not.toBeInTheDocument());
    expect(await screen.findByText('Preto')).toBeInTheDocument();
  });

  it('editar com sucesso invalida o histórico de OS (CartaoOS usa a placa/modelo do cache antigo)', async () => {
    const usuario = userEvent.setup();
    let chamadasHistorico = 0;
    const fetchMock = vi.fn<(u: string, i?: RequestInit) => Promise<Response>>().mockImplementation(async (url, init) => {
      const metodo = init?.method ?? 'GET';
      if (url.endsWith('/veiculos/v1') && metodo === 'GET') return jsonResposta(fichaMock());
      if (url.endsWith('/veiculos/v1') && metodo === 'PATCH') {
        const corpo = JSON.parse(init!.body as string) as Record<string, unknown>;
        return jsonResposta(fichaMock({ modelo: corpo.modelo as string }));
      }
      if (url.includes('/veiculos/v1/ordens-servico')) {
        chamadasHistorico += 1;
        return jsonResposta({ itens: [], proximoCursor: null } satisfies Pagina<ResumoOS>);
      }
      return jsonResposta({});
    });
    vi.stubGlobal('fetch', fetchMock);
    renderizar(
      <Routes>
        <Route path="/painel/veiculos/:id" element={<FichaVeiculo />} />
      </Routes>,
      { auth: { estado: 'autenticado', usuario: null, tem: () => true }, rota: '/painel/veiculos/v1' },
    );

    await screen.findByText('ABC-1234');
    await waitFor(() => expect(chamadasHistorico).toBe(1));

    await usuario.click(screen.getByRole('button', { name: 'Editar' }));
    const campoModelo = await screen.findByLabelText('Modelo');
    await usuario.clear(campoModelo);
    await usuario.type(campoModelo, 'Gol G6');
    await usuario.click(screen.getByRole('button', { name: 'Salvar' }));

    await waitFor(() => expect(screen.queryByRole('button', { name: 'Salvar' })).not.toBeInTheDocument());
    // A invalidação de ['veiculo', id, 'ordens-servico'] dispara um novo GET do histórico.
    await waitFor(() => expect(chamadasHistorico).toBeGreaterThanOrEqual(2));
  });

  it('limpar o chassi (campo opcional) envia chassi: null no PATCH', async () => {
    const usuario = userEvent.setup();
    let corpoEnviado: Record<string, unknown> = {};
    const fetchMock = vi.fn<(u: string, i?: RequestInit) => Promise<Response>>().mockImplementation(async (url, init) => {
      const metodo = init?.method ?? 'GET';
      if (url.endsWith('/veiculos/v1') && metodo === 'GET') return jsonResposta(fichaMock({ chassi: '9BWZZZ377VT004251' }));
      if (url.endsWith('/veiculos/v1') && metodo === 'PATCH') {
        corpoEnviado = JSON.parse(init!.body as string) as Record<string, unknown>;
        return jsonResposta(fichaMock({ chassi: null }));
      }
      if (url.includes('/veiculos/v1/ordens-servico')) return jsonResposta({ itens: [], proximoCursor: null } satisfies Pagina<ResumoOS>);
      return jsonResposta({});
    });
    vi.stubGlobal('fetch', fetchMock);
    renderizar(
      <Routes>
        <Route path="/painel/veiculos/:id" element={<FichaVeiculo />} />
      </Routes>,
      { auth: { estado: 'autenticado', usuario: null, tem: () => true }, rota: '/painel/veiculos/v1' },
    );

    await screen.findByText('ABC-1234');
    await usuario.click(screen.getByRole('button', { name: 'Editar' }));

    const campoChassi = await screen.findByLabelText('Chassi');
    expect(campoChassi).toHaveValue('9BWZZZ377VT004251');
    await usuario.clear(campoChassi);
    await usuario.click(screen.getByRole('button', { name: 'Salvar' }));

    await waitFor(() => expect(corpoEnviado.chassi).toBeNull());
  });

  it('veículo inexistente (404) mostra "Veículo não encontrado" com "Voltar ao início"', async () => {
    const fetchMock = vi.fn<(u: string) => Promise<Response>>().mockImplementation(async (url) => {
      if (url.endsWith('/veiculos/v1')) return jsonResposta({ statusCode: 404, code: 'VEICULO_NAO_ENCONTRADO', message: 'Não encontrado' }, 404);
      return jsonResposta({ itens: [], proximoCursor: null } satisfies Pagina<ResumoOS>);
    });
    vi.stubGlobal('fetch', fetchMock);
    renderizar(
      <Routes>
        <Route path="/painel/veiculos/:id" element={<FichaVeiculo />} />
      </Routes>,
      { auth: { estado: 'autenticado', usuario: null, tem: () => true }, rota: '/painel/veiculos/v1' },
    );

    expect(await screen.findByText('Veículo não encontrado.')).toBeInTheDocument();
    const link = screen.getByRole('link', { name: 'Voltar ao início' });
    expect(link).toHaveAttribute('href', '/painel');
  });
});
