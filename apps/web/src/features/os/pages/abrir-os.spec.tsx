import type { ConsultaPlaca, UsuarioEu } from '@oficinatrack/shared';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderizarPaginaAuth as renderizar } from '@/test/renderizar-auth';
import { AbrirOs } from './abrir-os';

function jsonResposta(corpo: unknown, status = 200) {
  return new Response(JSON.stringify(corpo), { status });
}

function corpoDoEnvio(init?: RequestInit): Record<string, unknown> {
  return init?.body ? (JSON.parse(init.body as string) as Record<string, unknown>) : {};
}

/** Mock genérico: `post` decide a resposta de cada `POST /ordens-servico` (1ª, 2ª chamada...). */
function mockFetch(opts: {
  post: (corpo: Record<string, unknown>, chamada: number) => Response;
  consulta?: (placa: string) => Response;
  usuarios?: unknown[];
}) {
  let chamadasPost = 0;
  return vi.fn<(u: string, i?: RequestInit) => Promise<Response>>().mockImplementation(async (url, init) => {
    const metodo = init?.method ?? 'GET';
    if (url.includes('/veiculos/consulta')) {
      if (opts.consulta) {
        const placa = new URL(url, 'http://localhost').searchParams.get('placa') ?? '';
        return opts.consulta(placa);
      }
      return jsonResposta({ statusCode: 404, code: 'VEICULO_NAO_ENCONTRADO', message: 'Placa não encontrada' }, 404);
    }
    if (url.endsWith('/usuarios') && metodo === 'GET') {
      return jsonResposta(opts.usuarios ?? []);
    }
    if (url.endsWith('/ordens-servico') && metodo === 'POST') {
      chamadasPost += 1;
      return opts.post(corpoDoEnvio(init), chamadasPost);
    }
    return jsonResposta({});
  });
}

async function preencherObrigatorios(
  usuario: ReturnType<typeof userEvent.setup>,
  { placa = 'ABC1234', telefone = '43999998888', queixa = 'Barulho estranho no motor' } = {},
) {
  await usuario.type(screen.getByLabelText('Placa'), placa);
  await usuario.type(screen.getByLabelText('WhatsApp do cliente'), telefone);
  await usuario.type(screen.getByLabelText('Queixa do cliente'), queixa);
}

