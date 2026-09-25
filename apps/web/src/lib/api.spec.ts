import { api, ErroApi } from './api';

describe('api', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('prefixa /api/v1 e devolve o JSON', async () => {
    const fetchMock = vi.fn<() => Promise<Response>>().mockResolvedValue(
      new Response(JSON.stringify({ status: 'ok' }), { status: 200 }),
    );
    vi.stubGlobal('fetch', fetchMock);
    await expect(api('/saude')).resolves.toEqual({ status: 'ok' });
    expect(fetchMock).toHaveBeenCalledWith('/api/v1/saude', expect.objectContaining({ credentials: 'include' }));
  });

  it('transforma o erro padrão da API em ErroApi', async () => {
    const corpo = { statusCode: 404, code: 'RECURSO_NAO_ENCONTRADO', message: 'Recurso não encontrado' };
    vi.stubGlobal(
      'fetch',
      vi.fn<() => Promise<Response>>().mockResolvedValue(new Response(JSON.stringify(corpo), { status: 404 })),
    );
    await expect(api('/x')).rejects.toMatchObject({ statusCode: 404, code: 'RECURSO_NAO_ENCONTRADO' });
  });

  it('erro sem corpo JSON vira mensagem genérica', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn<() => Promise<Response>>().mockResolvedValue(new Response('Bad Gateway', { status: 502 })),
    );
    const erro = await api('/x').catch((e: unknown) => e);
    expect(erro).toBeInstanceOf(ErroApi);
    expect((erro as ErroApi).message).toBe('Não foi possível completar a ação. Tente de novo.');
  });
});
