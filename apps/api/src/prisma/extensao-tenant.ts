import { Prisma } from '../generated/prisma/client.js';
import { TenantAusenteError, TenantContext, TenantViolacaoError } from '../common/tenant/tenant-context.js';
import { MODELOS_COM_TENANT } from './modelos-tenant.js';

type Args = Record<string, unknown>;
type CampoTenant = 'oficinaId' | 'id';

const LEITURA_OU_FILTRO = new Set([
  'findUnique',
  'findUniqueOrThrow',
  'findFirst',
  'findFirstOrThrow',
  'findMany',
  'count',
  'aggregate',
  'groupBy',
  'delete',
  'deleteMany',
]);
const ATUALIZACAO = new Set(['update', 'updateMany', 'updateManyAndReturn']);
const CRIACAO = new Set(['create', 'createMany', 'createManyAndReturn']);

function campoTenant(modelo: string): CampoTenant | null {
  if (modelo === 'Oficina') return 'id';
  return MODELOS_COM_TENANT.has(modelo) ? 'oficinaId' : null;
}

function comFiltro(where: unknown, campo: CampoTenant, oficinaId: string): Args {
  const original = (where ?? {}) as Args;
  const and = original.AND === undefined ? [] : Array.isArray(original.AND) ? original.AND : [original.AND];
  return { ...original, AND: [...and, { [campo]: oficinaId }] };
}

function comOficina(data: unknown, campo: CampoTenant, oficinaId: string): Args {
  return { ...(data as Args), [campo]: oficinaId };
}

function semTrocaDeOficina(data: unknown, campo: CampoTenant, oficinaId: string, modelo: string, operacao: string): void {
  const valor = (data as Args | undefined)?.[campo];
  if (valor !== undefined && valor !== oficinaId) throw new TenantViolacaoError(modelo, operacao);
}

export function aplicarTenant(modelo: string, campo: CampoTenant, operacao: string, args: Args, oficinaId: string): Args {
  if (LEITURA_OU_FILTRO.has(operacao)) {
    return { ...args, where: comFiltro(args.where, campo, oficinaId) };
  }
  if (ATUALIZACAO.has(operacao)) {
    semTrocaDeOficina(args.data, campo, oficinaId, modelo, operacao);
    return { ...args, where: comFiltro(args.where, campo, oficinaId) };
  }
  if (CRIACAO.has(operacao)) {
    const data = Array.isArray(args.data)
      ? args.data.map((d) => comOficina(d, campo, oficinaId))
      : comOficina(args.data, campo, oficinaId);
    return { ...args, data };
  }
  if (operacao === 'upsert') {
    semTrocaDeOficina(args.update, campo, oficinaId, modelo, operacao);
    return {
      ...args,
      where: comFiltro(args.where, campo, oficinaId),
      create: comOficina(args.create, campo, oficinaId),
    };
  }
  throw new Error(`Operação ${modelo}.${operacao} não suportada pela extensão de tenant`);
}

export function extensaoTenant(tenant: TenantContext) {
  return Prisma.defineExtension({
    name: 'tenant',
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }) {
          const campo = campoTenant(model);
          if (!campo || tenant.ignorandoTenant()) return query(args);
          const oficinaId = tenant.oficinaId();
          if (!oficinaId) throw new TenantAusenteError(model, operation);
          return query(aplicarTenant(model, campo, operation, (args ?? {}) as Args, oficinaId) as typeof args);
        },
      },
    },
  });
}
