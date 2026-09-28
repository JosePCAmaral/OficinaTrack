import type { Pagina, ResumoOS } from '@oficinatrack/shared';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderizarPaginaAuth as renderizar } from '@/test/renderizar-auth';
import { InicioOs } from './inicio-os';

function osResumo(overrides: Partial<ResumoOS> = {}): ResumoOS {
  return {
    id: 'os-1',
    numero: 12,
    status: 'TRIAGEM',
    statusDesde: new Date(Date.now() - 5 * 60_000).toISOString(),
    criadoEm: new Date(Date.now() - 5 * 60_000).toISOString(),
    placa: 'ABC1234',
    modelo: 'Gol',
    cliente: { id: 'c1', nome: 'João' },
    relatoCliente: 'Barulho no motor',
    ...overrides,
  };
}

function jsonResposta(corpo: unknown, status = 200) {
  return new Response(JSON.stringify(corpo), { status });
}

describe('InicioOs', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('lista as OS em aberto (número, placa, modelo, cliente e tempo)', async () => {
    const fetchMock = vi
      .fn<(u: string) => Promise<Response>>()
      .mockImplementation(async (url) =>
        url.includes('/ordens-servico')
          ? jsonResposta({ itens: [osResumo()], proximoCursor: null } satisfies Pagina<ResumoOS>)
          : jsonResposta({}),
      );
    vi.stubGlobal('fetch', fetchMock);
    renderizar(<InicioOs />, { auth: { estado: 'autenticado', usuario: null, tem: () => true } });

    expect(await screen.findByText('#0012')).toBeInTheDocument();
    expect(screen.getByText('ABC-1234 · Gol')).toBeInTheDocument();
    expect(screen.getByText('João')).toBeInTheDocument();
    expect(screen.getByText('há 5 min')).toBeInTheDocument();
    expect(fetchMock.mock.calls[0]![0]).toContain('/ordens-servico?situacao=abertas');
  });

  it('lista vazia mostra a mensagem e o botão de abrir OS continua visível', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn<(u: string) => Promise<Response>>().mockImplementation(async (url) =>
        url.includes('/ordens-servico') ? jsonResposta({ itens: [], proximoCursor: null } satisfies Pagina<ResumoOS>) : jsonResposta({}),
      ),
    );
    renderizar(<InicioOs />, { auth: { estado: 'autenticado', usuario: null, tem: () => true } });

    expect(await screen.findByText('Nenhuma OS em aberto. Toque em Abrir OS para começar.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Abrir OS/ })).toBeInTheDocument();
  });

  it('erro mostra "Tentar de novo" (h-11) e refaz a busca ao clicar', async () => {
    let falhar = true;
    const fetchMock = vi.fn<(u: string) => Promise<Response>>().mockImplementation(async (url) => {
      if (!url.includes('/ordens-servico')) return jsonResposta({});
      if (falhar) return jsonResposta({ statusCode: 500, code: 'ERRO_INTERNO', message: 'Erro interno' }, 500);
      return jsonResposta({ itens: [osResumo()], proximoCursor: null } satisfies Pagina<ResumoOS>);
    });
    vi.stubGlobal('fetch', fetchMock);
    const usuario = userEvent.setup();
    renderizar(<InicioOs />, { auth: { estado: 'autenticado', usuario: null, tem: () => true } });

    const botao = await screen.findByRole('button', { name: 'Tentar de novo' });
    expect(botao).toHaveClass('h-11');

    falhar = false;
    await usuario.click(botao);

    expect(await screen.findByText('#0012')).toBeInTheDocument();
  });

  it('"Carregar mais" busca a próxima página pelo cursor e anexa os itens', async () => {
    const fetchMock = vi.fn<(u: string) => Promise<Response>>().mockImplementation(async (url) => {
      if (!url.includes('/ordens-servico')) return jsonResposta({});
      if (url.includes('cursor=cursor-1')) {
        return jsonResposta({ itens: [osResumo({ id: 'os-2', numero: 13 })], proximoCursor: null } satisfies Pagina<ResumoOS>);
      }
      return jsonResposta({ itens: [osResumo()], proximoCursor: 'cursor-1' } satisfies Pagina<ResumoOS>);
    });
    vi.stubGlobal('fetch', fetchMock);
    const usuario = userEvent.setup();
    renderizar(<InicioOs />, { auth: { estado: 'autenticado', usuario: null, tem: () => true } });

    await usuario.click(await screen.findByRole('button', { name: 'Carregar mais' }));

    expect(await screen.findByText('#0013')).toBeInTheDocument();
    expect(screen.getByText('#0012')).toBeInTheDocument();
  });
});
