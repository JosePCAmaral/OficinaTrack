import { JwtService } from '@nestjs/jwt';
import { TokensUsuarioService } from '../../src/modules/auth/tokens-usuario.service.js';
import { ENV_TESTE } from '../env-teste.js';
import { criarApp, criarOficinaComUsuario, criarUsuarioNa, entrar, ORIGEM, sufixo, type App } from '../auth/apoio-auth.js';

/**
 * Auditoria Sprint 2 (docs/auditorias/2026-09-26-sprint-2.md): T1/T3/T4/T6 nas contas, equipe e convites.
 * Testes marcados "FALHA HOJE" provam um achado do relatório; os demais são regressão de controles corretos.
 * Cada teste cria as próprias oficinas (o banco de teste não é zerado).
 */
const tokenDoLink = (texto: string) => /#([A-Za-z0-9_-]{43})/.exec(texto)?.[1];
const auth = (t: string) => ({ Authorization: `Bearer ${t}` });

describe('T3/T4: contas, equipe e convites (auditoria Sprint 2)', () => {
  let ctx: App;
  beforeAll(async () => {
    ctx = await criarApp();
  });
  afterAll(() => ctx.app.close());

  // ---------------------------------------------------------------- achados (falham hoje)

  it('[achado #1, FALHA HOJE] convite criado por um DONO que depois foi desativado não pode mais ser aceito', async () => {
    const { oficina, usuario: dono1 } = await criarOficinaComUsuario(ctx);
    const dono2 = await criarUsuarioNa(ctx, oficina.id, 'DONO');
    const d1 = await entrar(ctx, dono1.email);
    const d2 = await entrar(ctx, dono2.email);
    // dono2 (sócio saindo, ou sessão roubada) deixa um convite DONO para um e-mail dele; o link volta na resposta
    const c = await ctx.http.post('/api/v1/convites').set(auth(d2.accessToken)).send({ nome: 'Porta dos fundos', email: `pf-${sufixo()}@teste.local`, perfil: 'DONO' }).expect(201);
    await ctx.http.patch(`/api/v1/usuarios/${dono2.id}`).set(auth(d1.accessToken)).send({ ativo: false }).expect(200);

    const r = await ctx.http.post('/api/v1/convites/aceitar').set('Origin', ORIGEM).send({ token: tokenDoLink(c.body.link)!, senha: 'chave-de-roda-12' });
    expect(r.status).toBe(400);
    expect(r.body.code).toBe('TOKEN_INVALIDO');
  });

  it('[achado #1, FALHA HOJE] convite criado por um DONO que depois foi rebaixado a FUNCIONARIO não pode mais ser aceito', async () => {
    const { oficina, usuario: dono1 } = await criarOficinaComUsuario(ctx);
    const dono2 = await criarUsuarioNa(ctx, oficina.id, 'DONO');
    const d1 = await entrar(ctx, dono1.email);
    const d2 = await entrar(ctx, dono2.email);
    const c = await ctx.http.post('/api/v1/convites').set(auth(d2.accessToken)).send({ nome: 'Porta dos fundos', email: `pf-${sufixo()}@teste.local`, perfil: 'DONO' }).expect(201);
    await ctx.http.patch(`/api/v1/usuarios/${dono2.id}`).set(auth(d1.accessToken)).send({ perfil: 'FUNCIONARIO' }).expect(200);

    const r = await ctx.http.post('/api/v1/convites/aceitar').set('Origin', ORIGEM).send({ token: tokenDoLink(c.body.link)!, senha: 'chave-de-roda-12' });
    expect(r.status).toBe(400);
    expect(r.body.code).toBe('TOKEN_INVALIDO');
  });

  it('[achado #6, FALHA HOJE] access token emitido antes de redefinir a senha deixa de valer (recuperação de conta)', async () => {
    const { usuario } = await criarOficinaComUsuario(ctx);
    const invasor = await entrar(ctx, usuario.email); // sessão que o dono quer derrubar ao redefinir a senha
    await ctx.http.post('/api/v1/auth/esqueci-senha').send({ email: usuario.email }).expect(200);
    const token = tokenDoLink(ctx.emails.ultimoPara(usuario.email)!.texto)!;
    await ctx.http.post('/api/v1/auth/redefinir-senha').send({ token, senha: 'nova-senha-do-ze' }).expect(200);

    // hoje: 200 por até 15 min — tempo suficiente para criar um convite DONO (achado #1) e manter acesso
    await ctx.http.get('/api/v1/auth/eu').set(auth(invasor.accessToken)).expect(401);
  });

  it('[achado #9, FALHA HOJE] FUNCIONARIO não recebe o CPF/CNPJ da oficina em GET /oficinas/atual (minimização)', async () => {
    const { oficina, usuario: dono } = await criarOficinaComUsuario(ctx);
    const func = await criarUsuarioNa(ctx, oficina.id, 'FUNCIONARIO');
    const d = await entrar(ctx, dono.email);
    await ctx.http.patch('/api/v1/oficinas/atual').set(auth(d.accessToken)).send({ nome: 'Oficina MEI', telefone: '43988887777', documento: '529.982.247-25' }).expect(200);
    const f = await entrar(ctx, func.email);
    const r = await ctx.http.get('/api/v1/oficinas/atual').set(auth(f.accessToken)).expect(200);
    expect(r.body.documento ?? null).toBeNull();
  });

  // ---------------------------------------------------------------- regressão (passam hoje)

  it('[regressão T1] JWT bem assinado com sub de uma oficina e oficinaId de outra → 401', async () => {
    const a = await criarOficinaComUsuario(ctx);
    const b = await criarOficinaComUsuario(ctx);
    const jwt = new JwtService({ secret: ENV_TESTE.JWT_SEGREDO });
    const cruzadoAB = await jwt.signAsync({ sub: b.usuario.id, oficinaId: a.oficina.id, perfil: 'DONO', fam: 'x' }, { algorithm: 'HS256', expiresIn: '5m' });
    const cruzadoBA = await jwt.signAsync({ sub: a.usuario.id, oficinaId: b.oficina.id, perfil: 'DONO', fam: 'x' }, { algorithm: 'HS256', expiresIn: '5m' });
    await ctx.http.get('/api/v1/usuarios').set(auth(cruzadoAB)).expect(401);
    await ctx.http.get('/api/v1/oficinas/atual').set(auth(cruzadoBA)).expect(401);
  });

  it('[regressão T4] perfil vem do banco, não do JWT: FUNCIONARIO com perfil DONO forjado no token → 403', async () => {
    const { oficina } = await criarOficinaComUsuario(ctx);
    const func = await criarUsuarioNa(ctx, oficina.id, 'FUNCIONARIO');
    const jwt = new JwtService({ secret: ENV_TESTE.JWT_SEGREDO });
    const forjado = await jwt.signAsync({ sub: func.id, oficinaId: oficina.id, perfil: 'DONO', fam: 'x' }, { algorithm: 'HS256', expiresIn: '5m' });
    await ctx.http.get('/api/v1/usuarios').set(auth(forjado)).expect(403);
  });

  it('[regressão T1/T4] PATCH /usuarios/:id ignora campos fora do schema (oficinaId, email, senhaHash, emailConfirmadoEm)', async () => {
    const a = await criarOficinaComUsuario(ctx);
    const b = await criarOficinaComUsuario(ctx);
    const func = await criarUsuarioNa(ctx, a.oficina.id, 'FUNCIONARIO');
    const d = await entrar(ctx, a.usuario.email);
    await ctx.http
      .patch(`/api/v1/usuarios/${func.id}`)
      .set(auth(d.accessToken))
      .send({ ativo: true, oficinaId: b.oficina.id, email: `evil-${sufixo()}@teste.local`, senhaHash: 'x', emailConfirmadoEm: null, telefone: '+5543999990000' })
      .expect(200);
    const depois = await ctx.tenant.executarSemTenant(() => ctx.prisma.db.usuario.findUnique({ where: { id: func.id } }));
    expect(depois).toMatchObject({ oficinaId: a.oficina.id, email: func.email, senhaHash: func.senhaHash, telefone: func.telefone });
    expect(depois?.emailConfirmadoEm).not.toBeNull();
  });

  it('[regressão T1/LGPD] PATCH /oficinas/atual ignora id, termos, numeração e logoKey', async () => {
    const a = await criarOficinaComUsuario(ctx);
    const b = await criarOficinaComUsuario(ctx);
    const d = await entrar(ctx, a.usuario.email);
    await ctx.http
      .patch('/api/v1/oficinas/atual')
      .set(auth(d.accessToken))
      .send({ nome: 'Nome novo', telefone: '43988887777', id: b.oficina.id, termosVersao: 'nenhum', termosAceitosEm: '2000-01-01T00:00:00Z', proximoNumeroOS: 999, logoKey: `oficinas/${b.oficina.id}/logo.png` })
      .expect(200);
    const [depoisA, depoisB] = await ctx.tenant.executarSemTenant(() =>
      Promise.all([ctx.prisma.db.oficina.findUnique({ where: { id: a.oficina.id } }), ctx.prisma.db.oficina.findUnique({ where: { id: b.oficina.id } })]),
    );
    expect(depoisA).toMatchObject({ nome: 'Nome novo', termosVersao: a.oficina.termosVersao, proximoNumeroOS: a.oficina.proximoNumeroOS, logoKey: null });
    expect(depoisA?.termosAceitosEm.getTime()).toBe(a.oficina.termosAceitosEm.getTime());
    expect(depoisB?.nome).toBe(b.oficina.nome);
  });

  it('[regressão T4] aceite de convite ignora perfil, oficinaId e email vindos do body', async () => {
    const a = await criarOficinaComUsuario(ctx);
    const b = await criarOficinaComUsuario(ctx);
    const d = await entrar(ctx, a.usuario.email);
    const email = `conv-${sufixo()}@teste.local`;
    const c = await ctx.http.post('/api/v1/convites').set(auth(d.accessToken)).send({ nome: 'Mec', email }).expect(201);
    const r = await ctx.http
      .post('/api/v1/convites/aceitar')
      .set('Origin', ORIGEM)
      .send({ token: tokenDoLink(c.body.link)!, senha: 'chave-de-roda-12', perfil: 'DONO', oficinaId: b.oficina.id, email: `evil-${sufixo()}@teste.local` })
      .expect(200);
    expect(r.body.usuario).toMatchObject({ perfil: 'FUNCIONARIO', email, oficina: { id: a.oficina.id } });
  });

  it('[regressão T3] confirmar e-mail e aceitar convite sem Origin → 403 e o link continua válido', async () => {
    const { oficina, usuario: dono } = await criarOficinaComUsuario(ctx);
    const pendente = await criarUsuarioNa(ctx, oficina.id, 'FUNCIONARIO', { emailConfirmadoEm: null });
    const tokens = ctx.app.get(TokensUsuarioService);
    const tokenConfirmar = await ctx.tenant.executarComo(oficina.id, () => tokens.criar(ctx.prisma.db, pendente, 'CONFIRMAR_EMAIL'));
    await ctx.http.post('/api/v1/auth/confirmar-email').send({ token: tokenConfirmar }).expect(403);
    await ctx.http.post('/api/v1/auth/confirmar-email').set('Origin', 'https://evil.example').send({ token: tokenConfirmar }).expect(403);
    await ctx.http.post('/api/v1/auth/confirmar-email').set('Origin', ORIGEM).send({ token: tokenConfirmar }).expect(200);

    const d = await entrar(ctx, dono.email);
    const c = await ctx.http.post('/api/v1/convites').set(auth(d.accessToken)).send({ nome: 'Mec', email: `o-${sufixo()}@teste.local` }).expect(201);
    const tokenConvite = tokenDoLink(c.body.link)!;
    await ctx.http.post('/api/v1/convites/aceitar').send({ token: tokenConvite, senha: 'chave-de-roda-12' }).expect(403);
    await ctx.http.post('/api/v1/convites/consultar').send({ token: tokenConvite }).expect(200);
  });

  it('[regressão T3] token de redefinir senha não confirma e-mail nem cria sessão (tipo errado)', async () => {
    const { oficina } = await criarOficinaComUsuario(ctx);
    const pendente = await criarUsuarioNa(ctx, oficina.id, 'FUNCIONARIO', { emailConfirmadoEm: null });
    const tokens = ctx.app.get(TokensUsuarioService);
    const token = await ctx.tenant.executarComo(oficina.id, () => tokens.criar(ctx.prisma.db, pendente, 'REDEFINIR_SENHA'));
    const r = await ctx.http.post('/api/v1/auth/confirmar-email').set('Origin', ORIGEM).send({ token }).expect(400);
    expect(r.body.code).toBe('TOKEN_INVALIDO');
  });

  it('[regressão T6] nome da oficina e do convidado com HTML saem escapados no e-mail de convite', async () => {
    const { usuario: dono } = await criarOficinaComUsuario(ctx);
    const d = await entrar(ctx, dono.email);
    await ctx.http.patch('/api/v1/oficinas/atual').set(auth(d.accessToken)).send({ nome: '<img src=x onerror=alert(1)>', telefone: '43988887777' }).expect(200);
    const email = `xss-${sufixo()}@teste.local`;
    await ctx.http.post('/api/v1/convites').set(auth(d.accessToken)).send({ nome: '<script>alert(1)</script>', email }).expect(201);
    const m = ctx.emails.ultimoPara(email)!;
    expect(m.html).not.toContain('<img');
    expect(m.html).not.toContain('<script');
    expect(m.html).toContain('&lt;img src=x onerror=alert(1)&gt;');
  });

  it('[regressão T7] respostas de sessão, equipe e convites não trazem hash de senha nem de token', async () => {
    const { usuario: dono } = await criarOficinaComUsuario(ctx);
    const login = await ctx.http.post('/api/v1/auth/login').set('Origin', ORIGEM).send({ identificador: dono.email, senha: 'motor-v8-turbo' }).expect(200);
    const token = login.body.accessToken as string;
    await ctx.http.post('/api/v1/convites').set(auth(token)).send({ nome: 'Mec', email: `h-${sufixo()}@teste.local` }).expect(201);
    const corpos = [
      login.body,
      (await ctx.http.get('/api/v1/auth/eu').set(auth(token)).expect(200)).body,
      (await ctx.http.get('/api/v1/usuarios').set(auth(token)).expect(200)).body,
      (await ctx.http.get('/api/v1/convites').set(auth(token)).expect(200)).body,
    ];
    for (const corpo of corpos) {
      const texto = JSON.stringify(corpo);
      expect(texto).not.toMatch(/senhaHash|tokenHash|\$argon2/);
    }
  });
});
