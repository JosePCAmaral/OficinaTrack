import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderizarPaginaAuth as renderizar } from '@/test/renderizar-auth';
import { Entrar } from './entrar';

describe('Entrar', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('com EMAIL_NAO_CONFIRMADO leva para /verifique-seu-email', async () => {
    const fetchMock = vi.fn<(u: string, i?: RequestInit) => Promise<Response>>().mockResolvedValue(
      new Response(
        JSON.stringify({ statusCode: 403, code: 'EMAIL_NAO_CONFIRMADO', message: 'Confirme seu e-mail antes de entrar' }),
        { status: 403 },
      ),
    );
    vi.stubGlobal('fetch', fetchMock);
    const usuario = userEvent.setup();
    renderizar(<Entrar />);

    await usuario.type(screen.getByLabelText('E-mail ou telefone'), 'dono@oficina.com');
    await usuario.type(screen.getByLabelText('Senha'), 'senha-do-usuario');
    await usuario.click(screen.getByRole('button', { name: 'Entrar' }));

    expect(await screen.findByTestId('rota-atual')).toHaveTextContent('/verifique-seu-email');
  });
});
