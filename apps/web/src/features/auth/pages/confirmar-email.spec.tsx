import { screen } from '@testing-library/react';
import { renderizarPaginaAuth as renderizar } from '@/test/renderizar-auth';
import { ConfirmarEmail } from './confirmar-email';

describe('ConfirmarEmail', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('não chama a API ao abrir o link (Review Focus 3)', async () => {
    const fetchMock = vi.fn<(u: string, i?: RequestInit) => Promise<Response>>();
    vi.stubGlobal('fetch', fetchMock);
    window.history.replaceState(null, '', '/confirmar-email#' + 'a'.repeat(43));
    renderizar(<ConfirmarEmail />);
    expect(await screen.findByRole('button', { name: 'Confirmar meu e-mail' })).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
