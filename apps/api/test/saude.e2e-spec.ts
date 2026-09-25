import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { configurarApp } from '../src/configurar-app.js';

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
    expect(res.body).toEqual({ status: 'ok' });
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

  it('recusa corpo acima de 100kb', async () => {
    const grande = { texto: 'x'.repeat(150_000) };
    const res = await request(app.getHttpServer()).post('/api/v1/saude').send(grande);
    expect(res.status).toBe(413);
    expect(res.body.code).toBe('CORPO_MUITO_GRANDE');
  });
});
