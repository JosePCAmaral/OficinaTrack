import { linkWhatsApp, mensagemAtualizacao } from '@/lib/whatsapp';
import type { DetalheOS, EventoOSDto, Pagina, UsuarioEu } from '@oficinatrack/shared';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes } from 'react-router';
import { renderizarPaginaAuth as renderizar } from '@/test/renderizar-auth';
import { DetalheOs } from './detalhe-os';

function jsonResposta(corpo: unknown, status = 200) {
  return new Response(JSON.stringify(corpo), { status });
}

function osMock(overrides: Partial<DetalheOS> = {}): DetalheOS {
  return {
    id: 'os-1',
    numero: 1,
    status: 'TRIAGEM',
    statusDesde: new Date().toISOString(),
    criadoEm: new Date().toISOString(),
    relatoCliente: 'Barulho estranho no motor',
    diagnostico: null,
    kmEntrada: 45000,
    previsaoEntrega: null,
    veiculo: { id: 'v1', placa: 'ABC1234', marca: 'VW', modelo: 'Gol', cor: 'Prata', anoModelo: 2015 },
    cliente: { id: 'c1', nome: 'João', telefone: '+5543999998888' },
    responsavel: null,
    ...overrides,
  };
}

function eventoMock(overrides: Partial<EventoOSDto>): EventoOSDto {
  return {
    id: 'ev-x',
    tipo: 'NOTA_INTERNA',
    texto: 'texto',
    visivelCliente: false,
    criadoEm: new Date().toISOString(),
    statusDe: null,
    statusPara: null,
    autor: null,
    retiradoEm: null,
    retiradoPor: null,
    ...overrides,
  };
}

const DONO: UsuarioEu = {
  id: 'u-dono',
  nome: 'Zé',
  email: 'ze@oficina.com',
  perfil: 'DONO',
  permissoes: ['OS_GERENCIAR', 'EQUIPE_GERENCIAR'],
  oficina: { id: 'o1', nome: 'Oficina do Zé' },
};

const FUNCIONARIO: UsuarioEu = {
  id: 'u-func',
  nome: 'Zeca',
  email: 'zeca@oficina.com',
  perfil: 'FUNCIONARIO',
  permissoes: ['OS_GERENCIAR'],
  oficina: { id: 'o1', nome: 'Oficina do Zé' },
};

/** Mock genérico de `fetch` para a tela da OS: eventos mutáveis, publicar/retirar mexem na mesma lista. */
function mockFetch(eventosIniciais: EventoOSDto[], opts: { usuarioAtual?: UsuarioEu } = {}) {
  const eventos = [...eventosIniciais];
  let proximoId = 1;
  const fetchMock = vi.fn<(u: string, i?: RequestInit) => Promise<Response>>().mockImplementation(async (url, init) => {
    const metodo = init?.method ?? 'GET';
    if (url.endsWith('/ordens-servico/os-1') && metodo === 'GET') {
      return jsonResposta(osMock());
    }
    if (url.includes('/ordens-servico/os-1/eventos') && url.includes('/retirar') && metodo === 'POST') {
      const eventoId = url.split('/eventos/')[1]!.split('/retirar')[0]!;
      const evento = eventos.find((e) => e.id === eventoId);
      if (!evento) return jsonResposta({ statusCode: 404, code: 'NAO_ENCONTRADO', message: 'Não encontrado' }, 404);
      evento.retiradoEm = new Date().toISOString();
      evento.retiradoPor = opts.usuarioAtual ? { id: opts.usuarioAtual.id, nome: opts.usuarioAtual.nome } : null;
      return jsonResposta(evento);
    }
    if (url.endsWith('/ordens-servico/os-1/eventos') && metodo === 'POST') {
      const corpo = JSON.parse(init!.body as string) as { tipo: EventoOSDto['tipo']; texto: string };
      const novo: EventoOSDto = {
        id: `ev-novo-${proximoId++}`,
        tipo: corpo.tipo,
        texto: corpo.texto,
        visivelCliente: corpo.tipo === 'ATUALIZACAO_CLIENTE',
        criadoEm: new Date().toISOString(),
        statusDe: null,
        statusPara: null,
        autor: opts.usuarioAtual ? { id: opts.usuarioAtual.id, nome: opts.usuarioAtual.nome } : null,
        retiradoEm: null,
        retiradoPor: null,
      };
      eventos.unshift(novo);
      return jsonResposta(novo, 201);
    }
    if (url.includes('/ordens-servico/os-1/eventos') && metodo === 'GET') {
      return jsonResposta({ itens: [...eventos], proximoCursor: null } satisfies Pagina<EventoOSDto>);
    }
    return jsonResposta({});
  });
  return fetchMock;
}

