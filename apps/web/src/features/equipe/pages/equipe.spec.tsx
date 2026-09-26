import type { ConvitePendente, MembroEquipe, UsuarioEu } from '@oficinatrack/shared';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderizarPaginaAuth as renderizar } from '@/test/renderizar-auth';
import { Equipe } from './equipe';

const dono: UsuarioEu = {
  id: 'u-dono',
  nome: 'Zé Mecânico',
  email: 'ze@oficina.com',
  perfil: 'DONO',
  permissoes: ['EQUIPE_GERENCIAR'],
  oficina: { id: 'o1', nome: 'Oficina do Zé' },
};

const colega: MembroEquipe = {
  id: 'u-colega',
  nome: 'Maria Funcionária',
  email: 'maria@oficina.com',
  telefone: null,
  perfil: 'FUNCIONARIO',
  ativo: true,
  criadoEm: '2026-01-01T00:00:00.000Z',
};

const membroDono: MembroEquipe = {
  id: dono.id,
  nome: dono.nome,
  email: dono.email,
  telefone: null,
  perfil: 'DONO',
  ativo: true,
  criadoEm: '2026-01-01T00:00:00.000Z',
};

const pendente: ConvitePendente = {
  id: 'c-pendente',
  nome: 'Convidado Antigo',
  email: 'antigo@oficina.com',
  telefone: null,
  perfil: 'FUNCIONARIO',
  expiraEm: '2026-01-04T00:00:00.000Z',
  criadoEm: '2026-01-01T00:00:00.000Z',
};

function mockFetch(handlers: {
  onPost?: (body: unknown) => Response;
  onReenviar?: () => Response;
  convites?: ConvitePendente[];
  falharListas?: boolean;
}) {
  return vi.fn<(u: string, i?: RequestInit) => Promise<Response>>().mockImplementation(async (url, init) => {
    const metodo = init?.method ?? 'GET';
    if (handlers.falharListas && metodo === 'GET') {
      return new Response(JSON.stringify({ statusCode: 500, code: 'ERRO_INTERNO', message: 'Erro interno' }), { status: 500 });
    }
    if (url.endsWith('/usuarios') && metodo === 'GET') {
      return new Response(JSON.stringify([membroDono, colega]), { status: 200 });
    }
    if (url.endsWith('/convites') && metodo === 'GET') {
      return new Response(JSON.stringify(handlers.convites ?? ([] satisfies ConvitePendente[])), { status: 200 });
    }
    if (url.endsWith('/reenviar') && metodo === 'POST' && handlers.onReenviar) {
      return handlers.onReenviar();
    }
    if (url.endsWith('/convites') && metodo === 'POST' && handlers.onPost) {
      return handlers.onPost(init?.body ? JSON.parse(init.body as string) : undefined);
    }
    return new Response(JSON.stringify({}), { status: 200 });
  });
}

