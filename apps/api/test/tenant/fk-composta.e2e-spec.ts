import { Test, TestingModule } from '@nestjs/testing';
import { AppModule } from '../../src/app.module.js';
import { TenantContext } from '../../src/common/tenant/tenant-context.js';
import { PrismaService } from '../../src/prisma/prisma.service.js';

describe('FK composta impede referência entre oficinas', () => {
  let modulo: TestingModule;
  let prisma: PrismaService;
  let tenant: TenantContext;

  beforeAll(async () => {
    modulo = await Test.createTestingModule({ imports: [AppModule] }).compile();
    prisma = modulo.get(PrismaService);
    tenant = modulo.get(TenantContext);
  });

  afterAll(() => modulo.close());

  const novaOficina = (nome: string) =>
    prisma.db.oficina.create({
      data: { nome, telefone: '+5543999990000', termosVersao: '2026-09', termosAceitosEm: new Date() },
    });

  // sem tenant: teste da camada do banco (FK composta), não da extensão de tenant
  it('veículo da oficina A não pode apontar para cliente da oficina B', async () =>
    tenant.executarSemTenant(async () => {
      const a = await novaOficina('A');
      const b = await novaOficina('B');
      const clienteB = await prisma.db.cliente.create({
        data: { oficinaId: b.id, telefone: '+5543911112222' },
      });

      await expect(
        prisma.db.veiculo.create({
          data: { oficinaId: a.id, clienteId: clienteB.id, placa: 'ABC1234' },
        }),
      ).rejects.toMatchObject({ code: 'P2003' });
    }));

  // sem tenant: teste da camada do banco (FK composta), não da extensão de tenant
  it('mesma oficina funciona', async () =>
    tenant.executarSemTenant(async () => {
      const a = await novaOficina('A');
      const clienteA = await prisma.db.cliente.create({
        data: { oficinaId: a.id, telefone: '+5543911113333' },
      });
      const veiculo = await prisma.db.veiculo.create({
        data: { oficinaId: a.id, clienteId: clienteA.id, placa: 'ABC1D23' },
      });
      expect(veiculo.oficinaId).toBe(a.id);
    }));
});
