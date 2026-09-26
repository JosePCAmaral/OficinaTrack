import { Prisma } from '../generated/prisma/client.js';

/**
 * Falha de serialização do Postgres (SQLSTATE 40001) numa transação `Serializable`. O Prisma a
 * entrega como `P2034` quando acontece numa consulta, mas, com o driver adapter (`@prisma/adapter-pg`),
 * a que acontece no COMMIT chega crua como `DriverAdapterError` (`TransactionWriteConflict`).
 */
export function ehConflitoDeTransacao(erro: unknown): boolean {
  if (erro instanceof Prisma.PrismaClientKnownRequestError) return erro.code === 'P2034';
  if (!(erro instanceof Error) || erro.name !== 'DriverAdapterError') return false;
  const causa = (erro as { cause?: { kind?: unknown; originalCode?: unknown } }).cause;
  return causa?.kind === 'TransactionWriteConflict' || causa?.originalCode === '40001';
}
