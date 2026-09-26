import { CodigosPilotoService } from '../../src/modules/auth/codigos-piloto.service.js';
import { cookieRefresh, criarApp, ORIGEM, sufixo, telefone, type App } from './apoio-auth.js';

const tokenDoLink = (texto: string) => /#([A-Za-z0-9_-]{43})/.exec(texto)?.[1];

describe('Cadastro e confirmação de e-mail', () => {
  let ctx: App;
  let codigos: CodigosPilotoService;
  beforeAll(async () => { ctx = await criarApp(); codigos = ctx.app.get(CodigosPilotoService); });
  afterAll(() => ctx.app.close());

  const dados = (codigoPiloto: string, email = `dono-${sufixo()}@teste.local`) => ({
    codigoPiloto,
    oficina: { nome: 'Oficina do Zé', telefone: telefone(), cidade: 'Ribeirão do Pinhal', uf: 'PR' },
    dono: { nome: 'José', email, senha: 'motor-v8-turbo' },
    aceiteTermos: true,
  });

  it('fluxo completo: cadastro → e-mail → confirmar → sessão', async () => {
    const codigo = await codigos.gerar('teste');
    const email = `Dono-${sufixo()}@Teste.Local`;
    await ctx.http.post('/api/v1/auth/cadastro').send(dados(codigo, email)).expect(201);

    // antes de confirmar, o login é recusado com EMAIL_NAO_CONFIRMADO
    const antes = await ctx.http.post('/api/v1/auth/login').send({ identificador: email, senha: 'motor-v8-turbo' }).expect(403);
    expect(antes.body.code).toBe('EMAIL_NAO_CONFIRMADO');

    const mensagem = ctx.emails.ultimoPara(email.toLowerCase());
    expect(mensagem?.assunto).toBe('Confirme seu e-mail no OficinaTrack');
    const token = tokenDoLink(mensagem!.texto)!;
    expect(mensagem!.texto).toContain(`http://localhost:5173/confirmar-email#${token}`);

    const r = await ctx.http.post('/api/v1/auth/confirmar-email').set('Origin', ORIGEM).send({ token }).expect(200);
    expect(r.body.usuario).toMatchObject({ perfil: 'DONO', email: email.toLowerCase(), oficina: { nome: 'Oficina do Zé' } });
    expect(cookieRefresh(r)).toMatch(/^ot_refresh=/);

    // token de uso único
    const reuso = await ctx.http.post('/api/v1/auth/confirmar-email').set('Origin', ORIGEM).send({ token }).expect(400);
    expect(reuso.body.code).toBe('TOKEN_INVALIDO');
  });

  it('código de piloto é de uso único', async () => {
    const codigo = await codigos.gerar('teste');
    await ctx.http.post('/api/v1/auth/cadastro').send(dados(codigo)).expect(201);
    const r = await ctx.http.post('/api/v1/auth/cadastro').send(dados(codigo)).expect(400);
    expect(r.body.code).toBe('CODIGO_PILOTO_INVALIDO');
  });

  it('código inexistente → 400 e nada é criado', async () => {
    const email = `nada-${sufixo()}@teste.local`;
    await ctx.http.post('/api/v1/auth/cadastro').send(dados('XXXX-XXXX-XXXX', email)).expect(400);
    // sem tenant: conferência global de que o e-mail não virou conta
    const total = await ctx.tenant.executarSemTenant(() => ctx.prisma.db.usuario.count({ where: { email } }));
    expect(total).toBe(0);
  });

  it('e-mail já cadastrado → 409 e o código NÃO é consumido', async () => {
    const email = `repetido-${sufixo()}@teste.local`;
    await ctx.http.post('/api/v1/auth/cadastro').send(dados(await codigos.gerar('a'), email)).expect(201);
    const codigo = await codigos.gerar('b');
    const r = await ctx.http.post('/api/v1/auth/cadastro').send(dados(codigo, email)).expect(409);
    expect(r.body.code).toBe('EMAIL_JA_CADASTRADO');
    await ctx.http.post('/api/v1/auth/cadastro').send(dados(codigo)).expect(201);
  });

  it('reenviar confirmação invalida o link anterior e responde igual para e-mail desconhecido', async () => {
    const email = `reenvio-${sufixo()}@teste.local`;
    await ctx.http.post('/api/v1/auth/cadastro').send(dados(await codigos.gerar('c'), email)).expect(201);
    const primeiro = tokenDoLink(ctx.emails.ultimoPara(email)!.texto)!;
    const r1 = await ctx.http.post('/api/v1/auth/reenviar-confirmacao').send({ email }).expect(200);
    const r2 = await ctx.http.post('/api/v1/auth/reenviar-confirmacao').send({ email: `ninguem-${sufixo()}@teste.local` }).expect(200);
    expect(r1.body).toEqual(r2.body);
    await ctx.emails.aguardarPendentes(); // token e e-mail saem depois da resposta
    const segundo = tokenDoLink(ctx.emails.ultimoPara(email)!.texto)!;
    expect(segundo).not.toBe(primeiro);
    await ctx.http.post('/api/v1/auth/confirmar-email').set('Origin', ORIGEM).send({ token: primeiro }).expect(400);
    await ctx.http.post('/api/v1/auth/confirmar-email').set('Origin', ORIGEM).send({ token: segundo }).expect(200);
  });

  it('reenviar confirmação: no máximo 3 links por hora para o mesmo destinatário (contando o do cadastro)', async () => {
    const email = `limite-${sufixo()}@teste.local`;
    await ctx.http.post('/api/v1/auth/cadastro').send(dados(await codigos.gerar('e'), email)).expect(201);
    for (let i = 0; i < 4; i++) await ctx.http.post('/api/v1/auth/reenviar-confirmacao').send({ email }).expect(200);
    await ctx.emails.aguardarPendentes();
    expect(ctx.emails.enviados.filter((m) => m.para === email)).toHaveLength(3);
  });

  it('WhatsApp do dono (opcional): salvo em E.164 e serve para entrar pelo telefone', async () => {
    const email = `zap-${sufixo()}@teste.local`;
    const zap = telefone();
    const base = dados(await codigos.gerar('f'), email);
    await ctx.http.post('/api/v1/auth/cadastro').send({ ...base, dono: { ...base.dono, telefone: zap.replace('+55', '') } }).expect(201);
    const token = tokenDoLink(ctx.emails.ultimoPara(email)!.texto)!;
    await ctx.http.post('/api/v1/auth/confirmar-email').set('Origin', ORIGEM).send({ token }).expect(200);
    const r = await ctx.http.post('/api/v1/auth/login').send({ identificador: zap, senha: 'motor-v8-turbo' }).expect(200);
    expect(r.body.usuario).toMatchObject({ email, perfil: 'DONO' });
  });

  it('WhatsApp já usado por outra conta → 409 TELEFONE_JA_CADASTRADO e o código NÃO é consumido', async () => {
    const zap = telefone();
    const primeiro = dados(await codigos.gerar('g'));
    await ctx.http.post('/api/v1/auth/cadastro').send({ ...primeiro, dono: { ...primeiro.dono, telefone: zap } }).expect(201);
    const codigo = await codigos.gerar('h');
    const segundo = dados(codigo);
    const r = await ctx.http.post('/api/v1/auth/cadastro').send({ ...segundo, dono: { ...segundo.dono, telefone: zap } }).expect(409);
    expect(r.body.code).toBe('TELEFONE_JA_CADASTRADO');
    await ctx.http.post('/api/v1/auth/cadastro').send(dados(codigo)).expect(201);
  });

  it('corrida de cadastros com o mesmo WhatsApp: um passa, o outro recebe TELEFONE_JA_CADASTRADO (P2002 mapeado)', async () => {
    const zap = telefone();
    const [a, b] = [dados(await codigos.gerar('i')), dados(await codigos.gerar('j'))];
    const respostas = await Promise.all(
      [a, b].map((d) => ctx.http.post('/api/v1/auth/cadastro').send({ ...d, dono: { ...d.dono, telefone: zap } })),
    );
    expect(respostas.map((r) => r.status).toSorted()).toEqual([201, 409]);
    expect(respostas.find((r) => r.status === 409)!.body.code).toBe('TELEFONE_JA_CADASTRADO');
  });

  it('senha comum e termos não aceitos são recusados pelo schema', async () => {
    const codigo = await codigos.gerar('d');
    const base = dados(codigo);
    await ctx.http.post('/api/v1/auth/cadastro').send({ ...base, dono: { ...base.dono, senha: '12345678' } }).expect(400);
    await ctx.http.post('/api/v1/auth/cadastro').send({ ...base, aceiteTermos: false }).expect(400);
  });
});
