import { api, ErroApi } from './api';
import { definirToken, obterToken } from './sessao';

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

describe('api com sessão', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    definirToken(null);
  });
  const json = (corpo: unknown, status = 200) => new Response(JSON.stringify(corpo), { status });

  it('envia o token de acesso', async () => {
    definirToken('tok-1');
    const fetchMock = vi.fn<(u: string, i?: RequestInit) => Promise<Response>>().mockResolvedValue(json({ ok: true }));
    vi.stubGlobal('fetch', fetchMock);
    await api('/oficinas/atual');
    expect(new Headers(fetchMock.mock.calls[0]![1]!.headers).get('Authorization')).toBe('Bearer tok-1');
  });

  it('em 401 renova uma vez e repete a chamada', async () => {
    definirToken('velho');
    const fetchMock = vi
      .fn<(u: string, i?: RequestInit) => Promise<Response>>()
      .mockResolvedValueOnce(json({ statusCode: 401, code: 'NAO_AUTENTICADO', message: 'x' }, 401))
      .mockResolvedValueOnce(json({ accessToken: 'novo', usuario: { id: 'u' } }))
      .mockResolvedValueOnce(json({ ok: true }));
    vi.stubGlobal('fetch', fetchMock);
    await expect(api('/oficinas/atual')).resolves.toEqual({ ok: true });
    expect(fetchMock.mock.calls[1]![0]).toBe('/api/v1/auth/refresh');
    expect(new Headers(fetchMock.mock.calls[2]![1]!.headers).get('Authorization')).toBe('Bearer novo');
  });

  it('renova também em rotas autenticadas de /auth (ex.: /auth/eu) e repete a chamada', async () => {
    definirToken('velho');
    const fetchMock = vi
      .fn<(u: string, i?: RequestInit) => Promise<Response>>()
      .mockResolvedValueOnce(json({ statusCode: 401, code: 'NAO_AUTENTICADO', message: 'x' }, 401))
      .mockResolvedValueOnce(json({ accessToken: 'novo', usuario: { id: 'u' } }))
      .mockResolvedValueOnce(json({ id: 'u', nome: 'Zé' }));
    vi.stubGlobal('fetch', fetchMock);
    await expect(api('/auth/eu')).resolves.toEqual({ id: 'u', nome: 'Zé' });
    expect(fetchMock.mock.calls[1]![0]).toBe('/api/v1/auth/refresh');
    expect(new Headers(fetchMock.mock.calls[2]![1]!.headers).get('Authorization')).toBe('Bearer novo');
  });

  it('renova com sucesso só na segunda tentativa (após 800ms) e repete a chamada original', async () => {
    vi.useFakeTimers();
    definirToken('velho');
    const fetchMock = vi
      .fn<(u: string, i?: RequestInit) => Promise<Response>>()
      .mockResolvedValueOnce(json({ statusCode: 401, code: 'NAO_AUTENTICADO', message: 'x' }, 401)) // chamada original
      .mockResolvedValueOnce(json({ statusCode: 401, code: 'SESSAO_INVALIDA', message: 'x' }, 401)) // 1ª tentativa de refresh
      .mockResolvedValueOnce(json({ accessToken: 'novo', usuario: { id: 'u' } })) // 2ª tentativa, após os 800ms
      .mockResolvedValueOnce(json({ ok: true })); // chamada original repetida
    vi.stubGlobal('fetch', fetchMock);

    const chamada = api('/oficinas/atual');
    await vi.advanceTimersByTimeAsync(800);
    await expect(chamada).resolves.toEqual({ ok: true });

    const chamadasRefresh = fetchMock.mock.calls.filter((c) => c[0] === '/api/v1/auth/refresh');
    expect(chamadasRefresh).toHaveLength(2);
    vi.useRealTimers();
  });

  it('duas chamadas com 401 ao mesmo tempo compartilham uma renovação só', async () => {
    definirToken('velho');
    let refreshes = 0;
    vi.stubGlobal(
      'fetch',
      vi.fn(async (u: string, i?: RequestInit) => {
        if (u === '/api/v1/auth/refresh') {
          refreshes++;
          return json({ accessToken: 'novo', usuario: { id: 'u' } });
        }
        return new Headers(i?.headers).get('Authorization') === 'Bearer novo' ? json({ ok: true }) : json({ code: 'NAO_AUTENTICADO' }, 401);
      }),
    );
    await Promise.all([api('/a'), api('/b')]);
    expect(refreshes).toBe(1);
  });

  it('renovação que falha limpa a sessão e relança 401', async () => {
    vi.useFakeTimers();
    definirToken('velho');
    vi.stubGlobal(
      'fetch',
      vi
        .fn<(u: string, i?: RequestInit) => Promise<Response>>()
        .mockResolvedValue(json({ statusCode: 401, code: 'SESSAO_INVALIDA', message: 'x' }, 401)),
    );
    // .catch() é anexado já na criação: evita que o rejeição apareça como "unhandled" enquanto o timer não avança.
    const chamada = api('/oficinas/atual').catch((e: unknown) => e);
    await vi.advanceTimersByTimeAsync(800);
    expect(await chamada).toMatchObject({ statusCode: 401 });
    expect(obterToken()).toBeNull();
    vi.useRealTimers();
  });
});
