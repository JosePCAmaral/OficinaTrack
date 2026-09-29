import type { DetalheOS, MembroEquipe, UsuarioEu } from '@oficinatrack/shared';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderizarPaginaAuth as renderizar } from '@/test/renderizar-auth';
import { EditarOS } from './editar-os';

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

function membro(overrides: Partial<MembroEquipe>): MembroEquipe {
  return {
    id: 'u-x',
    nome: 'X',
    email: 'x@oficina.com',
    telefone: null,
    perfil: 'FUNCIONARIO',
    ativo: true,
    criadoEm: new Date().toISOString(),
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

const EQUIPE: MembroEquipe[] = [
  membro({ id: 'u-dono', nome: 'Zé', perfil: 'DONO' }),
  membro({ id: 'u-func', nome: 'Zeca' }),
  membro({ id: 'u-carlos', nome: 'Carlos', ativo: false }),
  membro({ id: 'u-bia', nome: 'Bia' }),
];

function mockFetch(os: DetalheOS, opts: { atrasarEquipe?: Promise<void> } = {}) {
  return vi.fn<(u: string, i?: RequestInit) => Promise<Response>>().mockImplementation(async (url, init) => {
    const metodo = init?.method ?? 'GET';
    if (url.endsWith('/usuarios') && metodo === 'GET') {
      if (opts.atrasarEquipe) await opts.atrasarEquipe;
      return jsonResposta(EQUIPE);
    }
    if (url.endsWith('/ordens-servico/os-1') && metodo === 'PATCH') {
      return jsonResposta(os);
    }
    return jsonResposta({});
  });
}

function corpoPatch(fetchMock: ReturnType<typeof mockFetch>) {
  const chamada = fetchMock.mock.calls.find(([url, init]) => url.endsWith('/ordens-servico/os-1') && init?.method === 'PATCH');
  return chamada ? (JSON.parse(chamada[1]!.body as string) as Record<string, unknown>) : undefined;
}

function renderizarEditar(os: DetalheOS, usuario: UsuarioEu, tem: (p: string) => boolean, onFechar = vi.fn<() => void>()) {
  renderizar(<EditarOS os={os} aberto onFechar={onFechar} />, {
    auth: { estado: 'autenticado', usuario, tem },
  });
  return onFechar;
}

describe('EditarOS', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('DONO: responsável inativo aparece como "(inativo)" e não é reenviado se não mudar', async () => {
    const os = osMock({ responsavel: { id: 'u-carlos', nome: 'Carlos' } });
    const fetchMock = mockFetch(os);
    vi.stubGlobal('fetch', fetchMock);
    const usuario = userEvent.setup();
    const onFechar = renderizarEditar(os, DONO, () => true);

    const select = await screen.findByLabelText('Responsável');
    await waitFor(() => expect(select).toHaveDisplayValue('Carlos (inativo)'));
    expect(screen.getByRole('option', { name: 'Bia' })).toBeInTheDocument();

    const km = screen.getByLabelText('Km de entrada');
    await usuario.clear(km);
    await usuario.type(km, '46000');
    await usuario.click(screen.getByRole('button', { name: 'Salvar' }));

    await waitFor(() => expect(onFechar).toHaveBeenCalled());
    expect(corpoPatch(fetchMock)).toEqual({ kmEntrada: 46000 });
  });

  it('DONO: a lista da equipe chega depois de abrir e o select mostra o responsável atual', async () => {
    let liberar!: () => void;
    const atraso = new Promise<void>((r) => (liberar = r));
    const os = osMock({ responsavel: { id: 'u-bia', nome: 'Bia' } });
    vi.stubGlobal('fetch', mockFetch(os, { atrasarEquipe: atraso }));
    renderizarEditar(os, DONO, () => true);

    const select = await screen.findByLabelText('Responsável');
    expect(select).toHaveDisplayValue('Bia');

    liberar();
    await screen.findByRole('option', { name: 'Zeca' });
    expect(select).toHaveDisplayValue('Bia');
  });

  it('DONO: trocar o responsável envia só o responsavelId', async () => {
    const os = osMock({ responsavel: { id: 'u-carlos', nome: 'Carlos' } });
    const fetchMock = mockFetch(os);
    vi.stubGlobal('fetch', fetchMock);
    const usuario = userEvent.setup();
    const onFechar = renderizarEditar(os, DONO, () => true);

    await screen.findByRole('option', { name: 'Bia' });
    await usuario.selectOptions(screen.getByLabelText('Responsável'), 'Bia');
    await usuario.click(screen.getByRole('button', { name: 'Salvar' }));

    await waitFor(() => expect(onFechar).toHaveBeenCalled());
    expect(corpoPatch(fetchMock)).toEqual({ responsavelId: 'u-bia' });
  });

  it('FUNCIONARIO editando OS de um colega: select mostra o colega (não "Eu") e não reenvia o responsável', async () => {
    const os = osMock({ responsavel: { id: 'u-bia', nome: 'Bia' } });
    const fetchMock = mockFetch(os);
    vi.stubGlobal('fetch', fetchMock);
    const usuario = userEvent.setup();
    const onFechar = renderizarEditar(os, FUNCIONARIO, () => false);

    const select = await screen.findByLabelText('Responsável');
    expect(select).toHaveDisplayValue('Bia');
    expect(screen.getByRole('option', { name: 'Eu' })).toBeInTheDocument();

    await usuario.type(screen.getByLabelText('Diagnóstico'), 'Correia gasta');
    await usuario.click(screen.getByRole('button', { name: 'Salvar' }));

    await waitFor(() => expect(onFechar).toHaveBeenCalled());
    expect(corpoPatch(fetchMock)).toEqual({ diagnostico: 'Correia gasta' });
    expect(fetchMock.mock.calls.some(([url]) => url.endsWith('/usuarios'))).toBe(false);
  });

  it('salvar sem mudar nada só fecha, sem chamar a API', async () => {
    const os = osMock();
    const fetchMock = mockFetch(os);
    vi.stubGlobal('fetch', fetchMock);
    const usuario = userEvent.setup();
    const onFechar = renderizarEditar(os, FUNCIONARIO, () => false);

    await usuario.click(await screen.findByRole('button', { name: 'Salvar' }));

    await waitFor(() => expect(onFechar).toHaveBeenCalled());
    expect(corpoPatch(fetchMock)).toBeUndefined();
  });
});
