import { INestApplication, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { configurarApp } from '../src/configurar-app.js';
import { PrismaService } from '../src/prisma/prisma.service.js';

describe('Saúde e formato de erro (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const modulo = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = modulo.createNestApplication({ bodyParser: false });
    configurarApp(app);
    await app.init();
  });

  afterAll(() => app.close());

  it('GET /api/v1/saude responde ok', async () => {
    const res = await request(app.getHttpServer()).get('/api/v1/saude').expect(200);
    expect(res.body).toEqual({ status: 'ok', banco: 'ok' });
  });

  it('rota inexistente usa o formato padrão de erro', async () => {
    const res = await request(app.getHttpServer()).get('/api/v1/nao-existe').expect(404);
    expect(res.body).toEqual({ statusCode: 404, code: 'RECURSO_NAO_ENCONTRADO', message: 'Recurso não encontrado' });
  });

  it('envia cabeçalhos do Helmet', async () => {
    const res = await request(app.getHttpServer()).get('/api/v1/saude');
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['x-powered-by']).toBeUndefined();
  });

  it('não publica o Swagger fora de development', async () => {
    await request(app.getHttpServer()).get('/api/docs').expect(404);
  });

  it('recusa corpo acima de 100kb', async () => {
    const grande = { texto: 'x'.repeat(150_000) };
    const res = await request(app.getHttpServer()).post('/api/v1/saude').send(grande);
    expect(res.status).toBe(413);
    expect(res.body.code).toBe('CORPO_MUITO_GRANDE');
  });
});

describe('Saúde com banco fora do ar (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    // banco "fora do ar" simulado: a consulta de saúde falha como falharia sem conexão
    const prismaFalhando = { db: { $queryRaw: vi.fn().mockRejectedValue(new Error('connect ECONNREFUSED 127.0.0.1:5432')) } };
    const modulo = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PrismaService)
      .useValue(prismaFalhando)
      .compile();
    app = modulo.createNestApplication({ bodyParser: false });
    configurarApp(app);
    await app.init();
  });

  afterAll(() => app.close());
  afterEach(() => vi.restoreAllMocks());

  it('GET /api/v1/saude responde 503 no formato padrão', async () => {
    vi.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    const res = await request(app.getHttpServer()).get('/api/v1/saude').expect(503);
    expect(res.body).toEqual({ statusCode: 503, code: 'SERVICO_INDISPONIVEL', message: 'Banco de dados indisponível' });
  });
});

describe('Swagger em development', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const modulo = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(ConfigService)
      .useValue({ get: (chave: string) => (chave === 'NODE_ENV' ? 'development' : process.env[chave]) })
      .compile();
    app = modulo.createNestApplication({ bodyParser: false });
    configurarApp(app);
    await app.init();
  });

  afterAll(() => app.close());

  it('publica /api/docs só quando NODE_ENV=development', async () => {
    await request(app.getHttpServer()).get('/api/docs').expect(200);
  });
});
