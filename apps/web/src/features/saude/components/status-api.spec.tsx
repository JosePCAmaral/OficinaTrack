import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { StatusApi } from './status-api';

function renderizar() {
  const cliente = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={cliente}>
      <StatusApi />
    </QueryClientProvider>,
  );
}

const respostaOk = () => new Response(JSON.stringify({ status: 'ok', banco: 'ok' }), { status: 200 });

describe('StatusApi', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('mostra carregando e depois o sistema no ar', async () => {
    vi.stubGlobal('fetch', vi.fn<() => Promise<Response>>().mockResolvedValue(respostaOk()));
    renderizar();
    expect(screen.getByRole('status')).toHaveTextContent('Verificando');
    expect(await screen.findByText('Sistema no ar')).toBeInTheDocument();
  });

  it('mostra erro e tenta de novo', async () => {
    const fetchMock = vi
      .fn<() => Promise<Response>>()
      .mockResolvedValueOnce(new Response('', { status: 503 }))
      .mockResolvedValueOnce(respostaOk());
    vi.stubGlobal('fetch', fetchMock);
    renderizar();
    expect(await screen.findByText('Não foi possível falar com o servidor.')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Tentar de novo' }));
    expect(await screen.findByText('Sistema no ar')).toBeInTheDocument();
  });
});
