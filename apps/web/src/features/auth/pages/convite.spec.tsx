import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderizarPaginaAuth as renderizar } from '@/test/renderizar-auth';
import { Convite } from './convite';

describe('Convite', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('só consulta a API depois do clique em "Ver convite"', async () => {
    const fetchMock = vi.fn<(u: string, i?: RequestInit) => Promise<Response>>();
    vi.stubGlobal('fetch', fetchMock);
    window.history.replaceState(null, '', '/convite#' + 'a'.repeat(43));
    renderizar(<Convite />);
    expect(await screen.findByRole('button', { name: 'Ver convite' })).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();

    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({ nomeOficina: 'Oficina do Zé', nome: 'Zé', email: 'ze@exemplo.com', telefone: null }),
        { status: 200 },
      ),
    );
    await userEvent.click(screen.getByRole('button', { name: 'Ver convite' }));
    expect(await screen.findByText('Oficina do Zé', { exact: false })).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0]![0]).toBe('/api/v1/convites/consultar');
  });
});
