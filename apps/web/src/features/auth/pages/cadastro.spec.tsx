import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderizarPaginaAuth as renderizar } from '@/test/renderizar-auth';
import { CadastroPage } from './cadastro';

async function preencherCamposObrigatorios(usuario: ReturnType<typeof userEvent.setup>) {
  await usuario.type(screen.getByLabelText('Código de acesso'), 'PILOTO-2026');
  await usuario.type(screen.getByLabelText('Nome da oficina'), 'Oficina do Zé');
  await usuario.type(screen.getByLabelText('WhatsApp da oficina'), '43999998888');
  await usuario.type(screen.getByLabelText('Seu nome'), 'Zé Mecânico');
  await usuario.type(screen.getByLabelText('Seu e-mail'), 'ze@oficina.com');
  await usuario.click(screen.getByLabelText('Li e aceito os termos de uso'));
}

describe('Cadastro', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('mostra CODIGO_PILOTO_INVALIDO no campo do código', async () => {
    const fetchMock = vi
      .fn<(u: string, i?: RequestInit) => Promise<Response>>()
      .mockResolvedValue(
        new Response(
          JSON.stringify({ statusCode: 400, code: 'CODIGO_PILOTO_INVALIDO', message: 'Código de acesso inválido' }),
          { status: 400 },
        ),
      );
    vi.stubGlobal('fetch', fetchMock);
    const usuario = userEvent.setup();
    renderizar(<CadastroPage />);

    await preencherCamposObrigatorios(usuario);
    await usuario.type(screen.getByLabelText('Senha'), 'uma-senha-bem-forte-123');
    await usuario.click(screen.getByRole('button', { name: 'Criar conta' }));

    expect(await screen.findByText('Código de acesso inválido')).toBeInTheDocument();
  });

  it('envia o WhatsApp do dono e mostra TELEFONE_JA_CADASTRADO no campo', async () => {
    const fetchMock = vi
      .fn<(u: string, i?: RequestInit) => Promise<Response>>()
      .mockResolvedValue(
        new Response(
          JSON.stringify({ statusCode: 409, code: 'TELEFONE_JA_CADASTRADO', message: 'Este telefone já está em outra conta' }),
          { status: 409 },
        ),
      );
    vi.stubGlobal('fetch', fetchMock);
    const usuario = userEvent.setup();
    renderizar(<CadastroPage />);

    await preencherCamposObrigatorios(usuario);
    await usuario.type(screen.getByLabelText('Seu WhatsApp (opcional)'), '(43) 98888-7777');
    await usuario.type(screen.getByLabelText('Senha'), 'uma-senha-bem-forte-123');
    await usuario.click(screen.getByRole('button', { name: 'Criar conta' }));

    expect(await screen.findByText('Este telefone já está em outra conta')).toBeInTheDocument();
    expect(screen.getByLabelText('Seu WhatsApp (opcional)')).toHaveAttribute('aria-invalid', 'true');
    const corpo = JSON.parse(fetchMock.mock.calls[0]![1]!.body as string) as { dono: { telefone?: string } };
    expect(corpo.dono.telefone).toBe('+5543988887777');
  });

  it('WhatsApp do dono é opcional: sem ele o cadastro segue sem o campo', async () => {
    const fetchMock = vi
      .fn<(u: string, i?: RequestInit) => Promise<Response>>()
      .mockResolvedValue(new Response(JSON.stringify({ mensagem: 'Enviamos um link' }), { status: 201 }));
    vi.stubGlobal('fetch', fetchMock);
    const usuario = userEvent.setup();
    renderizar(<CadastroPage />);

    await preencherCamposObrigatorios(usuario);
    await usuario.type(screen.getByLabelText('Senha'), 'uma-senha-bem-forte-123');
    await usuario.click(screen.getByRole('button', { name: 'Criar conta' }));

    await waitFor(() => expect(screen.getByTestId('rota-atual')).toHaveTextContent('/verifique-seu-email'));
    const corpo = JSON.parse(fetchMock.mock.calls[0]![1]!.body as string) as { dono: { telefone?: string } };
    expect(corpo.dono.telefone).toBeUndefined();
  });

  it('valida no front a senha comum antes de enviar', async () => {
    const fetchMock = vi.fn<(u: string, i?: RequestInit) => Promise<Response>>();
    vi.stubGlobal('fetch', fetchMock);
    const usuario = userEvent.setup();
    renderizar(<CadastroPage />);

    await preencherCamposObrigatorios(usuario);
    await usuario.type(screen.getByLabelText('Senha'), '12345678');
    await usuario.click(screen.getByRole('button', { name: 'Criar conta' }));

    expect(await screen.findByText(/muito comum/)).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
