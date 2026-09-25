import { Test, TestingModule } from '@nestjs/testing';
import { AppModule } from '../../src/app.module.js';
import { TenantAusenteError, TenantContext, TenantViolacaoError } from '../../src/common/tenant/tenant-context.js';
import { PrismaService } from '../../src/prisma/prisma.service.js';
import { criarCliente, criarOficina } from '../fabricas.js';

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

  it('include de relação traz só dados da mesma oficina', async () => {
    await comoA(() => prisma.db.veiculo.create({ data: { oficinaId: oficinaA, clienteId: clienteA.id, placa: 'ABC1234' } }));
    const [cliente] = await comoA(() => prisma.db.cliente.findMany({ include: { veiculos: true } }));
    expect(cliente?.veiculos.every((v) => v.oficinaId === oficinaA)).toBe(true);
  });

  it('executarSemTenant enxerga as duas oficinas (uso restrito)', async () => {
    const total = await tenant.executarSemTenant(() =>
      prisma.db.oficina.count({ where: { id: { in: [oficinaA, oficinaB] } } }),
    );
    expect(total).toBe(2);
  });
});
