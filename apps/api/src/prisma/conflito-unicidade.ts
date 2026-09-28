import { Prisma } from '../generated/prisma/client.js';

/**
 * Nome do índice único violado num `P2002`. Com o driver adapter (`@prisma/adapter-pg`), o
 * Prisma entrega o detalhe da constraint dentro de `meta.driverAdapterError.cause.constraint.index`
 * (ex.: `"Cliente_oficinaId_telefone_key"`), não em `meta.target` (formato de outros drivers,
 * mantido aqui como reserva por segurança).
 */
function indiceDoConflito(erro: Prisma.PrismaClientKnownRequestError): string {
  const meta = erro.meta as
    | { target?: unknown; driverAdapterError?: { cause?: { constraint?: { index?: unknown } } } }
    | undefined;
  const doAdapter = meta?.driverAdapterError?.cause?.constraint?.index;
  if (typeof doAdapter === 'string') return doAdapter;
  if (typeof meta?.target === 'string') return meta.target;
  if (Array.isArray(meta?.target)) return meta.target.join('_');
  return '';
}

/**
 * Se um `P2002` veio da constraint única que envolve este campo (ex.: `"telefone"`, `"placa"`).
 * Usado para só mapear o erro de negócio certo (`TELEFONE_JA_CADASTRADO`/`PLACA_JA_CADASTRADA`)
 * quando é mesmo aquele campo que colidiu — qualquer outra violação única sobe sem tradução.
 */
export function conflitoEnvolveCampo(erro: unknown, campo: string): boolean {
  if (!(erro instanceof Prisma.PrismaClientKnownRequestError) || erro.code !== 'P2002') return false;
  return indiceDoConflito(erro).includes(campo);
}