describe('Equipe', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('convite criado mostra link de WhatsApp com texto codificado', async () => {
    const fetchMock = mockFetch({
      onPost: () =>
        new Response(
          JSON.stringify({
            convite: { id: 'c1', nome: 'Novo Convidado', email: 'novo@oficina.com', telefone: '+5543999998888', perfil: 'FUNCIONARIO', expiraEm: '2026-01-04T00:00:00.000Z', criadoEm: '2026-01-01T00:00:00.000Z' },
            link: 'https://app.oficinatrack.com/convite#token123',
          }),
          { status: 201 },
        ),
    });
    vi.stubGlobal('fetch', fetchMock);
    const usuario = userEvent.setup();
    renderizar(<Equipe />, { auth: { estado: 'autenticado', usuario: dono, tem: () => true } });

    await usuario.click(await screen.findByRole('button', { name: 'Convidar' }));
    await usuario.type(screen.getByLabelText('Nome'), 'Novo Convidado');
    await usuario.type(screen.getByLabelText('E-mail'), 'novo@oficina.com');
    await usuario.type(screen.getByLabelText('WhatsApp (opcional)'), '43999998888');
    await usuario.click(screen.getByRole('button', { name: 'Enviar convite' }));

    const link = await screen.findByRole('link', { name: 'Enviar pelo WhatsApp' });
    const href = link.getAttribute('href')!;
    expect(href).toContain('https://wa.me/5543999998888?text=');
    const mensagemEsperada =
      'Olá, Novo Convidado! A Oficina do Zé convidou você para usar o OficinaTrack. Crie sua senha por este link (vale 72 horas): https://app.oficinatrack.com/convite#token123';
    expect(href).toBe(`https://wa.me/5543999998888?text=${encodeURIComponent(mensagemEsperada)}`);
  });

  it('erro EMAIL_JA_CADASTRADO aparece no campo e-mail', async () => {
    const fetchMock = mockFetch({
      onPost: () =>
        new Response(JSON.stringify({ statusCode: 409, code: 'EMAIL_JA_CADASTRADO', message: 'Esse e-mail já está cadastrado' }), {
          status: 409,
        }),
    });
    vi.stubGlobal('fetch', fetchMock);
    const usuario = userEvent.setup();
    renderizar(<Equipe />, { auth: { estado: 'autenticado', usuario: dono, tem: () => true } });

    await usuario.click(await screen.findByRole('button', { name: 'Convidar' }));
    await usuario.type(screen.getByLabelText('Nome'), 'Alguém');
    await usuario.type(screen.getByLabelText('E-mail'), 'ja-existe@oficina.com');
    await usuario.click(screen.getByRole('button', { name: 'Enviar convite' }));

    expect(await screen.findByText('Esse e-mail já está cadastrado')).toBeInTheDocument();
  });

  it('reenviar além do limite (429) mostra a mensagem da API e desliga o botão', async () => {
    const mensagem = 'Limite de reenvios deste convite atingido. Cancele e convide de novo';
    const fetchMock = mockFetch({
      convites: [pendente],
      onReenviar: () => new Response(JSON.stringify({ statusCode: 429, code: 'MUITAS_TENTATIVAS', message: mensagem }), { status: 429 }),
    });
    vi.stubGlobal('fetch', fetchMock);
    const usuario = userEvent.setup();
    renderizar(<Equipe />, { auth: { estado: 'autenticado', usuario: dono, tem: () => true } });

    await usuario.click(await screen.findByRole('button', { name: 'Reenviar' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(mensagem);
    expect(screen.getByRole('button', { name: 'Reenviar' })).toBeDisabled();
  });

  it('botões de "Tentar de novo" têm 44px de altura (h-11)', async () => {
    vi.stubGlobal('fetch', mockFetch({ falharListas: true }));
    renderizar(<Equipe />, { auth: { estado: 'autenticado', usuario: dono, tem: () => true } });

    await screen.findByText('Não foi possível carregar os convites.');
    const botoes = await screen.findAllByRole('button', { name: 'Tentar de novo' });
    expect(botoes).toHaveLength(2);
    for (const botao of botoes) expect(botao).toHaveClass('h-11');
  });

  it('diálogo de desativar tem Cancelar e Desativar com 44px de altura (h-11)', async () => {
    vi.stubGlobal('fetch', mockFetch({}));
    const usuario = userEvent.setup();
    renderizar(<Equipe />, { auth: { estado: 'autenticado', usuario: dono, tem: () => true } });

    await usuario.click(await screen.findByRole('button', { name: `Ações de ${colega.nome}` }));
    await usuario.click(await screen.findByRole('menuitem', { name: 'Desativar' }));

    const dialogo = await screen.findByRole('alertdialog');
    expect(within(dialogo).getByRole('button', { name: 'Cancelar' })).toHaveClass('h-11');
    expect(within(dialogo).getByRole('button', { name: 'Desativar' })).toHaveClass('h-11');
  });

  it('ações não aparecem no próprio usuário', async () => {
    const fetchMock = mockFetch({});
    vi.stubGlobal('fetch', fetchMock);
    renderizar(<Equipe />, { auth: { estado: 'autenticado', usuario: dono, tem: () => true } });

    await screen.findByText(colega.nome);
    const cartaoColega = screen.getByText(colega.nome).closest('li')!;
    expect(within(cartaoColega).getByRole('button', { name: `Ações de ${colega.nome}` })).toBeInTheDocument();

    const cartaoDono = screen.getByText(dono.nome).closest('li')!;
    expect(within(cartaoDono).queryByRole('button', { name: `Ações de ${dono.nome}` })).not.toBeInTheDocument();
  });
});
