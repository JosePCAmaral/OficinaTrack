import { criarApp, criarOficinaComUsuario, criarUsuarioNa, entrar, ORIGEM, SENHA, sufixo, type App } from './apoio-auth.js';

const tokenDoLink = (texto: string) => /#([A-Za-z0-9_-]{43})/.exec(texto)?.[1];

describe('Senha', () => {
  let ctx: App;
  beforeAll(async () => { ctx = await criarApp(); });
  afterAll(() => ctx.app.close());

  it('esqueci a senha responde igual para e-mail existente e inexistente', async () => {
    const { usuario } = await criarOficinaComUsuario(ctx);
    const [existe, naoExiste] = await Promise.all([
      ctx.http.post('/api/v1/auth/esqueci-senha').send({ email: usuario.email }),
      ctx.http.post('/api/v1/auth/esqueci-senha').send({ email: `ninguem-${sufixo()}@teste.local` }),
    ]);
    expect(existe.status).toBe(200);
    expect(existe.body).toEqual(naoExiste.body);
  });

  it('redefinir troca a senha, derruba todas as sessões e o link é de uso único', async () => {
    const { usuario } = await criarOficinaComUsuario(ctx);
    const { cookie } = await entrar(ctx, usuario.email);
    await ctx.http.post('/api/v1/auth/esqueci-senha').send({ email: usuario.email.toUpperCase() }).expect(200);
    await ctx.emails.aguardarPendentes(); // token e e-mail saem depois da resposta
    const mensagem = ctx.emails.ultimoPara(usuario.email)!;
    expect(mensagem.texto).toContain('/redefinir-senha#');
    const token = tokenDoLink(mensagem.texto)!;

    await ctx.http.post('/api/v1/auth/redefinir-senha').send({ token, senha: 'nova-senha-do-ze' }).expect(200);
    await ctx.http.post('/api/v1/auth/refresh').set('Origin', ORIGEM).set('Cookie', cookie).expect(401);
    await ctx.http.post('/api/v1/auth/login').send({ identificador: usuario.email, senha: SENHA }).expect(401);
    await entrar(ctx, usuario.email, 'nova-senha-do-ze');
    const reuso = await ctx.http.post('/api/v1/auth/redefinir-senha').send({ token, senha: 'outra-senha-boa' }).expect(400);
    expect(reuso.body.code).toBe('TOKEN_INVALIDO');
  });

  it('redefinir com token de confirmação de e-mail não funciona (tipo errado)', async () => {
    const { usuario } = await criarOficinaComUsuario(ctx);
    const tokens = ctx.app.get((await import('../../src/modules/auth/tokens-usuario.service.js')).TokensUsuarioService);
    const token = await ctx.tenant.executarComo(usuario.oficinaId, () => tokens.criar(ctx.prisma.db, usuario, 'CONFIRMAR_EMAIL'));
    await ctx.http.post('/api/v1/auth/redefinir-senha').send({ token, senha: 'nova-senha-do-ze' }).expect(400);
  });

  it('trocar senha exige a atual e derruba só os outros aparelhos', async () => {
    const { oficina } = await criarOficinaComUsuario(ctx);
    const func = await criarUsuarioNa(ctx, oficina.id, 'FUNCIONARIO');
    const celular = await entrar(ctx, func.email);
    const computador = await entrar(ctx, func.email);

    const errada = await ctx.http.patch('/api/v1/auth/senha').set('Authorization', `Bearer ${celular.accessToken}`).send({ senhaAtual: 'nao-e-essa', novaSenha: 'nova-senha-do-ze' }).expect(400);
    expect(errada.body.code).toBe('SENHA_ATUAL_INCORRETA');

    await ctx.http.patch('/api/v1/auth/senha').set('Authorization', `Bearer ${celular.accessToken}`).send({ senhaAtual: SENHA, novaSenha: 'nova-senha-do-ze' }).expect(204);
    await ctx.http.post('/api/v1/auth/refresh').set('Origin', ORIGEM).set('Cookie', computador.cookie).expect(401);
    await ctx.http.post('/api/v1/auth/refresh').set('Origin', ORIGEM).set('Cookie', celular.cookie).expect(200);
  });

  it('trocar senha corta o access token em uso; o mesmo aparelho renova pelo refresh e segue', async () => {
    const { usuario } = await criarOficinaComUsuario(ctx);
    const aparelho = await entrar(ctx, usuario.email);
    await ctx.http.patch('/api/v1/auth/senha').set('Authorization', `Bearer ${aparelho.accessToken}`).send({ senhaAtual: SENHA, novaSenha: 'nova-senha-do-ze' }).expect(204);
    await ctx.http.get('/api/v1/auth/eu').set('Authorization', `Bearer ${aparelho.accessToken}`).expect(401);
    const renovado = await ctx.http.post('/api/v1/auth/refresh').set('Origin', ORIGEM).set('Cookie', aparelho.cookie).expect(200);
    await ctx.http.get('/api/v1/auth/eu').set('Authorization', `Bearer ${renovado.body.accessToken}`).expect(200);
  });

  it('redefinir senha: sessão nova logo depois do corte funciona (mesmo segundo)', async () => {
    const { usuario } = await criarOficinaComUsuario(ctx);
    await ctx.http.post('/api/v1/auth/esqueci-senha').send({ email: usuario.email }).expect(200);
    await ctx.emails.aguardarPendentes();
    const token = tokenDoLink(ctx.emails.ultimoPara(usuario.email)!.texto)!;
    await ctx.http.post('/api/v1/auth/redefinir-senha').send({ token, senha: 'nova-senha-do-ze' }).expect(200);
    const nova = await entrar(ctx, usuario.email, 'nova-senha-do-ze');
    await ctx.http.get('/api/v1/auth/eu').set('Authorization', `Bearer ${nova.accessToken}`).expect(200);
  });

  it('esqueci a senha: no máximo 3 links por hora para o mesmo destinatário, com a mesma resposta', async () => {
    const { usuario } = await criarOficinaComUsuario(ctx);
    const respostas: unknown[] = [];
    for (let i = 0; i < 5; i++) respostas.push((await ctx.http.post('/api/v1/auth/esqueci-senha').send({ email: usuario.email }).expect(200)).body);
    await ctx.emails.aguardarPendentes();
    expect(new Set(respostas.map((r) => JSON.stringify(r))).size).toBe(1);
    expect(ctx.emails.enviados.filter((m) => m.para === usuario.email)).toHaveLength(3);
  });

  it('e-mail de usuário inativo não recebe link', async () => {
    const { oficina } = await criarOficinaComUsuario(ctx);
    const inativo = await criarUsuarioNa(ctx, oficina.id, 'FUNCIONARIO', { ativo: false });
    await ctx.http.post('/api/v1/auth/esqueci-senha').send({ email: inativo.email }).expect(200);
    await ctx.emails.aguardarPendentes();
    expect(ctx.emails.ultimoPara(inativo.email)).toBeUndefined();
  });
});