function renderizarDetalheOs(opts: { usuario?: UsuarioEu | null; tem?: (p: string) => boolean } = {}) {
  return renderizar(
    <Routes>
      <Route path="/painel/os/:id" element={<DetalheOs />} />
    </Routes>,
    {
      auth: { estado: 'autenticado', usuario: opts.usuario ?? null, tem: opts.tem ?? (() => true) },
      rota: '/painel/os/os-1',
    },
  );
}

describe('DetalheOs', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('mostra o cabeçalho com o número da OS', async () => {
    vi.stubGlobal('fetch', mockFetch([eventoMock({ id: 'ev-abertura', tipo: 'OS_ABERTA', texto: null, visivelCliente: true })]));
    renderizarDetalheOs({ usuario: DONO, tem: () => true });

    expect(await screen.findByText('#0001')).toBeInTheDocument();
    expect(screen.getByText('João')).toBeInTheDocument();
  });

  it('cada aba mostra só os eventos do seu tipo; o marco "OS aberta" aparece nas duas', async () => {
    vi.stubGlobal(
      'fetch',
      mockFetch([
        eventoMock({ id: 'ev-abertura', tipo: 'OS_ABERTA', texto: null, visivelCliente: true }),
        eventoMock({ id: 'ev-nota', tipo: 'NOTA_INTERNA', texto: 'Cliente ligou perguntando', autor: { id: 'u-func', nome: 'Zeca' } }),
        eventoMock({ id: 'ev-transf', tipo: 'VEICULO_TRANSFERIDO', texto: 'Veículo transferido de Maria para João', autor: null }),
        eventoMock({
          id: 'ev-atualizacao',
          tipo: 'ATUALIZACAO_CLIENTE',
          texto: 'Já identificamos o problema',
          visivelCliente: true,
          autor: { id: 'u-dono', nome: 'Zé' },
        }),
      ]),
    );
    const usuario = userEvent.setup();
    renderizarDetalheOs({ usuario: DONO, tem: () => true });

    await screen.findByText('#0001');

    // Aba padrão: "Atualizações para o cliente".
    expect(await screen.findByText('Já identificamos o problema')).toBeInTheDocument();
    expect(screen.getAllByText('OS aberta', { exact: false }).length).toBeGreaterThan(0);
    expect(screen.queryByText('Cliente ligou perguntando')).not.toBeInTheDocument();
    expect(screen.queryByText('Veículo transferido de Maria para João')).not.toBeInTheDocument();

    await usuario.click(screen.getByRole('tab', { name: 'Notas internas' }));

    expect(await screen.findByText('Cliente ligou perguntando')).toBeInTheDocument();
    expect(screen.getByText('Veículo transferido de Maria para João')).toBeInTheDocument();
    expect(screen.queryByText('Já identificamos o problema')).not.toBeInTheDocument();
    expect(screen.getAllByText('OS aberta', { exact: false }).length).toBeGreaterThan(0);
  });

  it('publicar na aba de notas internas envia tipo NOTA_INTERNA', async () => {
    const fetchMock = mockFetch([], { usuarioAtual: DONO });
    vi.stubGlobal('fetch', fetchMock);
    const usuario = userEvent.setup();
    renderizarDetalheOs({ usuario: DONO, tem: () => true });

    await screen.findByText('#0001');
    await usuario.click(screen.getByRole('tab', { name: 'Notas internas' }));

    await usuario.type(screen.getByLabelText('Nova nota interna'), 'Peça já pedida ao fornecedor');
    await usuario.click(screen.getByRole('button', { name: 'Publicar' }));

    await waitFor(() => {
      const chamada = fetchMock.mock.calls.find(
        ([url, init]) => (url as string).endsWith('/ordens-servico/os-1/eventos') && (init?.method ?? 'GET') === 'POST',
      );
      expect(chamada).toBeDefined();
      const corpo = JSON.parse(chamada![1]!.body as string) as Record<string, unknown>;
      expect(corpo).toMatchObject({ tipo: 'NOTA_INTERNA', texto: 'Peça já pedida ao fornecedor' });
    });

    expect(await screen.findByText('Peça já pedida ao fornecedor')).toBeInTheDocument();
  });

  it('depois de publicar uma atualização, aparece "Avisar no WhatsApp" com o link de linkWhatsApp', async () => {
    const fetchMock = mockFetch([], { usuarioAtual: DONO });
    vi.stubGlobal('fetch', fetchMock);
    const usuario = userEvent.setup();
    renderizarDetalheOs({ usuario: DONO, tem: () => true });

    await screen.findByText('#0001');
    await usuario.type(screen.getByLabelText('Nova atualização para o cliente'), 'Pronto amanhã de manhã');
    await usuario.click(screen.getByRole('button', { name: 'Publicar' }));

    const link = await screen.findByRole('link', { name: 'Avisar no WhatsApp' });
    const linkEsperado = linkWhatsApp(
      '+5543999998888',
      mensagemAtualizacao({ nomeCliente: 'João', nomeOficina: 'Oficina do Zé', veiculo: { modelo: 'Gol', placa: 'ABC1234' }, texto: 'Pronto amanhã de manhã' }),
    );
    expect(link).toHaveAttribute('href', linkEsperado);
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
  });

  it('"Retirar" pede confirmação, chama o endpoint e o evento aparece riscado sem o botão', async () => {
    const fetchMock = mockFetch(
      [eventoMock({ id: 'ev-atualizacao', tipo: 'ATUALIZACAO_CLIENTE', texto: 'Atualização por engano', visivelCliente: true, autor: { id: 'u-dono', nome: 'Zé' } })],
      { usuarioAtual: DONO },
    );
    vi.stubGlobal('fetch', fetchMock);
    const usuario = userEvent.setup();
    renderizarDetalheOs({ usuario: DONO, tem: () => true });

    await screen.findByText('#0001');
    await screen.findByText('Atualização por engano');

    await usuario.click(screen.getByRole('button', { name: 'Retirar' }));

    const dialogo = await screen.findByRole('alertdialog');
    await usuario.click(within(dialogo).getByRole('button', { name: 'Sim, retirar' }));

    await waitFor(() => {
      const chamada = fetchMock.mock.calls.find(([url]) => (url as string).includes('/eventos/ev-atualizacao/retirar'));
      expect(chamada).toBeDefined();
    });

    expect(await screen.findByText(/Retirada por Zé em/)).toBeInTheDocument();
    expect(screen.getByText('Atualização por engano')).toHaveClass('line-through');
    expect(screen.queryByRole('button', { name: 'Retirar' })).not.toBeInTheDocument();
  });

  it('"Retirar" só aparece para o autor ou para quem tem EQUIPE_GERENCIAR', async () => {
    // FUNCIONARIO sem EQUIPE_GERENCIAR e sem ser o autor: sem botão "Retirar".
    vi.stubGlobal(
      'fetch',
      mockFetch(
        [eventoMock({ id: 'ev-at', tipo: 'ATUALIZACAO_CLIENTE', texto: 'Atualização do dono', visivelCliente: true, autor: { id: 'u-dono', nome: 'Zé' } })],
        { usuarioAtual: FUNCIONARIO },
      ),
    );
    const { unmount } = renderizarDetalheOs({ usuario: FUNCIONARIO, tem: () => false });
    await screen.findByText('#0001');
    await screen.findByText('Atualização do dono');
    expect(screen.queryByRole('button', { name: 'Retirar' })).not.toBeInTheDocument();
    unmount();
    vi.unstubAllGlobals();

    // O próprio autor (mesmo sem EQUIPE_GERENCIAR): botão "Retirar" aparece.
    vi.stubGlobal(
      'fetch',
      mockFetch(
        [eventoMock({ id: 'ev-at', tipo: 'ATUALIZACAO_CLIENTE', texto: 'Atualização do Zeca', visivelCliente: true, autor: { id: 'u-func', nome: 'Zeca' } })],
        { usuarioAtual: FUNCIONARIO },
      ),
    );
    const { unmount: unmount2 } = renderizarDetalheOs({ usuario: FUNCIONARIO, tem: () => false });
    await screen.findByText('#0001');
    await screen.findByText('Atualização do Zeca');
    expect(screen.getByRole('button', { name: 'Retirar' })).toBeInTheDocument();
    unmount2();
    vi.unstubAllGlobals();

    // Não é o autor, mas tem EQUIPE_GERENCIAR: botão "Retirar" aparece.
    vi.stubGlobal(
      'fetch',
      mockFetch(
        [eventoMock({ id: 'ev-at', tipo: 'ATUALIZACAO_CLIENTE', texto: 'Atualização do Zeca', visivelCliente: true, autor: { id: 'u-func', nome: 'Zeca' } })],
        { usuarioAtual: DONO },
      ),
    );
    renderizarDetalheOs({ usuario: DONO, tem: (p) => p === 'EQUIPE_GERENCIAR' });
    await screen.findByText('#0001');
    await screen.findByText('Atualização do Zeca');
    expect(screen.getByRole('button', { name: 'Retirar' })).toBeInTheDocument();
  });

  it('"Retirar" não aparece em NOTA_INTERNA, mesmo para o autor (só a API permite retirar ATUALIZACAO_CLIENTE)', async () => {
    vi.stubGlobal(
      'fetch',
      mockFetch([eventoMock({ id: 'ev-nota', tipo: 'NOTA_INTERNA', texto: 'Nota do próprio dono', autor: { id: 'u-dono', nome: 'Zé' } })], {
        usuarioAtual: DONO,
      }),
    );
    const usuario = userEvent.setup();
    renderizarDetalheOs({ usuario: DONO, tem: () => true });

    await screen.findByText('#0001');
    await usuario.click(screen.getByRole('tab', { name: 'Notas internas' }));

    expect(await screen.findByText('Nota do próprio dono')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Retirar' })).not.toBeInTheDocument();
  });

  it('carregando mostra skeleton e erro mostra "Tentar de novo" (h-11)', async () => {
    let falhar = true;
    const fetchMock = vi.fn<(u: string) => Promise<Response>>().mockImplementation(async (url) => {
      if (url.endsWith('/ordens-servico/os-1')) {
        if (falhar) return jsonResposta({ statusCode: 500, code: 'ERRO_INTERNO', message: 'Erro interno' }, 500);
        return jsonResposta(osMock());
      }
      return jsonResposta({ itens: [], proximoCursor: null } satisfies Pagina<EventoOSDto>);
    });
    vi.stubGlobal('fetch', fetchMock);
    const usuario = userEvent.setup();
    renderizarDetalheOs({ usuario: DONO, tem: () => true });

    const botao = await screen.findByRole('button', { name: 'Tentar de novo' });
    expect(botao).toHaveClass('h-11');

    falhar = false;
    await usuario.click(botao);

    expect(await screen.findByText('#0001')).toBeInTheDocument();
  });

  it('OS inexistente (404) mostra "OS não encontrada" com "Voltar ao início", sem "Tentar de novo"', async () => {
    const fetchMock = vi.fn<(u: string) => Promise<Response>>().mockImplementation(async (url) => {
      if (url.endsWith('/ordens-servico/os-1')) {
        return jsonResposta({ statusCode: 404, code: 'OS_NAO_ENCONTRADA', message: 'OS não encontrada' }, 404);
      }
      return jsonResposta({ itens: [], proximoCursor: null } satisfies Pagina<EventoOSDto>);
    });
    vi.stubGlobal('fetch', fetchMock);
    renderizarDetalheOs({ usuario: DONO, tem: () => true });

    expect(await screen.findByText('OS não encontrada.')).toBeInTheDocument();
    const link = screen.getByRole('link', { name: 'Voltar ao início' });
    expect(link).toHaveAttribute('href', '/painel');
    expect(screen.queryByRole('button', { name: 'Tentar de novo' })).not.toBeInTheDocument();
  });
});
