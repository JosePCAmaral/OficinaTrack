import { randomBytes } from 'node:crypto';
import { Test, TestingModule } from '@nestjs/testing';
import { AppModule } from '../../src/app.module.js';
import { TenantContext } from '../../src/common/tenant/tenant-context.js';
import { PrismaService } from '../../src/prisma/prisma.service.js';

/**
 * Apoio dos testes de segurança. Cada teste cria as próprias oficinas e registros
 * (o banco de teste não é zerado entre execuções), então nenhuma asserção depende
 * de estado global.
 */
export const sufixo = () => randomBytes(6).toString('hex');
export const telefone = () => `+55439${String(Math.floor(Math.random() * 1e8)).padStart(8, '0')}`;
const LETRAS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
export const placa = () =>
  Array.from({ length: 3 }, () => LETRAS[Math.floor(Math.random() * 26)]).join('') +
  String(Math.floor(Math.random() * 1e4)).padStart(4, '0');

export type Ctx = { modulo: TestingModule; prisma: PrismaService; tenant: TenantContext };

export async function iniciar(): Promise<Ctx> {
  const modulo = await Test.createTestingModule({ imports: [AppModule] }).compile();
  return { modulo, prisma: modulo.get(PrismaService), tenant: modulo.get(TenantContext) };
}

/** Cria uma oficina com um usuário DONO, um cliente e um veículo, todos dela. */
export async function montarOficina({ prisma, tenant }: Ctx, nome: string) {
  // sem tenant: a oficina ainda não existe (mesmo caso do cadastro na Sprint 2)
  const oficina = await tenant.executarSemTenant(() =>
    prisma.db.oficina.create({
      data: { nome, telefone: telefone(), termosVersao: '2026-09', termosAceitosEm: new Date() },
    }),
  );
  return tenant.executarComo(oficina.id, async () => {
    const usuario = await prisma.db.usuario.create({
      data: {
        oficinaId: oficina.id,
        nome: `Dono ${nome}`,
        email: `dono-${sufixo()}@teste.local`,
        emailConfirmadoEm: new Date(),
        senhaHash: 'hash-de-teste-nao-e-senha',
        perfil: 'DONO',
      },
    });
    const cliente = await prisma.db.cliente.create({
      data: { oficinaId: oficina.id, nome: `Cliente ${nome}`, telefone: telefone(), observacoes: `interno ${nome}` },
    });
    const veiculo = await prisma.db.veiculo.create({
      data: { oficinaId: oficina.id, clienteId: cliente.id, placa: placa() },
    });
    return { oficina, usuario, cliente, veiculo };
  });
}

/** Leitura "da verdade" direto no banco, sem filtro de tenant (só para asserção). */
export function verdade<T>({ tenant }: Ctx, fn: () => Promise<T>): Promise<T> {
  return tenant.executarSemTenant(fn);
}
