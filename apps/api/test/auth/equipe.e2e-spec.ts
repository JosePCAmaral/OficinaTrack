import { UsuariosService } from '../../src/modules/usuarios/usuarios.service.js';
import { criarApp, criarOficinaComUsuario, criarUsuarioNa, entrar, ORIGEM, type App } from './apoio-auth.js';

describe('Oficina e equipe', () => {
  let ctx: App;
  beforeAll(async () => { ctx = await criarApp(); });
  afterAll(() => ctx.app.close());
  const auth = (t: string) => ({ Authorization: `Bearer ${t}` });

  it('DONO edita a oficina; FUNCIONARIO recebe 403', async () => {
    const { oficina, usuario: dono } = await criarOficinaComUsuario(ctx);
    const func = await criarUsuarioNa(ctx, oficina.id, 'FUNCIONARIO');
    const d = await entrar(ctx, dono.email);
    const f = await entrar(ctx, func.email);
    const r = await ctx.http.patch('/api/v1/oficinas/atual').set(auth(d.accessToken)).send({ nome: 'Oficina Nova', telefone: '43988887777', uf: 'PR', documento: '' }).expect(200);
    expect(r.body).toMatchObject({ id: oficina.id, nome: 'Oficina Nova', telefone: '+5543988887777', documento: null });
    await ctx.http.get('/api/v1/oficinas/atual').set(auth(f.accessToken)).expect(200);
    const negado = await ctx.http.patch('/api/v1/oficinas/atual').set(auth(f.accessToken)).send({ nome: 'x', telefone: '43988887777' }).expect(403);
    expect(negado.body.code).toBe('SEM_PERMISSAO');
    await ctx.http.get('/api/v1/usuarios').set(auth(f.accessToken)).expect(403);
  });

  it('isolamento: dono de A não vê nem altera usuário de B (404)', async () => {
    const a = await criarOficinaComUsuario(ctx);
    const b = await criarOficinaComUsuario(ctx);
    const funcB = await criarUsuarioNa(ctx, b.oficina.id, 'FUNCIONARIO');
    const donoA = await entrar(ctx, a.usuario.email);
    const lista = await ctx.http.get('/api/v1/usuarios').set(auth(donoA.accessToken)).expect(200);
    expect(lista.body.map((u: { id: string }) => u.id)).toEqual([a.usuario.id]);
    await ctx.http.patch(`/api/v1/usuarios/${funcB.id}`).set(auth(donoA.accessToken)).send({ ativo: false }).expect(404);
    const intacto = await ctx.tenant.executarComo(b.oficina.id, () => ctx.prisma.db.usuario.findUnique({ where: { id: funcB.id } }));
    expect(intacto?.ativo).toBe(true);
    expect(lista.body[0]).not.toHaveProperty('senhaHash');
  });

  it('desativar derruba acesso e sessão na hora; reativar devolve o login (Review Focus 4)', async () => {
    const { oficina, usuario: dono } = await criarOficinaComUsuario(ctx);
    const func = await criarUsuarioNa(ctx, oficina.id, 'FUNCIONARIO');
    const d = await entrar(ctx, dono.email);
    const f = await entrar(ctx, func.email);
    await ctx.http.patch(`/api/v1/usuarios/${func.id}`).set(auth(d.accessToken)).send({ ativo: false }).expect(200);
    await ctx.http.get('/api/v1/auth/eu').set(auth(f.accessToken)).expect(401);
    await ctx.http.post('/api/v1/auth/refresh').set('Origin', ORIGEM).set('Cookie', f.cookie).expect(401);
    await ctx.http.patch(`/api/v1/usuarios/${func.id}`).set(auth(d.accessToken)).send({ ativo: true }).expect(200);
    await entrar(ctx, func.email);
  });

  it('reativar não ressuscita o access token emitido antes da desativação (sessaoValidaDesde)', async () => {
    const { oficina, usuario: dono } = await criarOficinaComUsuario(ctx);
    const func = await criarUsuarioNa(ctx, oficina.id, 'FUNCIONARIO');
    const d = await entrar(ctx, dono.email);
    const antigo = await entrar(ctx, func.email);
    await ctx.http.patch(`/api/v1/usuarios/${func.id}`).set(auth(d.accessToken)).send({ ativo: false }).expect(200);
    await ctx.http.patch(`/api/v1/usuarios/${func.id}`).set(auth(d.accessToken)).send({ ativo: true }).expect(200);
    await ctx.http.get('/api/v1/auth/eu').set(auth(antigo.accessToken)).expect(401);
    const novo = await entrar(ctx, func.email);
    await ctx.http.get('/api/v1/auth/eu').set(auth(novo.accessToken)).expect(200);
  });

  it('GET /oficinas/atual: DONO recebe o CPF/CNPJ; FUNCIONARIO recebe null (minimização)', async () => {
    const { oficina, usuario: dono } = await criarOficinaComUsuario(ctx);
    const func = await criarUsuarioNa(ctx, oficina.id, 'FUNCIONARIO');
    const d = await entrar(ctx, dono.email);
    await ctx.http.patch('/api/v1/oficinas/atual').set(auth(d.accessToken)).send({ nome: 'Oficina MEI', telefone: '43988887777', documento: '529.982.247-25' }).expect(200);
    const doDono = await ctx.http.get('/api/v1/oficinas/atual').set(auth(d.accessToken)).expect(200);
    expect(doDono.body).toMatchObject({ nome: 'Oficina MEI', documento: '52998224725' });
    const f = await entrar(ctx, func.email);
    const doFunc = await ctx.http.get('/api/v1/oficinas/atual').set(auth(f.accessToken)).expect(200);
    expect(doFunc.body).toMatchObject({ nome: 'Oficina MEI', documento: null });
  });

  it('não pode alterar a si mesmo nem deixar a oficina sem DONO ativo (Review Focus 5)', async () => {
    const { oficina, usuario: dono1 } = await criarOficinaComUsuario(ctx);
    const dono2 = await criarUsuarioNa(ctx, oficina.id, 'DONO');
    const d1 = await entrar(ctx, dono1.email);
    const si = await ctx.http.patch(`/api/v1/usuarios/${dono1.id}`).set(auth(d1.accessToken)).send({ perfil: 'FUNCIONARIO' }).expect(422);
    expect(si.body.code).toBe('ACAO_NAO_PERMITIDA_EM_SI_MESMO');
    // rebaixar o dono2 é permitido (dono1 continua DONO)
    await ctx.http.patch(`/api/v1/usuarios/${dono2.id}`).set(auth(d1.accessToken)).send({ perfil: 'FUNCIONARIO' }).expect(200);
    // dono2 volta a ser DONO e dono1 é desativado por ele: continua havendo um DONO ativo
    await ctx.http.patch(`/api/v1/usuarios/${dono2.id}`).set(auth(d1.accessToken)).send({ perfil: 'DONO' }).expect(200);
    const d2 = await entrar(ctx, dono2.email);
    await ctx.http.patch(`/api/v1/usuarios/${dono1.id}`).set(auth(d2.accessToken)).send({ ativo: false }).expect(200);
  });

  // Pela HTTP, hoje só um DONO ativo gerencia a equipe, e ele não pode alterar a si mesmo:
  // sempre sobra ele. A regra ULTIMO_DONO protege perfis futuros com EQUIPE_GERENCIAR que
  // não sejam DONO; por isso é testada direto no service, com um "ator" que não é DONO.
  it('ULTIMO_DONO: o service recusa rebaixar ou desativar o único DONO ativo', async () => {
    const { oficina, usuario: dono } = await criarOficinaComUsuario(ctx);
    const ator = await criarUsuarioNa(ctx, oficina.id, 'FUNCIONARIO');
    const usuarios = ctx.app.get(UsuariosService);
    for (const dados of [{ perfil: 'FUNCIONARIO' as const }, { ativo: false }]) {
      await expect(
        ctx.tenant.executarComo(oficina.id, () => usuarios.alterar(dono.id, dados, { id: ator.id, oficinaId: oficina.id })),
      ).rejects.toMatchObject({ code: 'ULTIMO_DONO' });
    }
    const intacto = await ctx.tenant.executarComo(oficina.id, () => ctx.prisma.db.usuario.findUnique({ where: { id: dono.id } }));
    expect(intacto).toMatchObject({ perfil: 'DONO', ativo: true });
  });

  // Dois DONOs se rebaixando um ao outro ao mesmo tempo: sem transação serializável, os dois
  // poderiam passar pela contagem de "outros DONOs ativos" antes de qualquer gravação e a
  // oficina ficaria sem nenhum DONO ativo (TOCTOU).
  it('concorrência: dois DONOs se rebaixando ao mesmo tempo nunca deixam a oficina sem DONO ativo', async () => {
    const { oficina, usuario: donoA } = await criarOficinaComUsuario(ctx);
    const donoB = await criarUsuarioNa(ctx, oficina.id, 'DONO');
    const usuarios = ctx.app.get(UsuariosService);

    const resultados = await ctx.tenant.executarComo(oficina.id, () =>
      Promise.allSettled([
        usuarios.alterar(donoB.id, { perfil: 'FUNCIONARIO' }, { id: donoA.id, oficinaId: oficina.id }),
        usuarios.alterar(donoA.id, { perfil: 'FUNCIONARIO' }, { id: donoB.id, oficinaId: oficina.id }),
      ]),
    );

    const rejeitados = resultados.filter((r) => r.status === 'rejected');
    expect(rejeitados.length).toBeGreaterThanOrEqual(1);
    for (const r of rejeitados) {
      expect((r as PromiseRejectedResult).reason).toMatchObject({ code: expect.stringMatching(/^(ULTIMO_DONO|CONFLITO)$/) });
    }
    const donosAtivos = await ctx.tenant.executarComo(oficina.id, () =>
      ctx.prisma.db.usuario.count({ where: { id: { in: [donoA.id, donoB.id] }, perfil: 'DONO', ativo: true } }),
    );
    expect(donosAtivos).toBeGreaterThanOrEqual(1);
  });
});