describe('AbrirOs', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('D4: 409 OS_ABERTA_EXISTENTE mostra o diálogo e "Criar nova mesmo assim" reenvia com criarMesmoComOsAberta', async () => {
    const fetchMock = mockFetch({
      post: (corpo, chamada) => {
        if (chamada === 1) {
          return jsonResposta(
            {
              statusCode: 409,
              code: 'OS_ABERTA_EXISTENTE',
              message: 'Este carro já está em uma OS aberta',
              details: { id: 'os-9', numero: 12, criadoEm: new Date().toISOString() },
            },
            409,
          );
        }
        expect(corpo.criarMesmoComOsAberta).toBe(true);
        return jsonResposta({ id: 'os-10', numero: 13 }, 201);
      },
    });
    vi.stubGlobal('fetch', fetchMock);
    const usuario = userEvent.setup();
    renderizar(<AbrirOs />, { auth: { estado: 'autenticado', usuario: null, tem: () => false }, rota: '/painel/os/nova' });

    await preencherObrigatorios(usuario);
    await usuario.click(screen.getByRole('button', { name: 'Abrir OS' }));

    expect(await screen.findByText(/OS #0012/)).toBeInTheDocument();

    await usuario.click(screen.getByRole('button', { name: 'Criar nova mesmo assim' }));

    await waitFor(() => expect(screen.getByTestId('rota-atual')).toHaveTextContent('/painel/os/os-10'));
  });

  it('D1: 409 VEICULO_DE_OUTRO_CLIENTE mostra dono e final do telefone; "Sim" reenvia com transferirVeiculo=true', async () => {
    const fetchMock = mockFetch({
      post: (corpo, chamada) => {
        if (chamada === 1) {
          return jsonResposta(
            {
              statusCode: 409,
              code: 'VEICULO_DE_OUTRO_CLIENTE',
              message: 'Veículo cadastrado com outro cliente',
              details: { dono: { nome: 'João Antigo', telefoneFinal: '8888' } },
            },
            409,
          );
        }
        expect(corpo.transferirVeiculo).toBe(true);
        return jsonResposta({ id: 'os-11', numero: 14 }, 201);
      },
    });
    vi.stubGlobal('fetch', fetchMock);
    const usuario = userEvent.setup();
    renderizar(<AbrirOs />, { auth: { estado: 'autenticado', usuario: null, tem: () => false }, rota: '/painel/os/nova' });

    await preencherObrigatorios(usuario, { telefone: '43977776666', queixa: 'Troca de óleo e revisão' });
    await usuario.click(screen.getByRole('button', { name: 'Abrir OS' }));

    const dialogo = await screen.findByRole('alertdialog');
    expect(within(dialogo).getByText(/João Antigo/)).toBeInTheDocument();
    expect(within(dialogo).getByText(/8888/)).toBeInTheDocument();

    await usuario.click(within(dialogo).getByRole('button', { name: /^Sim, passar para/ }));

    await waitFor(() => expect(screen.getByTestId('rota-atual')).toHaveTextContent('/painel/os/os-11'));
  });

  it('placa digitada em minúsculas aparece em maiúsculas e a consulta preenche o WhatsApp', async () => {
    const fetchMock = mockFetch({
      post: () => jsonResposta({ id: 'os-x', numero: 1 }, 201),
      consulta: (placa) => {
        expect(placa).toBe('ABC1234');
        return jsonResposta(
          {
            veiculo: {
              id: 'v1',
              placa: 'ABC1234',
              marca: 'VW',
              modelo: 'Gol',
              anoModelo: 2015,
              cor: 'Prata',
              chassi: null,
              kmAtual: 1000,
              criadoEm: new Date().toISOString(),
              cliente: { id: 'c1', nome: 'Maria', telefone: '+5543988887777' },
            },
            osAberta: null,
          } satisfies ConsultaPlaca,
          200,
        );
      },
    });
    vi.stubGlobal('fetch', fetchMock);
    const usuario = userEvent.setup();
    renderizar(<AbrirOs />, { auth: { estado: 'autenticado', usuario: null, tem: () => false }, rota: '/painel/os/nova' });

    const campoPlaca = screen.getByLabelText('Placa');
    await usuario.type(campoPlaca, 'abc1234');
    expect(campoPlaca).toHaveValue('ABC1234');

    await usuario.tab();

    expect(await screen.findByText('Gol · Prata')).toBeInTheDocument();
    expect(screen.getByDisplayValue('(43) 98888-7777')).toBeInTheDocument();
  });

  it('queixa curta mostra erro do schema e não chama a API', async () => {
    const fetchMock = mockFetch({ post: () => jsonResposta({ id: 'os-y', numero: 1 }, 201) });
    vi.stubGlobal('fetch', fetchMock);
    const usuario = userEvent.setup();
    renderizar(<AbrirOs />, { auth: { estado: 'autenticado', usuario: null, tem: () => false }, rota: '/painel/os/nova' });

    await usuario.type(screen.getByLabelText('Placa'), 'ABC1234');
    await usuario.type(screen.getByLabelText('WhatsApp do cliente'), '43999998888');
    await usuario.type(screen.getByLabelText('Queixa do cliente'), 'ok');
    await usuario.click(screen.getByRole('button', { name: 'Abrir OS' }));

    expect(await screen.findByText('Descreva a queixa do cliente')).toBeInTheDocument();
    expect(
      fetchMock.mock.calls.some(([url, init]) => (url as string).endsWith('/ordens-servico') && (init?.method ?? 'GET') === 'POST'),
    ).toBe(false);
  });

  it('D4 respondido inline preserva criarMesmoComOsAberta quando o mesmo envio cai no D1 (dono diferente)', async () => {
    const corposEnviados: Record<string, unknown>[] = [];
    const fetchMock = mockFetch({
      post: (corpo, chamada) => {
        corposEnviados.push(corpo);
        if (chamada === 1) {
          return jsonResposta(
            {
              statusCode: 409,
              code: 'VEICULO_DE_OUTRO_CLIENTE',
              message: 'Veículo cadastrado com outro cliente',
              details: { dono: { nome: 'João Antigo', telefoneFinal: '8888' } },
            },
            409,
          );
        }
        return jsonResposta({ id: 'os-12', numero: 15 }, 201);
      },
      consulta: (placa) => {
        expect(placa).toBe('ABC1234');
        return jsonResposta(
          {
            veiculo: {
              id: 'v1',
              placa: 'ABC1234',
              marca: 'VW',
              modelo: 'Gol',
              anoModelo: 2015,
              cor: 'Prata',
              chassi: null,
              kmAtual: 1000,
              criadoEm: new Date().toISOString(),
              cliente: { id: 'c1', nome: 'Maria', telefone: '+5543988887777' },
            },
            osAberta: { id: 'os-9', numero: 12, criadoEm: new Date().toISOString() },
          } satisfies ConsultaPlaca,
          200,
        );
      },
    });
    vi.stubGlobal('fetch', fetchMock);
    const usuario = userEvent.setup();
    renderizar(<AbrirOs />, { auth: { estado: 'autenticado', usuario: null, tem: () => false }, rota: '/painel/os/nova' });

    await usuario.type(screen.getByLabelText('Placa'), 'ABC1234');
    await usuario.tab();

    await usuario.click(await screen.findByRole('button', { name: 'Criar nova mesmo assim' }));

    // Preenche WhatsApp (a consulta já preencheu, mas troca para um número diferente do original) e queixa.
    const campoTelefone = screen.getByLabelText('WhatsApp do cliente') as HTMLInputElement;
    await usuario.clear(campoTelefone);
    await usuario.type(campoTelefone, '43977776666');
    await usuario.type(screen.getByLabelText('Queixa do cliente'), 'Troca de óleo e revisão');
    await usuario.click(screen.getByRole('button', { name: 'Abrir OS' }));

    const dialogo = await screen.findByRole('alertdialog');
    expect(within(dialogo).getByText(/João Antigo/)).toBeInTheDocument();

    await usuario.click(within(dialogo).getByRole('button', { name: /^Sim, passar para/ }));

    await waitFor(() => expect(screen.getByTestId('rota-atual')).toHaveTextContent('/painel/os/os-12'));

    expect(corposEnviados).toHaveLength(2);
    expect(corposEnviados[0]!.criarMesmoComOsAberta).toBe(true);
    expect(corposEnviados[1]).toMatchObject({ criarMesmoComOsAberta: true, transferirVeiculo: true });
  });

  it('D4 confirmado para a placa A não vale para a placa B digitada depois (Enter sem sair do campo)', async () => {
    const corposEnviados: Record<string, unknown>[] = [];
    const fetchMock = mockFetch({
      post: (corpo) => {
        corposEnviados.push(corpo);
        return jsonResposta({ id: 'os-20', numero: 20 }, 201);
      },
      consulta: (placa) => {
        if (placa !== 'ABC1234') {
          return jsonResposta({ statusCode: 404, code: 'VEICULO_NAO_ENCONTRADO', message: 'Placa não encontrada' }, 404);
        }
        return jsonResposta(
          {
            veiculo: {
              id: 'v1',
              placa: 'ABC1234',
              marca: 'VW',
              modelo: 'Gol',
              anoModelo: 2015,
              cor: 'Prata',
              chassi: null,
              kmAtual: 1000,
              criadoEm: new Date().toISOString(),
              cliente: { id: 'c1', nome: 'Maria', telefone: '+5543988887777' },
            },
            osAberta: { id: 'os-9', numero: 12, criadoEm: new Date().toISOString() },
          } satisfies ConsultaPlaca,
          200,
        );
      },
    });
    vi.stubGlobal('fetch', fetchMock);
    const usuario = userEvent.setup();
    renderizar(<AbrirOs />, { auth: { estado: 'autenticado', usuario: null, tem: () => false }, rota: '/painel/os/nova' });

    await usuario.type(screen.getByLabelText('Placa'), 'ABC1234');
    await usuario.tab();
    await usuario.click(await screen.findByRole('button', { name: 'Criar nova mesmo assim' }));
    await usuario.type(screen.getByLabelText('Queixa do cliente'), 'Troca de óleo e revisão');

    const campoPlaca = screen.getByLabelText('Placa');
    await usuario.click(campoPlaca);
    await usuario.clear(campoPlaca);
    await usuario.type(campoPlaca, 'XYZ9876{Enter}');

    await waitFor(() => expect(corposEnviados).toHaveLength(1));
    expect(corposEnviados[0]!.placa).toBe('XYZ9876');
    expect(corposEnviados[0]!.criarMesmoComOsAberta).toBeUndefined();
  });

  it('FUNCIONARIO não carrega a lista da equipe (sem chamada a /usuarios) e vê "Eu"/"Ninguém"', async () => {
    const fetchMock = mockFetch({ post: () => jsonResposta({ id: 'os-z', numero: 1 }, 201) });
    vi.stubGlobal('fetch', fetchMock);
    const usuario = userEvent.setup();
    const funcionario: UsuarioEu = {
      id: 'u-func',
      nome: 'Zeca',
      email: 'zeca@oficina.com',
      perfil: 'FUNCIONARIO',
      permissoes: ['OS_GERENCIAR'],
      oficina: { id: 'o1', nome: 'Oficina do Zé' },
    };
    renderizar(<AbrirOs />, {
      auth: { estado: 'autenticado', usuario: funcionario, tem: (p) => p === 'OS_GERENCIAR' },
      rota: '/painel/os/nova',
    });

    await usuario.click(screen.getByRole('button', { name: 'Mais detalhes' }));

    const selectResponsavel = screen.getByLabelText('Responsável');
    expect(within(selectResponsavel).getByRole('option', { name: 'Eu' })).toBeInTheDocument();
    expect(within(selectResponsavel).getByRole('option', { name: 'Ninguém' })).toBeInTheDocument();

    expect(fetchMock.mock.calls.some(([url]) => (url as string).endsWith('/usuarios'))).toBe(false);
  });
});
