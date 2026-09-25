/**
 * T1 — contexto de tenant (nestjs-cls) e bordas da extensão do Prisma.
 *
 * Prepara a Sprint 2: o guard JWT vai chamar `tenant.definirOficina()` e os fluxos de
 * login/refresh/convite/portal vão usar `executarSemTenant`. Aqui ficam os testes de
 * regressão dos controles que estão corretos e os que provam as falhas (marcados
 * "FALHA HOJE").
 */
import { ClsService } from 'nestjs-cls';
import { TenantAusenteError } from '../../src/common/tenant/tenant-context.js';
import { Ctx, iniciar, montarOficina, sufixo, verdade } from './apoio.js';

const idsClientes = (lista: Array<{ id: string }>) => lista.map((c) => c.id);

describe('T1: contexto de tenant', () => {
  let ctx: Ctx;
  let A: Awaited<ReturnType<typeof montarOficina>>;
  let B: Awaited<ReturnType<typeof montarOficina>>;
  const comoA = <T>(fn: () => Promise<T>) => ctx.tenant.executarComo(A.oficina.id, fn);
  const comoB = <T>(fn: () => Promise<T>) => ctx.tenant.executarComo(B.oficina.id, fn);

  beforeAll(async () => {
    ctx = await iniciar();
  });
  afterAll(() => ctx.modulo.close());
  beforeEach(async () => {
    A = await montarOficina(ctx, `A-${sufixo()}`);
    B = await montarOficina(ctx, `B-${sufixo()}`);
  });

  // FALHA HOJE (achado #3): dentro de executarSemTenant, definirOficina() grava o
  // oficinaId mas não desliga o "semTenant"; a consulta continua sem filtro.
  // Caso real da Sprint 2: aceite de convite acha o convite sem tenant e depois
  // "entra" na oficina do convite para criar o usuário.
  it('definirOficina dentro de executarSemTenant passa a filtrar (ou falha fechado)', async () => {
    const vistos = await ctx.tenant
      .executarSemTenant(async () => {
        ctx.tenant.definirOficina(A.oficina.id);
        return ctx.prisma.db.cliente.findMany({ where: { id: { in: [A.cliente.id, B.cliente.id] } } });
      })
      .catch(() => [] as Array<{ id: string }>);
    expect(idsClientes(vistos)).not.toContain(B.cliente.id);
  });

  // FALHA HOJE (achado #4): RefreshToken é global (sem oficinaId) e o include de
  // `usuario` a partir dele não passa pelo filtro. Em contexto da oficina A dá para
  // listar tokens (hash, família, validade) e usuários (senhaHash) da oficina B.
  it('em contexto de A, RefreshToken não expõe tokens nem usuários de B', async () => {
    const tokenHash = `hash-${sufixo()}`;
    await verdade(ctx, () =>
      ctx.prisma.db.refreshToken.create({
        // oficinaId passou a ser obrigatório no RefreshToken (correção do achado #4)
        data: {
          oficinaId: B.oficina.id,
          usuarioId: B.usuario.id,
          familiaId: sufixo(),
          tokenHash,
          expiraEm: new Date(Date.now() + 864e5),
        },
      }),
    );
    const vistos = await comoA(() =>
      ctx.prisma.db.refreshToken.findMany({ where: { tokenHash }, include: { usuario: true } }),
    ).catch(() => []);
    expect(vistos).toEqual([]);
  });

  // Regressão: transação interativa usa o client estendido e respeita o contexto.
  it('$transaction interativa filtra pela oficina do contexto', async () => {
    const vistos = await comoB(() =>
      ctx.prisma.db.$transaction(async (tx) =>
        tx.cliente.findMany({ where: { id: { in: [A.cliente.id, B.cliente.id] } } }),
      ),
    );
    expect(idsClientes(vistos)).toEqual([B.cliente.id]);
  });

  // Regressão: escrita dentro de transação interativa também é forçada para a oficina.
  it('$transaction interativa força oficinaId no create', async () => {
    const criado = await comoB(() =>
      ctx.prisma.db.$transaction((tx) =>
        tx.cliente.create({ data: { oficinaId: A.oficina.id, telefone: '+5543955554444' } }),
      ),
    );
    expect(criado.oficinaId).toBe(B.oficina.id);
  });

  // Regressão: transação em lote (array) também passa pela extensão.
  it('$transaction em lote filtra pela oficina do contexto', async () => {
    const [lista, total] = await comoB(() =>
      ctx.prisma.db.$transaction([
        ctx.prisma.db.cliente.findMany({ where: { id: { in: [A.cliente.id, B.cliente.id] } } }),
        ctx.prisma.db.cliente.count({ where: { id: A.cliente.id } }),
      ]),
    );
    expect(idsClientes(lista)).toEqual([B.cliente.id]);
    expect(total).toBe(0);
  });

  // Regressão: requisições simultâneas de oficinas diferentes não misturam contexto.
  it('contextos concorrentes não vazam um para o outro', async () => {
    const ids = [A.cliente.id, B.cliente.id];
    const rodadas = await Promise.all(
      Array.from({ length: 20 }, (_, i) =>
        (i % 2 ? comoA : comoB)(async () => {
          await new Promise((r) => setTimeout(r, Math.random() * 10));
          return { i, vistos: idsClientes(await ctx.prisma.db.cliente.findMany({ where: { id: { in: ids } } })) };
        }),
      ),
    );
    for (const { i, vistos } of rodadas) expect(vistos).toEqual([i % 2 ? A.cliente.id : B.cliente.id]);
  });

  // Regressão: executarComo aninhado restaura o contexto externo ao terminar.
  it('executarComo aninhado não altera o contexto de fora', async () => {
    const ids = [A.cliente.id, B.cliente.id];
    const depois = await comoA(async () => {
      await comoB(() => ctx.prisma.db.cliente.findMany());
      return idsClientes(await ctx.prisma.db.cliente.findMany({ where: { id: { in: ids } } }));
    });
    expect(depois).toEqual([A.cliente.id]);
  });

  // Regressão: executarSemTenant dentro de um contexto de oficina não "vaza" para fora.
  it('executarSemTenant não desliga o filtro do contexto que o chamou', async () => {
    const ids = [A.cliente.id, B.cliente.id];
    const depois = await comoA(async () => {
      await ctx.tenant.executarSemTenant(() => ctx.prisma.db.cliente.count());
      return idsClientes(await ctx.prisma.db.cliente.findMany({ where: { id: { in: ids } } }));
    });
    expect(depois).toEqual([A.cliente.id]);
  });

  // Regressão: executarComo dentro de executarSemTenant volta a filtrar.
  it('executarComo dentro de executarSemTenant filtra', async () => {
    const ids = [A.cliente.id, B.cliente.id];
    const vistos = await ctx.tenant.executarSemTenant(() =>
      comoA(() => ctx.prisma.db.cliente.findMany({ where: { id: { in: ids } } })),
    );
    expect(idsClientes(vistos)).toEqual([A.cliente.id]);
  });

  // Regressão (falha fechada): uma consulta montada dentro do contexto mas executada
  // depois que ele terminou (PrismaPromise é preguiçosa) não herda a oficina.
  it('consulta preguiçosa executada fora do contexto falha fechado', async () => {
    const { consulta } = await comoA(async () => ({ consulta: ctx.prisma.db.cliente.findMany() }));
    await expect(consulta).rejects.toThrow(TenantAusenteError);
  });

  // Regressão (falha fechada): o guard da Sprint 2 não consegue "definir" oficina
  // fora de um contexto CLS ativo (ex.: se o middleware do CLS não estiver montado).
  it('definirOficina fora de contexto CLS ativo lança erro', () => {
    expect(ctx.modulo.get(ClsService).isActive()).toBe(false);
    expect(() => ctx.tenant.definirOficina(A.oficina.id)).toThrow();
  });

  // Regressão: groupBy/aggregate também recebem o filtro.
  it('aggregate e groupBy só contam a oficina do contexto', async () => {
    const ids = [A.cliente.id, B.cliente.id];
    const agg = await comoB(() => ctx.prisma.db.cliente.aggregate({ where: { id: { in: ids } }, _count: true }));
    // `_count` é o nome da API do Prisma
    // oxlint-disable-next-line eslint/no-underscore-dangle
    expect(agg._count).toBe(1);
    const grupos = await comoB(() =>
      ctx.prisma.db.cliente.groupBy({ by: ['oficinaId'], where: { id: { in: ids } }, _count: true }),
    );
    expect(grupos.map((g) => g.oficinaId)).toEqual([B.oficina.id]);
  });

  // Regressão: filtro de relação não permite "enxergar" dados de B por dentro do where.
  it('filtro por relação não retorna registros de outra oficina', async () => {
    const vistos = await comoA(() =>
      ctx.prisma.db.veiculo.findMany({ where: { cliente: { id: B.cliente.id } } }),
    );
    expect(vistos).toEqual([]);
  });
});
