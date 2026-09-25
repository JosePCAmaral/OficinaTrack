import { criarApp, criarOficinaComUsuario, criarUsuarioNa, entrar, type App } from './apoio-auth.js';

describe('Guards globais', () => {
  let ctx: App;
  beforeAll(async () => { ctx = await criarApp(); });
  afterAll(() => ctx.app.close());

  it('rota sem @Publico exige login (negação por padrão)', async () => {
    const r = await ctx.http.get('/api/v1/auth/eu').expect(401);
    expect(r.body.code).toBe('NAO_AUTENTICADO');
  });

  it('token inválido, adulterado ou assinado com outro segredo → 401', async () => {
    const { usuario } = await criarOficinaComUsuario(ctx);
    const { accessToken } = await entrar(ctx, usuario.email);
    const [cab, corpo] = accessToken.split('.');
    const adulterado = `${cab}.${corpo}.assinatura-falsa`;
    await ctx.http.get('/api/v1/auth/eu').set('Authorization', `Bearer ${adulterado}`).expect(401);
    await ctx.http.get('/api/v1/auth/eu').set('Authorization', 'Bearer lixo').expect(401);
  });

  it('usuário desativado perde acesso na próxima chamada (Review Focus 4)', async () => {
    const { oficina } = await criarOficinaComUsuario(ctx);
    const func = await criarUsuarioNa(ctx, oficina.id, 'FUNCIONARIO');
    const { accessToken } = await entrar(ctx, func.email);
    await ctx.tenant.executarComo(oficina.id, () => ctx.prisma.db.usuario.update({ where: { id: func.id }, data: { ativo: false } }));
    await ctx.http.get('/api/v1/auth/eu').set('Authorization', `Bearer ${accessToken}`).expect(401);
  });

  it('saúde continua pública', async () => {
    await ctx.http.get('/api/v1/saude').expect(200);
  });
});
