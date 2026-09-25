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

  const criarDados = async (nome: string) => {
    const oficina = await novaOficina(nome);
    const usuario = await prisma.db.usuario.create({
      data: {
        oficinaId: oficina.id,
        nome: `Dono ${nome}`,
        email: `fk-${Math.random().toString(36).slice(2)}@teste.local`,
        senhaHash: 'hash-de-teste-nao-e-senha',
        perfil: 'DONO',
      },
    });
    const cliente = await prisma.db.cliente.create({
      data: { oficinaId: oficina.id, telefone: `+55439${String(Math.floor(Math.random() * 1e8)).padStart(8, '0')}` },
    });
    const veiculo = await prisma.db.veiculo.create({
      data: { oficinaId: oficina.id, clienteId: cliente.id, placa: `FKT${String(Math.floor(Math.random() * 1e4)).padStart(4, '0')}` },
    });
    const os = await prisma.db.ordemServico.create({
      data: { oficinaId: oficina.id, numero: 1, veiculoId: veiculo.id, clienteId: cliente.id, relatoCliente: 'teste' },
    });
    const evento = await prisma.db.eventoOS.create({
      data: { oficinaId: oficina.id, ordemServicoId: os.id, tipo: 'COMENTARIO' },
    });
    return { oficina, usuario, cliente, os, evento };
  };

  // sem tenant: teste da camada do banco (FK composta), não da extensão de tenant
  const semTenant = <T>(fn: () => Promise<T>) => tenant.executarSemTenant(fn);
  const montar = () => semTenant(async () => ({ a: await criarDados('A'), b: await criarDados('B') }));

  describe('FKs opcionais e RefreshToken (achado #2/#4 da auditoria)', () => {
    it('OS da oficina A com responsavelId de B → P2003', async () => {
      const { a, b } = await montar();
      await expect(
        semTenant(() => prisma.db.ordemServico.update({ where: { id: a.os.id }, data: { responsavelId: b.usuario.id } })),
      ).rejects.toMatchObject({ code: 'P2003' });
      const ok = await semTenant(() =>
        prisma.db.ordemServico.update({ where: { id: a.os.id }, data: { responsavelId: a.usuario.id } }),
      );
      expect(ok.responsavelId).toBe(a.usuario.id);
    });

    it('evento da oficina A com autorId de B → P2003', async () => {
      const { a, b } = await montar();
      await expect(
        semTenant(() =>
          prisma.db.eventoOS.create({
            data: { oficinaId: a.oficina.id, ordemServicoId: a.os.id, tipo: 'COMENTARIO', autorId: b.usuario.id },
          }),
        ),
      ).rejects.toMatchObject({ code: 'P2003' });
    });

    it('foto da oficina A com eventoId de B → P2003', async () => {
      const { a, b } = await montar();
      await expect(
        semTenant(() =>
          prisma.db.foto.create({
            data: { oficinaId: a.oficina.id, ordemServicoId: a.os.id, eventoId: b.evento.id, storageKey: 'x.jpg' },
          }),
        ),
      ).rejects.toMatchObject({ code: 'P2003' });
    });

    it('refresh token da oficina A com usuarioId de B → P2003', async () => {
      const { a, b } = await montar();
      await expect(
        semTenant(() =>
          prisma.db.refreshToken.create({
            data: {
              oficinaId: a.oficina.id,
              usuarioId: b.usuario.id,
              familiaId: 'f',
              tokenHash: `fk-${Math.random().toString(36).slice(2)}`,
              expiraEm: new Date(Date.now() + 60_000),
            },
          }),
        ),
      ).rejects.toMatchObject({ code: 'P2003' });
    });

    it('apagar a OS apaga eventos e fotos na mesma instrução (Foto.evento é NO ACTION)', async () => {
      const { a } = await montar();
      await semTenant(() =>
        prisma.db.foto.create({
          data: { oficinaId: a.oficina.id, ordemServicoId: a.os.id, eventoId: a.evento.id, storageKey: 'y.jpg' },
        }),
      );
      await semTenant(() => prisma.db.ordemServico.delete({ where: { id: a.os.id } }));
      expect(await semTenant(() => prisma.db.foto.count({ where: { ordemServicoId: a.os.id } }))).toBe(0);
    });
  });

  describe('oficinaId imutável no banco (trigger + ON UPDATE RESTRICT)', () => {
    it('UPDATE cru do oficinaId de um cliente falha', async () => {
      // sem tenant: teste da camada do banco (trigger), SQL cru não passa pela extensão
      await tenant.executarSemTenant(async () => {
        const a = await novaOficina('A');
        const b = await novaOficina('B');
        const cliente = await prisma.db.cliente.create({ data: { oficinaId: a.id, telefone: '+5543911114444' } });
        await expect(
          prisma.db.$executeRaw`UPDATE "Cliente" SET "oficinaId" = ${b.id} WHERE "id" = ${cliente.id}`,
        ).rejects.toThrow(/oficinaId é imutável/);
        const intacto = await prisma.db.cliente.findUnique({ where: { id: cliente.id } });
        expect(intacto?.oficinaId).toBe(a.id);
      });
    });

    it('trocar o id de uma oficina com dependentes falha (ON UPDATE RESTRICT)', async () => {
      // sem tenant: teste da camada do banco (FK), SQL cru não passa pela extensão
      await tenant.executarSemTenant(async () => {
        const a = await novaOficina('A');
        await prisma.db.cliente.create({ data: { oficinaId: a.id, telefone: '+5543911115555' } });
        await expect(prisma.db.$executeRaw`UPDATE "Oficina" SET "id" = ${`${a.id}-x`} WHERE "id" = ${a.id}`).rejects.toThrow();
        expect(await prisma.db.oficina.count({ where: { id: a.id } })).toBe(1);
      });
    });
  });

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
