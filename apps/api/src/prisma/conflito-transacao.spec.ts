import { Prisma } from '../generated/prisma/client.js';
import { ehConflitoDeTransacao } from './conflito-transacao.js';

const erroAdapter = (cause: Record<string, unknown>) => Object.assign(new Error('TransactionWriteConflict'), { name: 'DriverAdapterError', cause });

describe('ehConflitoDeTransacao', () => {
  it('reconhece P2034 e o DriverAdapterError de 40001 (conflito no COMMIT)', () => {
    expect(ehConflitoDeTransacao(new Prisma.PrismaClientKnownRequestError('x', { code: 'P2034', clientVersion: '7.10.0' }))).toBe(true);
    expect(ehConflitoDeTransacao(erroAdapter({ kind: 'TransactionWriteConflict' }))).toBe(true);
    expect(ehConflitoDeTransacao(erroAdapter({ originalCode: '40001' }))).toBe(true);
  });

  it('não confunde com outros erros', () => {
    expect(ehConflitoDeTransacao(new Prisma.PrismaClientKnownRequestError('x', { code: 'P2002', clientVersion: '7.10.0' }))).toBe(false);
    expect(ehConflitoDeTransacao(erroAdapter({ kind: 'UniqueConstraintViolation', originalCode: '23505' }))).toBe(false);
    expect(ehConflitoDeTransacao(new Error('qualquer'))).toBe(false);
    expect(ehConflitoDeTransacao('texto')).toBe(false);
  });
});
