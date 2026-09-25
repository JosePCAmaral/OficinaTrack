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
    const segundo = tokenDoLink(ctx.emails.ultimoPara(email)!.texto)!;
    expect(segundo).not.toBe(primeiro);
    await ctx.http.post('/api/v1/auth/confirmar-email').set('Origin', ORIGEM).send({ token: primeiro }).expect(400);
    await ctx.http.post('/api/v1/auth/confirmar-email').set('Origin', ORIGEM).send({ token: segundo }).expect(200);
  });

  it('senha comum e termos não aceitos são recusados pelo schema', async () => {
    const codigo = await codigos.gerar('d');
    const base = dados(codigo);
    await ctx.http.post('/api/v1/auth/cadastro').send({ ...base, dono: { ...base.dono, senha: '12345678' } }).expect(400);
    await ctx.http.post('/api/v1/auth/cadastro').send({ ...base, aceiteTermos: false }).expect(400);
  });
});
