/**
 * T1 — escritas por relação (nested writes) atravessando oficinas.
 *
 * A extensão de tenant só olha o nível de cima da operação (`where`, `data.oficinaId`).
 * `connect`/`create` aninhados e FKs simples (sem `oficinaId`) passam direto por ela.
 * Cada teste simula um service da oficina A recebendo um id da oficina B (ex.: vindo
 * do body de uma requisição) e verifica, lendo o banco sem filtro, que nada de B
 * mudou de dono ou ficou referenciado por A.
 *
 * Os testes marcados "FALHA HOJE" provam a vulnerabilidade; ficam verdes quando a
 * extensão/schema forem corrigidos (ver docs/auditorias/2026-09-25-sprint-1.md).
 */
import { Ctx, iniciar, montarOficina, sufixo, verdade } from './apoio.js';

describe('T1: escrita por relação não atravessa oficinas', () => {
  let ctx: Ctx;
  let A: Awaited<ReturnType<typeof montarOficina>>;
  let B: Awaited<ReturnType<typeof montarOficina>>;
  const comoA = <T>(fn: () => Promise<T>) => ctx.tenant.executarComo(A.oficina.id, fn);

  beforeAll(async () => {
    ctx = await iniciar();
  });
  afterAll(() => ctx.modulo.close());
  beforeEach(async () => {
    A = await montarOficina(ctx, `A-${sufixo()}`);
    B = await montarOficina(ctx, `B-${sufixo()}`);
  });

  // FALHA HOJE (achado #1): connect aninhado "puxa" o veículo de B para A.
  it('A não consegue puxar veículo de B com cliente.update({ veiculos: { connect } })', async () => {
    await comoA(() =>
      ctx.prisma.db.cliente.update({
        where: { id: A.cliente.id },
        data: { veiculos: { connect: { id: B.veiculo.id } } },
      }),
    ).catch(() => undefined);

    const veiculoB = await verdade(ctx, () => ctx.prisma.db.veiculo.findUnique({ where: { id: B.veiculo.id } }));
    expect(veiculoB?.oficinaId).toBe(B.oficina.id);
    expect(veiculoB?.clienteId).toBe(B.cliente.id);
  });

  // FALHA HOJE (achado #1): connect aninhado a partir da própria Oficina puxa cliente de B
  // (e, pelo ON UPDATE CASCADE das FKs compostas, os veículos dele junto).
  it('A não consegue puxar cliente de B com oficina.update({ clientes: { connect } })', async () => {
    await comoA(() =>
      ctx.prisma.db.oficina.update({
        where: { id: A.oficina.id },
        data: { clientes: { connect: { id: B.cliente.id } } },
      }),
    ).catch(() => undefined);

    const [clienteB, veiculoB] = await verdade(ctx, () =>
      Promise.all([
        ctx.prisma.db.cliente.findUnique({ where: { id: B.cliente.id } }),
        ctx.prisma.db.veiculo.findUnique({ where: { id: B.veiculo.id } }),
      ]),
    );
    expect(clienteB?.oficinaId).toBe(B.oficina.id);
    expect(veiculoB?.oficinaId).toBe(B.oficina.id);
  });

  // FALHA HOJE (achado #1): `oficina: { connect }` troca a oficina sem passar pela
  // checagem de `data.oficinaId` e empurra o registro (e dependentes) para B.
  it('A não consegue empurrar o próprio cliente para B com { oficina: { connect } }', async () => {
    await comoA(() =>
      ctx.prisma.db.cliente.update({
        where: { id: A.cliente.id },
        data: { oficina: { connect: { id: B.oficina.id } } },
      }),
    ).catch(() => undefined);

    const clienteA = await verdade(ctx, () => ctx.prisma.db.cliente.findUnique({ where: { id: A.cliente.id } }));
    expect(clienteA?.oficinaId).toBe(A.oficina.id);
  });

  // FALHA HOJE (achado #2): FK simples OrdemServico.responsavelId aceita usuário de B,
  // e o include devolve o usuário de B inteiro (incluindo senhaHash) para A.
  it('OS de A não pode ter responsável de B (e include não vaza usuário de B)', async () => {
    const os = await comoA(() =>
      ctx.prisma.db.ordemServico
        .create({
          data: {
            oficinaId: A.oficina.id,
            numero: Math.floor(Math.random() * 1e9),
            veiculoId: A.veiculo.id,
            clienteId: A.cliente.id,
            relatoCliente: 'barulho no freio',
            responsavelId: B.usuario.id,
          },
        })
        .catch(() => null),
    );

    if (os) {
      const lida = await comoA(() =>
        ctx.prisma.db.ordemServico.findUnique({ where: { id: os.id }, include: { responsavel: true } }),
      );
      expect(lida?.responsavel?.oficinaId ?? A.oficina.id).toBe(A.oficina.id);
    }
    const gravada = os && (await verdade(ctx, () => ctx.prisma.db.ordemServico.findUnique({ where: { id: os.id } })));
    expect(gravada?.responsavelId ?? null).not.toBe(B.usuario.id);
  });

  // FALHA HOJE (achado #2): mesmo problema em EventoOS.autorId.
  it('evento de OS de A não pode ter autor de B', async () => {
    const evento = await comoA(async () => {
      const os = await ctx.prisma.db.ordemServico.create({
        data: {
          oficinaId: A.oficina.id,
          numero: Math.floor(Math.random() * 1e9),
          veiculoId: A.veiculo.id,
          clienteId: A.cliente.id,
          relatoCliente: 'luz de injeção',
        },
      });
      return ctx.prisma.db.eventoOS
        .create({
          data: { oficinaId: A.oficina.id, ordemServicoId: os.id, tipo: 'COMENTARIO', autorId: B.usuario.id },
        })
        .catch(() => null);
    });
    expect(evento?.autorId ?? null).not.toBe(B.usuario.id);
  });

  // FALHA HOJE (achado #2): Foto.eventoId aceita evento de outra oficina.
  it('foto de A não pode apontar para evento de B', async () => {
    const criarOsComEvento = (o: typeof A) =>
      ctx.tenant.executarComo(o.oficina.id, async () => {
        const os = await ctx.prisma.db.ordemServico.create({
          data: {
            oficinaId: o.oficina.id,
            numero: Math.floor(Math.random() * 1e9),
            veiculoId: o.veiculo.id,
            clienteId: o.cliente.id,
            relatoCliente: 'revisão',
          },
        });
        const evento = await ctx.prisma.db.eventoOS.create({
          data: { oficinaId: o.oficina.id, ordemServicoId: os.id, tipo: 'FOTO', visivelCliente: false, texto: 'interno' },
        });
        return { os, evento };
      });
    const doA = await criarOsComEvento(A);
    const doB = await criarOsComEvento(B);

    const foto = await comoA(() =>
      ctx.prisma.db.foto
        .create({
          data: {
            oficinaId: A.oficina.id,
            ordemServicoId: doA.os.id,
            eventoId: doB.evento.id,
            storageKey: `oficinas/${A.oficina.id}/teste.jpg`,
          },
        })
        .catch(() => null),
    );
    expect(foto?.eventoId ?? null).not.toBe(doB.evento.id);
  });

  // Regressão (passa hoje): create aninhado herda a oficina do pai pela FK composta.
  it('create aninhado de veículo dentro de cliente fica na oficina do contexto', async () => {
    const cliente = await comoA(() =>
      ctx.prisma.db.cliente.create({
        data: {
          oficinaId: B.oficina.id, // ignorado: a extensão força A
          telefone: '+5543988887777',
          veiculos: { create: [{ placa: 'QWE1R23' }] },
        },
        include: { veiculos: true },
      }),
    );
    expect(cliente.oficinaId).toBe(A.oficina.id);
    expect(cliente.veiculos.map((v) => v.oficinaId)).toEqual([A.oficina.id]);
  });

  // Regressão (passa hoje): create com connect para cliente de B é barrado pela FK composta.
  it('veículo criado em A com cliente de B (FK composta) é recusado', async () => {
    await expect(
      comoA(() =>
        ctx.prisma.db.veiculo.create({ data: { oficinaId: A.oficina.id, clienteId: B.cliente.id, placa: 'ZXC9V87' } }),
      ),
    ).rejects.toMatchObject({ code: 'P2003' });
  });
});
