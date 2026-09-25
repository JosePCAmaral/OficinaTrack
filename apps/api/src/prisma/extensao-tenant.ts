import { Prisma } from '../generated/prisma/client.js';
import { TenantAusenteError, TenantContext, TenantViolacaoError } from '../common/tenant/tenant-context.js';
import { MODELOS_COM_TENANT } from './modelos-tenant.js';
import { CRIACAO_ANINHADA_PERMITIDA, RELACOES_TENANT } from './relacoes-tenant.js';

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

const CRIACAO_ANINHADA = new Set(['create', 'createMany']);

function comoLista(valor: unknown): unknown[] {
  return Array.isArray(valor) ? valor : [valor];
}

/**
 * Recusa escrita por relação em `data` (achado #1 da auditoria). Relações são reconhecidas
 * pelo NOME do campo (`RELACOES_TENANT`), nunca pelo formato do valor (há campos Json).
 * - chave `oficina` → sempre recusada;
 * - `create`/`createMany` aninhado → só em filho com FK composta, e recursivo;
 * - qualquer outro operador (`connect`, `set`, `disconnect`, `update`, `delete`...) → recusado.
 * Services gravam FKs escalares (`clienteId`, `responsavelId: null`), que a FK composta valida.
 */
function validarEscritaAninhada(modelo: string, data: unknown, oficinaId: string, operacao: string): void {
  if (data === null || typeof data !== 'object') return;
  const relacoes = RELACOES_TENANT[modelo];
  if (!relacoes) throw new TenantViolacaoError(modelo, operacao);
  const permitidas = CRIACAO_ANINHADA_PERMITIDA[modelo];
  for (const [chave, valor] of Object.entries(data as Args)) {
    const alvo = relacoes[chave];
    if (!alvo) continue;
    const local = `${modelo}.${chave}`;
    if (chave === 'oficina' || !permitidas?.has(chave)) throw new TenantViolacaoError(local, operacao);
    if (valor === null || typeof valor !== 'object' || Array.isArray(valor)) throw new TenantViolacaoError(local, operacao);
    for (const [operador, filhos] of Object.entries(valor as Args)) {
      if (!CRIACAO_ANINHADA.has(operador)) throw new TenantViolacaoError(local, `${operacao}.${operador}`);
      const lista = operador === 'createMany' ? comoLista((filhos as Args | null)?.data) : comoLista(filhos);
      for (const filho of lista) validarDadosFilho(alvo, filho, oficinaId, `${operacao}.${operador}`);
    }
  }
}

function validarDadosFilho(modelo: string, data: unknown, oficinaId: string, operacao: string): void {
  if (data === null || typeof data !== 'object' || Array.isArray(data)) throw new TenantViolacaoError(modelo, operacao);
  semTrocaDeOficina(data, 'oficinaId', oficinaId, modelo, operacao);
  validarEscritaAninhada(modelo, data, oficinaId, operacao);
}

function validarDados(modelo: string, data: unknown, oficinaId: string, operacao: string): void {
  for (const item of comoLista(data)) validarEscritaAninhada(modelo, item, oficinaId, operacao);
}

export function aplicarTenant(modelo: string, campo: CampoTenant, operacao: string, args: Args, oficinaId: string): Args {
  if (LEITURA_OU_FILTRO.has(operacao)) {
    return { ...args, where: comFiltro(args.where, campo, oficinaId) };
  }
  if (ATUALIZACAO.has(operacao)) {
    semTrocaDeOficina(args.data, campo, oficinaId, modelo, operacao);
    validarDados(modelo, args.data, oficinaId, operacao);
    return { ...args, where: comFiltro(args.where, campo, oficinaId) };
  }
  if (CRIACAO.has(operacao)) {
    validarDados(modelo, args.data, oficinaId, operacao);
    const data = Array.isArray(args.data)
      ? args.data.map((d) => comOficina(d, campo, oficinaId))
      : comOficina(args.data, campo, oficinaId);
    return { ...args, data };
  }
  if (operacao === 'upsert') {
    semTrocaDeOficina(args.update, campo, oficinaId, modelo, operacao);
    validarDados(modelo, args.create, oficinaId, 'upsert.create');
    validarDados(modelo, args.update, oficinaId, 'upsert.update');
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
