import type { TenantContext } from '../src/common/tenant/tenant-context.js';
import type { PrismaService } from '../src/prisma/prisma.service.js';

const telefoneUnico = () => `+55439${String(Math.floor(Math.random() * 1e8)).padStart(8, '0')}`;

export function criarOficina(prisma: PrismaService, tenant: TenantContext, nome = 'Oficina Teste') {
  // sem tenant: a oficina ainda não existe (mesmo caso do cadastro na Sprint 2)
  return tenant.executarSemTenant(() =>
    prisma.db.oficina.create({
      data: { nome, telefone: telefoneUnico(), termosVersao: '2026-09', termosAceitosEm: new Date() },
    }),
  );
}

export function criarCliente(prisma: PrismaService, tenant: TenantContext, oficinaId: string, nome = 'Cliente Teste') {
  return tenant.executarComo(oficinaId, () =>
    prisma.db.cliente.create({ data: { oficinaId, nome, telefone: telefoneUnico() } }),
  );
}
