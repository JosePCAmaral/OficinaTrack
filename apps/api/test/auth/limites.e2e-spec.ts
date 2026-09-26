import { criarApp, criarOficinaComUsuario, entrar, sufixo, type App } from './apoio-auth.js';

/**
 * Bloqueio de login por conta (LimiteTentativasService). Aqui FATOR_LIMITES fica no valor dos
 * testes (100): o throttler por IP vai a 500/min e não atrapalha, enquanto o bloqueio por conta
 * NÃO usa o fator e continua em 5 falhas / 15 min. Por isso o código exigido é MUITAS_TENTATIVAS
 * (do bloqueio), não MUITAS_REQUISICOES (do throttler).
 */
const tokenDoLink = (texto: string) => /#([A-Za-z0-9_-]{43})/.exec(texto)?.[1];

describe('Limites de tentativa de login', () => {
  let ctx: App;
  beforeEach(async () => {
    ctx = await criarApp(); // app novo por teste: contadores em memória zerados
  });
  afterEach(() => ctx.app.close());

  const login = (identificador: string, senha: string) => ctx.http.post('/api/v1/auth/login').send({ identificador, senha });

  it('5 senhas erradas bloqueiam a 6ª tentativa com MUITAS_TENTATIVAS, mesmo com a senha certa', async () => {
    const { usuario } = await criarOficinaComUsuario(ctx);
    for (let i = 0; i < 5; i++) expect((await login(usuario.email, 'errada-errada')).status).toBe(401);
    const r = await login(usuario.email, 'motor-v8-turbo');
    expect(r.status).toBe(429);
    expect(r.body.code).toBe('MUITAS_TENTATIVAS');
  });

  it('e-mail e telefone da mesma conta somam no mesmo contador', async () => {
    const { usuario } = await criarOficinaComUsuario(ctx);
    for (let i = 0; i < 3; i++) expect((await login(usuario.email, 'errada-errada')).status).toBe(401);
    for (let i = 0; i < 2; i++) expect((await login(usuario.telefone!, 'errada-errada')).status).toBe(401);
    for (const identificador of [usuario.email, usuario.telefone!]) {
      const r = await login(identificador, 'motor-v8-turbo');
      expect(r.status).toBe(429);
      expect(r.body.code).toBe('MUITAS_TENTATIVAS');
    }
  });

  it('identificador sem conta também é bloqueado depois de 5 falhas', async () => {
    const email = `ninguem-${sufixo()}@teste.local`;
    for (let i = 0; i < 5; i++) expect((await login(email, 'errada-errada')).status).toBe(401);
    expect((await login(email, 'errada-errada')).body.code).toBe('MUITAS_TENTATIVAS');
  });

  it('login certo antes do bloqueio zera o contador', async () => {
    const { usuario } = await criarOficinaComUsuario(ctx);
    for (let i = 0; i < 4; i++) await login(usuario.email, 'errada-errada');
    await entrar(ctx, usuario.email);
    for (let i = 0; i < 4; i++) expect((await login(usuario.email, 'errada-errada')).status).toBe(401);
    await entrar(ctx, usuario.email);
  });

  it('redefinir a senha pelo link do e-mail desbloqueia a conta', async () => {
    const { usuario } = await criarOficinaComUsuario(ctx);
    for (let i = 0; i < 5; i++) await login(usuario.email, 'errada-errada');
    expect((await login(usuario.email, 'motor-v8-turbo')).body.code).toBe('MUITAS_TENTATIVAS');
    await ctx.http.post('/api/v1/auth/esqueci-senha').send({ email: usuario.email }).expect(200);
    await ctx.emails.aguardarPendentes();
    const token = tokenDoLink(ctx.emails.ultimoPara(usuario.email)!.texto)!;
    await ctx.http.post('/api/v1/auth/redefinir-senha').send({ token, senha: 'nova-senha-do-ze' }).expect(200);
    await entrar(ctx, usuario.email, 'nova-senha-do-ze');
  });
});
