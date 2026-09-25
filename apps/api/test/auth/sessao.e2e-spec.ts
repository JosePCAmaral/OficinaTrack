import { cookieRefresh, criarApp, criarOficinaComUsuario, criarUsuarioNa, entrar, ORIGEM, SENHA, type App } from './apoio-auth.js';

describe('Sessão: login, refresh, logout, eu', () => {
  let ctx: App;
  beforeAll(async () => { ctx = await criarApp(); });
  afterAll(() => ctx.app.close());

  it('login por e-mail com maiúsculas e espaços (Review Focus 2) devolve token, cookie seguro e dados do usuário', async () => {
    const { oficina, usuario } = await criarOficinaComUsuario(ctx);
    const res = await ctx.http.post('/api/v1/auth/login').set('Origin', ORIGEM).send({ identificador: `  ${usuario.email.toUpperCase()} `, senha: SENHA }).expect(200);
    expect(res.body.accessToken).toEqual(expect.any(String));
    expect(res.body.usuario).toMatchObject({ id: usuario.id, perfil: 'DONO', oficina: { id: oficina.id } });
    expect(res.body.usuario.permissoes).toContain('EQUIPE_GERENCIAR');
    const cookie = ([] as string[]).concat(res.headers['set-cookie'] as string[] | string).find((c) => c.startsWith('ot_refresh='))!;
    expect(cookie).toMatch(/HttpOnly/i);
    expect(cookie).toMatch(/Secure/i);
    expect(cookie).toMatch(/SameSite=Strict/i);
    expect(cookie).toMatch(/Path=\/api\/v1\/auth/);
  });

  it('login por telefone', async () => {
    const { usuario } = await criarOficinaComUsuario(ctx);
    await ctx.http.post('/api/v1/auth/login').set('Origin', ORIGEM).send({ identificador: usuario.telefone!.replace('+55', ''), senha: SENHA }).expect(200);
  });

  it('senha errada, e-mail inexistente e usuário inativo dão a mesma resposta', async () => {
    const { oficina, usuario } = await criarOficinaComUsuario(ctx);
    const inativo = await criarUsuarioNa(ctx, oficina.id, 'FUNCIONARIO', { ativo: false });
    const respostas = await Promise.all([
      ctx.http.post('/api/v1/auth/login').send({ identificador: usuario.email, senha: 'errada-errada' }),
      ctx.http.post('/api/v1/auth/login').send({ identificador: 'ninguem-aqui@teste.local', senha: SENHA }),
      ctx.http.post('/api/v1/auth/login').send({ identificador: inativo.email, senha: SENHA }),
    ]);
    for (const r of respostas) {
      expect(r.status).toBe(401);
      expect(r.body).toEqual({ statusCode: 401, code: 'CREDENCIAIS_INVALIDAS', message: 'E-mail/telefone ou senha inválidos' });
    }
  });

  it('e-mail não confirmado com senha certa → 403 EMAIL_NAO_CONFIRMADO', async () => {
    const { oficina } = await criarOficinaComUsuario(ctx);
    const pendente = await criarUsuarioNa(ctx, oficina.id, 'DONO', { emailConfirmadoEm: null });
    const r = await ctx.http.post('/api/v1/auth/login').send({ identificador: pendente.email, senha: SENHA }).expect(403);
    expect(r.body.code).toBe('EMAIL_NAO_CONFIRMADO');
  });

  it('GET /auth/eu com o token de acesso', async () => {
    const { usuario } = await criarOficinaComUsuario(ctx);
    const { accessToken } = await entrar(ctx, usuario.email);
    const r = await ctx.http.get('/api/v1/auth/eu').set('Authorization', `Bearer ${accessToken}`).expect(200);
    expect(r.body).toMatchObject({ id: usuario.id, email: usuario.email });
    expect(r.body).not.toHaveProperty('senhaHash');
  });

  it('refresh gira o token: novo cookie funciona, o antigo não', async () => {
    const { usuario } = await criarOficinaComUsuario(ctx);
    const { cookie } = await entrar(ctx, usuario.email);
    const r1 = await ctx.http.post('/api/v1/auth/refresh').set('Origin', ORIGEM).set('Cookie', cookie).expect(200);
    const novo = cookieRefresh(r1);
    expect(novo).not.toBe(cookie);
    await ctx.http.post('/api/v1/auth/refresh').set('Origin', ORIGEM).set('Cookie', novo).expect(200);
  });

  it('refresh concorrente (duas abas) não derruba a sessão (Review Focus 1)', async () => {
    const { usuario } = await criarOficinaComUsuario(ctx);
    const { cookie } = await entrar(ctx, usuario.email);
    const [a, b] = await Promise.all([
      ctx.http.post('/api/v1/auth/refresh').set('Origin', ORIGEM).set('Cookie', cookie),
      ctx.http.post('/api/v1/auth/refresh').set('Origin', ORIGEM).set('Cookie', cookie),
    ]);
    const vencedor = [a, b].find((r) => r.status === 200)!;
    expect(vencedor).toBeDefined();
    // a família continua viva: o cookie novo do vencedor segue renovando
    await ctx.http.post('/api/v1/auth/refresh').set('Origin', ORIGEM).set('Cookie', cookieRefresh(vencedor)).expect(200);
  });

  it('reuso de refresh antigo depois da tolerância revoga a família inteira', async () => {
    const { usuario } = await criarOficinaComUsuario(ctx);
    const { cookie } = await entrar(ctx, usuario.email);
    const r1 = await ctx.http.post('/api/v1/auth/refresh').set('Origin', ORIGEM).set('Cookie', cookie).expect(200);
    const novo = cookieRefresh(r1);
    // envelhece a rotação para além dos 10 s de tolerância
    await ctx.tenant.executarComo(usuario.oficinaId, () =>
      ctx.prisma.db.refreshToken.updateMany({ where: { usuarioId: usuario.id, substituidoEm: { not: null } }, data: { substituidoEm: new Date(Date.now() - 60_000) } }),
    );
    const reuso = await ctx.http.post('/api/v1/auth/refresh').set('Origin', ORIGEM).set('Cookie', cookie).expect(401);
    expect(reuso.body.code).toBe('SESSAO_INVALIDA');
    await ctx.http.post('/api/v1/auth/refresh').set('Origin', ORIGEM).set('Cookie', novo).expect(401);
  });

  it('refresh sem Origin ou com Origin de outro site → 403', async () => {
    const { usuario } = await criarOficinaComUsuario(ctx);
    const { cookie } = await entrar(ctx, usuario.email);
    await ctx.http.post('/api/v1/auth/refresh').set('Cookie', cookie).expect(403);
    await ctx.http.post('/api/v1/auth/refresh').set('Origin', 'https://golpe.example').set('Cookie', cookie).expect(403);
  });

  it('logout revoga o refresh e limpa o cookie', async () => {
    const { usuario } = await criarOficinaComUsuario(ctx);
    const { cookie } = await entrar(ctx, usuario.email);
    const r = await ctx.http.post('/api/v1/auth/logout').set('Origin', ORIGEM).set('Cookie', cookie).expect(204);
    expect(([] as string[]).concat(r.headers['set-cookie'] as string[] | string).join(';')).toMatch(/ot_refresh=;/);
    await ctx.http.post('/api/v1/auth/refresh').set('Origin', ORIGEM).set('Cookie', cookie).expect(401);
  });

  it('refresh de usuário desativado → 401 (Review Focus 4)', async () => {
    const { oficina } = await criarOficinaComUsuario(ctx);
    const func = await criarUsuarioNa(ctx, oficina.id, 'FUNCIONARIO');
    const { cookie } = await entrar(ctx, func.email);
    await ctx.tenant.executarComo(oficina.id, () => ctx.prisma.db.usuario.update({ where: { id: func.id }, data: { ativo: false } }));
    await ctx.http.post('/api/v1/auth/refresh').set('Origin', ORIGEM).set('Cookie', cookie).expect(401);
  });
});
