/**
 * T7 (configuração, erros e logs) e T8 (abuso) sobre a superfície HTTP da Sprint 1.
 */
import { INestApplication, Logger } from '@nestjs/common';
import request from 'supertest';
import { FiltroErros } from '../../src/common/erros/filtro-erros.js';
import { configurarApp } from '../../src/configurar-app.js';
import { Prisma } from '../../src/generated/prisma/client.js';
import { Ctx, iniciar, montarOficina, sufixo } from './apoio.js';

describe('T7: erros e logs', () => {
  let ctx: Ctx;

  beforeAll(async () => {
    ctx = await iniciar();
  });
  afterAll(() => ctx.modulo.close());
  afterEach(() => vi.restoreAllMocks());

  // FALHA HOJE (achado #5): o FiltroErros loga `erro.stack` de qualquer 5xx. Para
  // PrismaClientValidationError (bug de programação, ex.: campo errado no service)
  // a mensagem inclui a chamada com TODOS os argumentos, ou seja, telefone, nome,
  // e-mail, observações etc. vão parar no log.
  it('erro 500 vindo do Prisma não grava dados pessoais no log', async () => {
    const A = await montarOficina(ctx, `A-${sufixo()}`);
    const telefonePessoal = '+5543912345678';
    const erro = await ctx.tenant
      .executarComo(A.oficina.id, () =>
        ctx.prisma.db.cliente.create({
          // campo inexistente simula um bug de service; o telefone é dado pessoal
          data: { telefone: telefonePessoal, email: 'fulano@exemplo.com', campoQueNaoExiste: 1 } as never,
        }),
      )
      .catch((e: unknown) => e);
    expect(erro).toBeInstanceOf(Error);

    const logado: string[] = [];
    vi.spyOn(Logger.prototype, 'error').mockImplementation((...args: unknown[]) => {
      logado.push(args.map(String).join(' '));
    });
    const res = { status: () => res, json: () => res };
    new FiltroErros().catch(erro, { switchToHttp: () => ({ getResponse: () => res }) } as never);

    const texto = logado.join('\n');
    expect(texto).not.toContain(telefonePessoal);
    expect(texto).not.toContain('fulano@exemplo.com');
  });

  // FALHA HOJE (achado #8): violação de unicidade (telefone/placa/e-mail já
  // cadastrado, fluxo normal de usuário) vira 500 e gera log de erro com stack.
  it('P2002 (unicidade) vira 409 e não 500', () => {
    vi.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    const erro = new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
      code: 'P2002',
      clientVersion: Prisma.prismaVersion.client,
    });
    expect(new FiltroErros().converter(erro).statusCode).toBe(409);
  });

  // Regressão: a resposta de 500 nunca leva stack nem mensagem interna.
  it('resposta de erro interno é genérica', () => {
    vi.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    const corpo = new FiltroErros().converter(new Error('senha do banco: xyz em /app/src/x.ts:10'));
    expect(corpo).toEqual({ statusCode: 500, code: 'ERRO_INTERNO', message: 'Erro interno' });
  });
});

describe('T7/T8: configuração HTTP', () => {
  let ctx: Ctx;
  let app: INestApplication;

  beforeAll(async () => {
    ctx = await iniciar();
    app = ctx.modulo.createNestApplication({ bodyParser: false });
    configurarApp(app);
    await app.init();
  });
  afterAll(() => app.close());

  // FALHA HOJE (achado #6): Swagger fica ligado em qualquer NODE_ENV que não seja
  // exatamente "production" e NODE_ENV tem default "development". Um deploy sem
  // NODE_ENV (ou com "staging"/"test") publica /api/docs. Deve ser opt-in (só development).
  it('não publica o Swagger fora de development', async () => {
    expect(process.env.NODE_ENV).toBe('test');
    const res = await request(app.getHttpServer()).get('/api/docs');
    expect(res.status).toBe(404);
  });

  // Regressão: HSTS e cabeçalhos do Helmet.
  it('envia HSTS e remove X-Powered-By', async () => {
    const res = await request(app.getHttpServer()).get('/api/v1/saude');
    expect(res.headers['strict-transport-security']).toMatch(/max-age=\d{7,}/);
    expect(res.headers['x-powered-by']).toBeUndefined();
    expect(res.headers['x-frame-options']).toBeDefined();
  });

  // Regressão: CORS só libera a origem configurada.
  it('CORS não libera origem desconhecida', async () => {
    const ok = await request(app.getHttpServer()).get('/api/v1/saude').set('Origin', 'http://localhost:5173');
    expect(ok.headers['access-control-allow-origin']).toBe('http://localhost:5173');
    const ruim = await request(app.getHttpServer()).get('/api/v1/saude').set('Origin', 'https://evil.example');
    expect(ruim.headers['access-control-allow-origin']).not.toBe('https://evil.example');
    expect(ruim.headers['access-control-allow-origin']).not.toBe('*');
  });

  // Regressão: corpo em formato não-JSON não é aceito (só o parser JSON está ligado).
  it('corpo urlencoded não é interpretado', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/saude')
      .type('form')
      .send('oficinaId=x');
    expect(res.status).toBe(404);
  });

  // Regressão T8: throttler global devolve 429 no formato padrão e não é contornado
  // trocando o X-Forwarded-For (trust proxy desligado).
  it('throttler global limita e não confia em X-Forwarded-For', async () => {
    const servidor = app.getHttpServer();
    let ultimo = 200;
    for (let i = 0; i < 130 && ultimo !== 429; i++) {
      ultimo = (await request(servidor).get('/api/v1/saude').set('X-Forwarded-For', `10.0.0.${i % 250}`)).status;
    }
    expect(ultimo).toBe(429);
    const res = await request(servidor).get('/api/v1/saude').set('X-Forwarded-For', '10.9.9.9');
    expect(res.status).toBe(429);
    expect(res.body.code).toBe('MUITAS_REQUISICOES');
  });
});
