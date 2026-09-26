import { definirToken, obterToken, renovarSessao } from './sessao';

describe('sessao', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
    definirToken(null);
  });

  const json = (corpo: unknown, status = 200) => new Response(JSON.stringify(corpo), { status });

  it('5xx no refresh não limpa a sessão (falha passageira, não sessão inválida)', async () => {
    definirToken('velho');
    vi.stubGlobal('fetch', vi.fn<() => Promise<Response>>().mockResolvedValue(new Response('', { status: 503 })));

    const sessao = await renovarSessao();

    expect(sessao).toBeNull();
    expect(obterToken()).toBe('velho');
  });

  it('429 no refresh não limpa a sessão', async () => {
    definirToken('velho');
    vi.stubGlobal(
      'fetch',
      vi.fn<() => Promise<Response>>().mockResolvedValue(json({ statusCode: 429, code: 'MUITAS_REQUISICOES' }, 429)),
    );

    const sessao = await renovarSessao();

    expect(sessao).toBeNull();
    expect(obterToken()).toBe('velho');
  });

  it('erro de rede no refresh não limpa a sessão', async () => {
    definirToken('velho');
    vi.stubGlobal('fetch', vi.fn<() => Promise<Response>>().mockRejectedValue(new TypeError('failed to fetch')));

    const sessao = await renovarSessao();

    expect(sessao).toBeNull();
    expect(obterToken()).toBe('velho');
  });

  it('um 401 atrasado não apaga um login mais novo (corrida de gerações)', async () => {
    vi.useFakeTimers();
    let resolverPrimeiroRefresh!: (r: Response) => void;
    const primeiroRefresh = new Promise<Response>((resolve) => {
      resolverPrimeiroRefresh = resolve;
    });
    let chamadas = 0;
    vi.stubGlobal(
      'fetch',
      vi.fn<() => Promise<Response>>().mockImplementation(async () => {
        chamadas++;
        if (chamadas === 1) return primeiroRefresh;
        return json({ statusCode: 401, code: 'SESSAO_INVALIDA', message: 'x' }, 401);
      }),
    );

    definirToken('velho');
    const renovacao = renovarSessao();

    // Enquanto essa renovação (antiga) ainda está pendurada no primeiro fetch, um login concorrente acontece.
    definirToken('novo-login');

    // O primeiro refresh (da renovação antiga) só responde agora, com 401 — está desatualizado.
    resolverPrimeiroRefresh(json({ statusCode: 401, code: 'SESSAO_INVALIDA', message: 'x' }, 401));
    await vi.advanceTimersByTimeAsync(800);
    const resultado = await renovacao;

    expect(resultado).toBeNull();
    expect(obterToken()).toBe('novo-login');
  });
});
