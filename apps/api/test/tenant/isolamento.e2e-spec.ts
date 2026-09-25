import { Test, TestingModule } from '@nestjs/testing';
import { AppModule } from '../../src/app.module.js';
import { TenantAusenteError, TenantContext, TenantViolacaoError } from '../../src/common/tenant/tenant-context.js';
import { PrismaService } from '../../src/prisma/prisma.service.js';
import { criarCliente, criarOficina, criarUsuario, criarVeiculo } from '../fabricas.js';

const donos = (lista: Array<{ id: string; oficinaId: string }>) => Object.fromEntries(lista.map((r) => [r.id, r.oficinaId]));

describe('Isolamento entre oficinas (extensão do Prisma)', () => {
  let modulo: TestingModule;
  let prisma: PrismaService;
  let tenant: TenantContext;
  let oficinaA: string;
  let oficinaB: string;
  let clienteA: { id: string };

  const comoA = <T>(fn: () => Promise<T>) => tenant.executarComo(oficinaA, fn);
  const comoB = <T>(fn: () => Promise<T>) => tenant.executarComo(oficinaB, fn);

  beforeAll(async () => {
    modulo = await Test.createTestingModule({ imports: [AppModule] }).compile();
    prisma = modulo.get(PrismaService);
    tenant = modulo.get(TenantContext);
  });

  afterAll(() => modulo.close());

  beforeEach(async () => {
    oficinaA = (await criarOficina(prisma, tenant, 'A')).id;
    oficinaB = (await criarOficina(prisma, tenant, 'B')).id;
    clienteA = await criarCliente(prisma, tenant, oficinaA, 'Cliente da A');
  });

  it('sem contexto, qualquer consulta em model da oficina falha', async () => {
    await expect(prisma.db.cliente.findMany()).rejects.toThrow(TenantAusenteError);
    await expect(prisma.db.cliente.count()).rejects.toThrow(TenantAusenteError);
    await expect(prisma.db.oficina.findMany()).rejects.toThrow(TenantAusenteError);
  });

  it('findMany e count de B não veem nada de A', async () => {
    expect(await comoB(() => prisma.db.cliente.findMany())).toEqual([]);
    expect(await comoB(() => prisma.db.cliente.count())).toBe(0);
    expect(await comoA(() => prisma.db.cliente.count())).toBe(1);
  });

  it('findUnique e findFirst de B pelo id de A retornam null', async () => {
    expect(await comoB(() => prisma.db.cliente.findUnique({ where: { id: clienteA.id } }))).toBeNull();
    expect(await comoB(() => prisma.db.cliente.findFirst({ where: { id: clienteA.id } }))).toBeNull();
  });

  it('update e delete de B pelo id de A dão "não encontrado" e não mexem em A', async () => {
    await expect(comoB(() => prisma.db.cliente.update({ where: { id: clienteA.id }, data: { nome: 'hack' } })))
      .rejects.toMatchObject({ code: 'P2025' });
    await expect(comoB(() => prisma.db.cliente.delete({ where: { id: clienteA.id } })))
      .rejects.toMatchObject({ code: 'P2025' });
    const intacto = await comoA(() => prisma.db.cliente.findUnique({ where: { id: clienteA.id } }));
    expect(intacto?.nome).toBe('Cliente da A');
  });

  it('updateMany e deleteMany de B não afetam A', async () => {
    expect((await comoB(() => prisma.db.cliente.updateMany({ data: { nome: 'hack' } }))).count).toBe(0);
    expect((await comoB(() => prisma.db.cliente.deleteMany())).count).toBe(0);
    expect(await comoA(() => prisma.db.cliente.count())).toBe(1);
  });

  it('create em B com oficinaId de A grava em B', async () => {
    const criado = await comoB(() => prisma.db.cliente.create({ data: { oficinaId: oficinaA, telefone: '+5543977776666' } }));
    expect(criado.oficinaId).toBe(oficinaB);
  });

  it('update não pode mover registro para outra oficina', async () => {
    await expect(comoA(() => prisma.db.cliente.update({ where: { id: clienteA.id }, data: { oficinaId: oficinaB } })))
      .rejects.toThrow(TenantViolacaoError);
  });

  it('upsert de B com o id de A cria um registro novo em B e não altera A', async () => {
    const criado = await comoB(() =>
      prisma.db.cliente.upsert({
        where: { id: clienteA.id },
        create: { oficinaId: oficinaB, telefone: '+5543966665555', nome: 'Novo em B' },
        update: { nome: 'hack' },
      }),
    );
    expect(criado.oficinaId).toBe(oficinaB);
    expect(criado.id).not.toBe(clienteA.id);
    const intacto = await comoA(() => prisma.db.cliente.findUnique({ where: { id: clienteA.id } }));
    expect(intacto?.nome).toBe('Cliente da A');
  });

  it('a oficina só enxerga a si mesma', async () => {
    expect(await comoA(() => prisma.db.oficina.findUnique({ where: { id: oficinaB } }))).toBeNull();
    const visiveis = await comoA(() => prisma.db.oficina.findMany());
    expect(visiveis.map((o) => o.id)).toEqual([oficinaA]);
  });

  describe('escrita por relação entre oficinas (probes da revisão final)', () => {
    let clienteB: { id: string };
    let veiculoA: { id: string };
    let veiculoB: { id: string };

    // sem tenant: leitura "da verdade" para as asserções, sem o filtro da extensão
    const verdade = () =>
      tenant.executarSemTenant(async () => ({
        clientes: await prisma.db.cliente.findMany({ where: { id: { in: [clienteA.id, clienteB.id] } }, orderBy: { id: 'asc' } }),
        veiculos: await prisma.db.veiculo.findMany({ where: { id: { in: [veiculoA.id, veiculoB.id] } }, orderBy: { id: 'asc' } }),
      }));

    beforeEach(async () => {
      clienteB = await criarCliente(prisma, tenant, oficinaB, 'Cliente da B');
      veiculoA = await criarVeiculo(prisma, tenant, oficinaA, clienteA.id);
      veiculoB = await criarVeiculo(prisma, tenant, oficinaB, clienteB.id);
    });

    const tentativas: Array<[string, () => Promise<unknown>]> = [
      [
        'r0: cliente.update com oficina: { connect: B }',
        () => comoA(() => prisma.db.cliente.update({ where: { id: clienteA.id }, data: { oficina: { connect: { id: oficinaB } } } })),
      ],
      [
        'r1: veiculo.update com cliente: { connect: clienteB }',
        () => comoA(() => prisma.db.veiculo.update({ where: { id: veiculoA.id }, data: { cliente: { connect: { id: clienteB.id } } } })),
      ],
      [
        'r3: oficina.update com clientes: { connect: clienteB }',
        () => comoA(() => prisma.db.oficina.update({ where: { id: oficinaA }, data: { clientes: { connect: { id: clienteB.id } } } })),
      ],
      [
        'upsert.update com cliente: { connect: clienteB }',
        () =>
          comoA(() =>
            prisma.db.veiculo.upsert({
              where: { id: veiculoA.id },
              create: { oficinaId: oficinaA, clienteId: clienteA.id, placa: 'ZZZ9999' },
              update: { cliente: { connect: { id: clienteB.id } } },
            }),
          ),
      ],
      [
        'cliente.update com veiculos: { connect: veiculoB }',
        () => comoA(() => prisma.db.cliente.update({ where: { id: clienteA.id }, data: { veiculos: { connect: { id: veiculoB.id } } } })),
      ],
    ];

    it.each(tentativas)('%s lança TenantViolacaoError e não altera nenhuma das oficinas', async (_nome, tentar) => {
      const antes = await verdade();
      await expect(tentar()).rejects.toThrow(TenantViolacaoError);
      const depois = await verdade();
      expect(depois).toEqual(antes);
      expect(donos(depois.clientes)).toEqual({ [clienteA.id]: oficinaA, [clienteB.id]: oficinaB });
      expect(donos(depois.veiculos)).toEqual({ [veiculoA.id]: oficinaA, [veiculoB.id]: oficinaB });
    });

    it('include de responsavel nunca traz usuário de outra oficina', async () => {
      const usuarioB = await criarUsuario(prisma, tenant, oficinaB);
      const usuarioA = await criarUsuario(prisma, tenant, oficinaA);
      const os = await comoA(() =>
        prisma.db.ordemServico.create({
          data: { oficinaId: oficinaA, numero: 1, veiculoId: veiculoA.id, clienteId: clienteA.id, relatoCliente: 'freio', responsavelId: usuarioA.id },
        }),
      );
      await expect(comoA(() => prisma.db.ordemServico.update({ where: { id: os.id }, data: { responsavelId: usuarioB.id } }))).rejects.toMatchObject({
        code: 'P2003',
      });
      const lida = await comoA(() => prisma.db.ordemServico.findUnique({ where: { id: os.id }, include: { responsavel: true } }));
      expect(lida?.responsavel?.id).toBe(usuarioA.id);
      expect(lida?.responsavel?.oficinaId).toBe(oficinaA);
    });
  });

  it('executarSemTenant enxerga as duas oficinas (uso restrito)', async () => {
    const total = await tenant.executarSemTenant(() =>
      prisma.db.oficina.count({ where: { id: { in: [oficinaA, oficinaB] } } }),
    );
    expect(total).toBe(2);
  });
});
