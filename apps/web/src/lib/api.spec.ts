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

  it('só define Content-Type JSON quando o corpo é string (FormData fica com o do navegador)', async () => {
    const fetchMock = vi.fn<(url: string, init: RequestInit) => Promise<Response>>().mockResolvedValue(
      new Response(null, { status: 204 }),
    );
    vi.stubGlobal('fetch', fetchMock);
    const cabecalhos = (i: number) => new Headers(fetchMock.mock.calls[i]?.[1].headers);

    await api('/x', { method: 'POST', body: JSON.stringify({ a: 1 }) });
    await api('/x', { method: 'POST', body: new FormData() });
    await api('/x');
    await api('/x', { method: 'POST', body: '{}', headers: { 'Content-Type': 'text/plain' } });

    expect(cabecalhos(0).get('Content-Type')).toBe('application/json');
    expect(cabecalhos(1).has('Content-Type')).toBe(false);
    expect(cabecalhos(2).has('Content-Type')).toBe(false);
    expect(cabecalhos(3).get('Content-Type')).toBe('text/plain');
  });
});
