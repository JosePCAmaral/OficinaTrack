import type { UsuarioEu } from '@oficinatrack/shared';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderizarPaginaAuth as renderizar } from '@/test/renderizar-auth';
import { MinhaConta } from './minha-conta';

const dono: UsuarioEu = {
  id: 'u-dono',
  nome: 'Zé Mecânico',
  email: 'ze@oficina.com',
  perfil: 'DONO',
  permissoes: [],
  oficina: { id: 'o1', nome: 'Oficina do Zé' },
};

describe('MinhaConta', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('mostra nome e e-mail somente leitura', () => {
    renderizar(<MinhaConta />, { auth: { estado: 'autenticado', usuario: dono, tem: () => true } });

    expect(screen.getByLabelText('Nome')).toHaveValue('Zé Mecânico');
    expect(screen.getByLabelText('Nome')).toHaveAttribute('readonly');
    expect(screen.getByLabelText('E-mail')).toHaveValue('ze@oficina.com');
    expect(screen.getByLabelText('E-mail')).toHaveAttribute('readonly');
  });

  it('SENHA_ATUAL_INCORRETA aparece no campo senha atual', async () => {
    const fetchMock = vi.fn<(u: string, i?: RequestInit) => Promise<Response>>().mockResolvedValue(
      new Response(JSON.stringify({ statusCode: 400, code: 'SENHA_ATUAL_INCORRETA', message: 'Senha atual incorreta' }), {
        status: 400,
      }),
    );
    vi.stubGlobal('fetch', fetchMock);
    const usuario = userEvent.setup();
    renderizar(<MinhaConta />, { auth: { estado: 'autenticado', usuario: dono, tem: () => true } });

    await usuario.type(screen.getByLabelText('Senha atual'), 'senha-errada');
    await usuario.type(screen.getByLabelText('Nova senha'), 'uma-senha-bem-forte-123');
    await usuario.type(screen.getByLabelText('Repetir nova senha'), 'uma-senha-bem-forte-123');
    await usuario.click(screen.getByRole('button', { name: 'Trocar senha' }));

    expect(await screen.findByText('Senha atual incorreta')).toBeInTheDocument();
  });

  it('valida no front que a repetição precisa ser igual à nova senha', async () => {
    const fetchMock = vi.fn<(u: string, i?: RequestInit) => Promise<Response>>();
    vi.stubGlobal('fetch', fetchMock);
    const usuario = userEvent.setup();
    renderizar(<MinhaConta />, { auth: { estado: 'autenticado', usuario: dono, tem: () => true } });

    await usuario.type(screen.getByLabelText('Senha atual'), 'senha-antiga-123');
    await usuario.type(screen.getByLabelText('Nova senha'), 'uma-senha-bem-forte-123');
    await usuario.type(screen.getByLabelText('Repetir nova senha'), 'outra-coisa-123');
    await usuario.click(screen.getByRole('button', { name: 'Trocar senha' }));

    expect(await screen.findByText('As senhas não coincidem')).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
