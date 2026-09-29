import type { FichaCliente as FichaClienteDto, Pagina, ResumoOS } from '@oficinatrack/shared';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes } from 'react-router';
import { renderizarPaginaAuth as renderizar } from '@/test/renderizar-auth';
import { FichaCliente } from './ficha-cliente';

function jsonResposta(corpo: unknown, status = 200) {
  return new Response(JSON.stringify(corpo), { status });
}

function fichaMock(overrides: Partial<FichaClienteDto> = {}): FichaClienteDto {
  return {
    id: 'c1',
    nome: 'Maria Silva',
    telefone: '+5543988887777',
    email: null,
    documento: null,
    observacoes: 'Cliente antiga, sempre paga à vista.',
    criadoEm: new Date().toISOString(),
    veiculos: [{ id: 'v1', placa: 'ABC1234', marca: 'VW', modelo: 'Gol' }],
    ...overrides,
  };
}

function renderizarFicha(opts: { patch?: (corpo: Record<string, unknown>) => Response } = {}) {
  const fetchMock = vi.fn<(u: string, i?: RequestInit) => Promise<Response>>().mockImplementation(async (url, init) => {
    const metodo = init?.method ?? 'GET';
    if (url.endsWith('/clientes/c1') && metodo === 'GET') return jsonResposta(fichaMock());
    if (url.endsWith('/clientes/c1') && metodo === 'PATCH') {
      const corpo = JSON.parse(init!.body as string) as Record<string, unknown>;
      return opts.patch ? opts.patch(corpo) : jsonResposta(fichaMock());
    }
    if (url.includes('/clientes/c1/ordens-servico')) return jsonResposta({ itens: [], proximoCursor: null } satisfies Pagina<ResumoOS>);
    return jsonResposta({});
  });
  vi.stubGlobal('fetch', fetchMock);
  renderizar(
    <Routes>
      <Route path="/painel/clientes/:id" element={<FichaCliente />} />
    </Routes>,
    { auth: { estado: 'autenticado', usuario: null, tem: () => true }, rota: '/painel/clientes/c1' },
  );
  return fetchMock;
}

