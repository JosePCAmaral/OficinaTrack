import { cookieRefresh, criarApp, criarOficinaComUsuario, criarUsuarioNa, entrar, ORIGEM, sufixo, type App } from './apoio-auth.js';

const tokenDoLink = (texto: string) => /#([A-Za-z0-9_-]{43})/.exec(texto)?.[1];

describe('Convites', () => {
  let ctx: App;
  beforeAll(async () => { ctx = await criarApp(); });
  afterAll(() => ctx.app.close());
  const auth = (t: string) => ({ Authorization: `Bearer ${t}` });

  it('fluxo completo: convidar → e-mail + link → consultar → aceitar → sessão de FUNCIONARIO', async () => {
    const { oficina, usuario: dono } = await criarOficinaComUsuario(ctx);
    const d = await entrar(ctx, dono.email);
    const email = `Mec-${sufixo()}@Teste.Local`;
    // sufixo numérico aleatório: o telefone não pode se repetir entre execuções (banco não é zerado)
    const sufixoTelefone = String(Math.floor(Math.random() * 9000) + 1000);
    const criado = await ctx.http.post('/api/v1/convites').set(auth(d.accessToken)).send({ nome: 'Mecânico', email, telefone: `(43) 99999-${sufixoTelefone}` }).expect(201);
    expect(criado.body.convite).toMatchObject({ email: email.toLowerCase(), perfil: 'FUNCIONARIO', telefone: `+554399999${sufixoTelefone}` });
    expect(criado.body.link).toMatch(/^http:\/\/localhost:5173\/convite#[A-Za-z0-9_-]{43}$/);
    const mensagem = ctx.emails.ultimoPara(email.toLowerCase())!;
    const token = tokenDoLink(mensagem.texto)!;
    expect(criado.body.link.endsWith(token)).toBe(true);

    const info = await ctx.http.post('/api/v1/convites/consultar').send({ token }).expect(200);
    expect(info.body).toMatchObject({ nomeOficina: oficina.nome, nome: 'Mecânico', email: email.toLowerCase() });

    const r = await ctx.http.post('/api/v1/convites/aceitar').set('Origin', ORIGEM).send({ token, senha: 'chave-de-roda-12' }).expect(200);
    expect(r.body.usuario).toMatchObject({ perfil: 'FUNCIONARIO', oficina: { id: oficina.id } });
    expect(cookieRefresh(r)).toMatch(/^ot_refresh=/);
    await entrar(ctx, email, 'chave-de-roda-12');
    await ctx.http.post('/api/v1/convites/aceitar').set('Origin', ORIGEM).send({ token, senha: 'outra-senha-boa' }).expect(400);
  });

  it('e-mail que já tem conta → 409 EMAIL_JA_CADASTRADO', async () => {
    const { usuario: dono } = await criarOficinaComUsuario(ctx);
    const outra = await criarOficinaComUsuario(ctx);
    const d = await entrar(ctx, dono.email);
    // "X" teria 1 caractere e cairia na validação de nome (min. 2) antes de chegar no service:
    // usamos um nome válido para exercitar mesmo a checagem de e-mail já cadastrado.
    const r = await ctx.http.post('/api/v1/convites').set(auth(d.accessToken)).send({ nome: 'Ex', email: outra.usuario.email }).expect(409);
    expect(r.body.code).toBe('EMAIL_JA_CADASTRADO');
  });

  it('reenviar invalida o link antigo; cancelar invalida o convite', async () => {
    const { usuario: dono } = await criarOficinaComUsuario(ctx);
    const d = await entrar(ctx, dono.email);
    const email = `mec-${sufixo()}@teste.local`;
    const c = await ctx.http.post('/api/v1/convites').set(auth(d.accessToken)).send({ nome: 'Mec', email }).expect(201);
    const antigo = tokenDoLink(c.body.link)!;
    const r = await ctx.http.post(`/api/v1/convites/${c.body.convite.id}/reenviar`).set(auth(d.accessToken)).expect(200);
    await ctx.http.post('/api/v1/convites/consultar').send({ token: antigo }).expect(400);
    const novo = tokenDoLink(r.body.link)!;
    await ctx.http.delete(`/api/v1/convites/${c.body.convite.id}`).set(auth(d.accessToken)).expect(204);
    await ctx.http.post('/api/v1/convites/consultar').send({ token: novo }).expect(400);
  });

  it('reenviar vale no máximo 3 vezes por convite; a 4ª → 429 MUITAS_TENTATIVAS e o último link segue válido', async () => {
    const { usuario: dono } = await criarOficinaComUsuario(ctx);
    const d = await entrar(ctx, dono.email);
    const c = await ctx.http.post('/api/v1/convites').set(auth(d.accessToken)).send({ nome: 'Mec', email: `reenv-${sufixo()}@teste.local` }).expect(201);
    let ultimo = '';
    for (let i = 0; i < 3; i++) {
      ultimo = (await ctx.http.post(`/api/v1/convites/${c.body.convite.id}/reenviar`).set(auth(d.accessToken)).expect(200)).body.link;
    }
    const r = await ctx.http.post(`/api/v1/convites/${c.body.convite.id}/reenviar`).set(auth(d.accessToken)).expect(429);
    expect(r.body).toMatchObject({ code: 'MUITAS_TENTATIVAS', message: 'Limite de reenvios deste convite atingido. Cancele e convide de novo' });
    await ctx.http.post('/api/v1/convites/consultar').send({ token: tokenDoLink(ultimo)! }).expect(200);
    // cancelar e convidar de novo zera a contagem (convite novo)
    await ctx.http.delete(`/api/v1/convites/${c.body.convite.id}`).set(auth(d.accessToken)).expect(204);
    await ctx.http.post(`/api/v1/convites/${c.body.convite.id}/reenviar`).set(auth(d.accessToken)).expect(404);
  });

  it('convite DONO de um DONO ativo é aceito normalmente', async () => {
    const { oficina, usuario: dono } = await criarOficinaComUsuario(ctx);
    const d = await entrar(ctx, dono.email);
    const c = await ctx.http.post('/api/v1/convites').set(auth(d.accessToken)).send({ nome: 'Sócia', email: `socia-${sufixo()}@teste.local`, perfil: 'DONO' }).expect(201);
    const r = await ctx.http.post('/api/v1/convites/aceitar').set('Origin', ORIGEM).send({ token: tokenDoLink(c.body.link)!, senha: 'chave-de-roda-12' }).expect(200);
    expect(r.body.usuario).toMatchObject({ perfil: 'DONO', oficina: { id: oficina.id } });
  });

  const pendentesDe = (oficinaId: string, criadoPorId: string) =>
    ctx.tenant.executarComo(oficinaId, () => ctx.prisma.db.convite.count({ where: { criadoPorId, usadoEm: null } }));

  async function cenario() {
    const { oficina, usuario: dono1 } = await criarOficinaComUsuario(ctx);
    const dono2 = await criarUsuarioNa(ctx, oficina.id, 'DONO');
    const d1 = await entrar(ctx, dono1.email);
    const d2 = await entrar(ctx, dono2.email);
    const deDono1 = await ctx.http.post('/api/v1/convites').set(auth(d1.accessToken)).send({ nome: 'Mec', email: `d1-${sufixo()}@teste.local` }).expect(201);
    await ctx.http.post('/api/v1/convites').set(auth(d2.accessToken)).send({ nome: 'Mec', email: `d2-${sufixo()}@teste.local` }).expect(201);
    expect(await pendentesDe(oficina.id, dono2.id)).toBe(1);
    return { oficina, dono1, dono2, d1, deDono1 };
  }

  describe('convites pendentes de quem perde acesso são apagados (auditoria #1)', () => {
    it('ao desativar', async () => {
      const { oficina, dono1, dono2, d1, deDono1 } = await cenario();
      await ctx.http.patch(`/api/v1/usuarios/${dono2.id}`).set(auth(d1.accessToken)).send({ ativo: false }).expect(200);
      expect(await pendentesDe(oficina.id, dono2.id)).toBe(0);
      expect(await pendentesDe(oficina.id, dono1.id)).toBe(1); // os de quem continua DONO ficam
      await ctx.http.post('/api/v1/convites/consultar').send({ token: tokenDoLink(deDono1.body.link)! }).expect(200);
    });

    it('ao rebaixar', async () => {
      const { oficina, dono2, d1 } = await cenario();
      await ctx.http.patch(`/api/v1/usuarios/${dono2.id}`).set(auth(d1.accessToken)).send({ perfil: 'FUNCIONARIO' }).expect(200);
      expect(await pendentesDe(oficina.id, dono2.id)).toBe(0);
    });

    it('ao redefinir a senha (conta possivelmente invadida)', async () => {
      const { oficina, dono2 } = await cenario();
      await ctx.http.post('/api/v1/auth/esqueci-senha').send({ email: dono2.email }).expect(200);
      await ctx.emails.aguardarPendentes();
      const token = tokenDoLink(ctx.emails.ultimoPara(dono2.email)!.texto)!;
      await ctx.http.post('/api/v1/auth/redefinir-senha').send({ token, senha: 'nova-senha-do-ze' }).expect(200);
      expect(await pendentesDe(oficina.id, dono2.id)).toBe(0);
    });
  });

  it('convite expirado → TOKEN_INVALIDO', async () => {
    const { oficina, usuario: dono } = await criarOficinaComUsuario(ctx);
    const d = await entrar(ctx, dono.email);
    const c = await ctx.http.post('/api/v1/convites').set(auth(d.accessToken)).send({ nome: 'Mec', email: `exp-${sufixo()}@teste.local` }).expect(201);
    await ctx.tenant.executarComo(oficina.id, () => ctx.prisma.db.convite.update({ where: { id: c.body.convite.id }, data: { expiraEm: new Date(Date.now() - 1000) } }));
    const r = await ctx.http.post('/api/v1/convites/consultar').send({ token: tokenDoLink(c.body.link)! }).expect(400);
    expect(r.body.code).toBe('TOKEN_INVALIDO');
  });

  it('isolamento: dono de A não lista, reenvia nem cancela convite de B (404); FUNCIONARIO → 403', async () => {
    const a = await criarOficinaComUsuario(ctx);
    const b = await criarOficinaComUsuario(ctx);
    const dA = await entrar(ctx, a.usuario.email);
    const dB = await entrar(ctx, b.usuario.email);
    const cB = await ctx.http.post('/api/v1/convites').set(auth(dB.accessToken)).send({ nome: 'Mec', email: `iso-${sufixo()}@teste.local` }).expect(201);
    const lista = await ctx.http.get('/api/v1/convites').set(auth(dA.accessToken)).expect(200);
    expect(lista.body.find((c: { id: string }) => c.id === cB.body.convite.id)).toBeUndefined();
    await ctx.http.post(`/api/v1/convites/${cB.body.convite.id}/reenviar`).set(auth(dA.accessToken)).expect(404);
    await ctx.http.delete(`/api/v1/convites/${cB.body.convite.id}`).set(auth(dA.accessToken)).expect(404);
    const func = await criarUsuarioNa(ctx, a.oficina.id, 'FUNCIONARIO');
    const f = await entrar(ctx, func.email);
    await ctx.http.post('/api/v1/convites').set(auth(f.accessToken)).send({ nome: 'X', email: `f-${sufixo()}@teste.local` }).expect(403);
  });

  it('aceitar com telefone já usado por outra conta → 409 TELEFONE_JA_CADASTRADO e o convite continua válido', async () => {
    const { usuario: dono } = await criarOficinaComUsuario(ctx);
    const d = await entrar(ctx, dono.email);
    const c = await ctx.http.post('/api/v1/convites').set(auth(d.accessToken)).send({ nome: 'Mec', email: `tel-${sufixo()}@teste.local` }).expect(201);
    const token = tokenDoLink(c.body.link)!;
    const r = await ctx.http.post('/api/v1/convites/aceitar').set('Origin', ORIGEM).send({ token, senha: 'chave-de-roda-12', telefone: dono.telefone }).expect(409);
    expect(r.body.code).toBe('TELEFONE_JA_CADASTRADO');
    await ctx.http.post('/api/v1/convites/aceitar').set('Origin', ORIGEM).send({ token, senha: 'chave-de-roda-12' }).expect(200);
  });

  it('POST /convites/consultar é público e não é capturado pelo controller autenticado', async () => {
    const { usuario: dono } = await criarOficinaComUsuario(ctx);
    const d = await entrar(ctx, dono.email);
    const c = await ctx.http.post('/api/v1/convites').set(auth(d.accessToken)).send({ nome: 'Mec', email: `rota-${sufixo()}@teste.local` }).expect(201);
    const token = tokenDoLink(c.body.link)!;
    // sem Authorization: se caísse no controller de DONO, receberia 401 (NAO_AUTENTICADO)
    const r = await ctx.http.post('/api/v1/convites/consultar').send({ token }).expect(200);
    expect(r.body).toMatchObject({ nome: 'Mec' });
  });
});