describe('FichaCliente', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('mostra os dados, as observações marcadas "Só a oficina vê" e o veículo com link para a ficha', async () => {
    renderizarFicha();

    expect(await screen.findByText('Maria Silva')).toBeInTheDocument();
    expect(screen.getByText(/Só a oficina vê/)).toBeInTheDocument();
    expect(screen.getByText('Cliente antiga, sempre paga à vista.')).toBeInTheDocument();

    const linkVeiculo = screen.getByRole('link', { name: /ABC-1234/ });
    expect(linkVeiculo).toHaveAttribute('href', '/painel/veiculos/v1');
  });

  it('editar com telefone já usado por outro cliente mostra o erro no campo WhatsApp', async () => {
    const usuario = userEvent.setup();
    renderizarFicha({
      patch: () =>
        jsonResposta({ statusCode: 409, code: 'TELEFONE_JA_CADASTRADO', message: 'Telefone já cadastrado para outro cliente' }, 409),
    });

    await screen.findByText('Maria Silva');
    await usuario.click(screen.getByRole('button', { name: 'Editar' }));

    const campoTelefone = await screen.findByLabelText('WhatsApp');
    await usuario.clear(campoTelefone);
    await usuario.type(campoTelefone, '43977776666');
    await usuario.click(screen.getByRole('button', { name: 'Salvar' }));

    expect(await screen.findByText('Telefone já cadastrado para outro cliente')).toBeInTheDocument();
    // A sheet continua aberta (não fechou com erro).
    expect(screen.getByRole('button', { name: 'Salvar' })).toBeInTheDocument();
  });

  it('editar com sucesso fecha a sheet e atualiza os dados exibidos', async () => {
    const usuario = userEvent.setup();
    renderizarFicha({ patch: (corpo) => jsonResposta(fichaMock({ nome: corpo.nome as string })) });

    await screen.findByText('Maria Silva');
    await usuario.click(screen.getByRole('button', { name: 'Editar' }));

    const campoNome = await screen.findByLabelText('Nome');
    await usuario.clear(campoNome);
    await usuario.type(campoNome, 'Maria S. Silva');
    await usuario.click(screen.getByRole('button', { name: 'Salvar' }));

    await waitFor(() => expect(screen.queryByRole('button', { name: 'Salvar' })).not.toBeInTheDocument());
    expect(await screen.findByText('Maria S. Silva')).toBeInTheDocument();
  });

  it('editar com sucesso invalida o histórico de OS (CartaoOS usa o nome do cliente do cache antigo)', async () => {
    const usuario = userEvent.setup();
    let chamadasHistorico = 0;
    const fetchMock = vi.fn<(u: string, i?: RequestInit) => Promise<Response>>().mockImplementation(async (url, init) => {
      const metodo = init?.method ?? 'GET';
      if (url.endsWith('/clientes/c1') && metodo === 'GET') return jsonResposta(fichaMock());
      if (url.endsWith('/clientes/c1') && metodo === 'PATCH') {
        const corpo = JSON.parse(init!.body as string) as Record<string, unknown>;
        return jsonResposta(fichaMock({ nome: corpo.nome as string }));
      }
      if (url.includes('/clientes/c1/ordens-servico')) {
        chamadasHistorico += 1;
        return jsonResposta({ itens: [], proximoCursor: null } satisfies Pagina<ResumoOS>);
      }
      return jsonResposta({});
    });
    vi.stubGlobal('fetch', fetchMock);
    renderizar(
      <Routes>
        <Route path="/painel/clientes/:id" element={<FichaCliente />} />
      </Routes>,
      { auth: { estado: 'autenticado', usuario: null, tem: () => true }, rota: '/painel/clientes/c1' },
    );

    await screen.findByText('Maria Silva');
    await waitFor(() => expect(chamadasHistorico).toBe(1));

    await usuario.click(screen.getByRole('button', { name: 'Editar' }));
    const campoNome = await screen.findByLabelText('Nome');
    await usuario.clear(campoNome);
    await usuario.type(campoNome, 'Maria S. Silva');
    await usuario.click(screen.getByRole('button', { name: 'Salvar' }));

    await waitFor(() => expect(screen.queryByRole('button', { name: 'Salvar' })).not.toBeInTheDocument());
    // A invalidação de ['cliente', id, 'ordens-servico'] dispara um novo GET do histórico.
    await waitFor(() => expect(chamadasHistorico).toBeGreaterThanOrEqual(2));
  });

  it('limpar o e-mail (campo opcional) envia email: null no PATCH', async () => {
    const usuario = userEvent.setup();
    let corpoEnviado: Record<string, unknown> = {};
    const fetchMock = vi.fn<(u: string, i?: RequestInit) => Promise<Response>>().mockImplementation(async (url, init) => {
      const metodo = init?.method ?? 'GET';
      if (url.endsWith('/clientes/c1') && metodo === 'GET') return jsonResposta(fichaMock({ email: 'maria@exemplo.com' }));
      if (url.endsWith('/clientes/c1') && metodo === 'PATCH') {
        corpoEnviado = JSON.parse(init!.body as string) as Record<string, unknown>;
        return jsonResposta(fichaMock({ email: null }));
      }
      if (url.includes('/clientes/c1/ordens-servico')) return jsonResposta({ itens: [], proximoCursor: null } satisfies Pagina<ResumoOS>);
      return jsonResposta({});
    });
    vi.stubGlobal('fetch', fetchMock);
    renderizar(
      <Routes>
        <Route path="/painel/clientes/:id" element={<FichaCliente />} />
      </Routes>,
      { auth: { estado: 'autenticado', usuario: null, tem: () => true }, rota: '/painel/clientes/c1' },
    );

    await screen.findByText('Maria Silva');
    await usuario.click(screen.getByRole('button', { name: 'Editar' }));

    const campoEmail = await screen.findByLabelText('E-mail');
    expect(campoEmail).toHaveValue('maria@exemplo.com');
    await usuario.clear(campoEmail);
    await usuario.click(screen.getByRole('button', { name: 'Salvar' }));

    await waitFor(() => expect(corpoEnviado.email).toBeNull());
  });

  it('cliente inexistente (404) mostra "Cliente não encontrado" com "Voltar ao início"', async () => {
    const fetchMock = vi.fn<(u: string) => Promise<Response>>().mockImplementation(async (url) => {
      if (url.endsWith('/clientes/c1')) return jsonResposta({ statusCode: 404, code: 'CLIENTE_NAO_ENCONTRADO', message: 'Não encontrado' }, 404);
      return jsonResposta({ itens: [], proximoCursor: null } satisfies Pagina<ResumoOS>);
    });
    vi.stubGlobal('fetch', fetchMock);
    renderizar(
      <Routes>
        <Route path="/painel/clientes/:id" element={<FichaCliente />} />
      </Routes>,
      { auth: { estado: 'autenticado', usuario: null, tem: () => true }, rota: '/painel/clientes/c1' },
    );

    expect(await screen.findByText('Cliente não encontrado.')).toBeInTheDocument();
    const link = screen.getByRole('link', { name: 'Voltar ao início' });
    expect(link).toHaveAttribute('href', '/painel');
  });
});
