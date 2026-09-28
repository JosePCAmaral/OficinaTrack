import { Prisma } from '../generated/prisma/client.js';
import { conflitoEnvolveCampo } from './conflito-unicidade.js';

const p2002 = (meta: Record<string, unknown>) => new Prisma.PrismaClientKnownRequestError('x', { code: 'P2002', clientVersion: '7.10.0', meta });

describe('conflitoEnvolveCampo', () => {
  it('reconhece o formato do driver adapter (@prisma/adapter-pg)', () => {
    const erro = p2002({ driverAdapterError: { cause: { constraint: { index: 'Cliente_oficinaId_telefone_key' } } } });
    expect(conflitoEnvolveCampo(erro, 'telefone')).toBe(true);
    expect(conflitoEnvolveCampo(erro, 'placa')).toBe(false);
  });

  it('reconhece o formato target (outros drivers), string ou array', () => {
    expect(conflitoEnvolveCampo(p2002({ target: 'Veiculo_oficinaId_placa_key' }), 'placa')).toBe(true);
    expect(conflitoEnvolveCampo(p2002({ target: ['oficinaId', 'placa'] }), 'placa')).toBe(true);
  });

  it('não mapeia quando a constraint é de outro campo', () => {
    const erro = p2002({ driverAdapterError: { cause: { constraint: { index: 'Veiculo_oficinaId_placa_key' } } } });
    expect(conflitoEnvolveCampo(erro, 'telefone')).toBe(false);
  });

  it('não confunde com outros códigos de erro', () => {
    expect(conflitoEnvolveCampo(new Prisma.PrismaClientKnownRequestError('x', { code: 'P2025', clientVersion: '7.10.0' }), 'telefone')).toBe(false);
    expect(conflitoEnvolveCampo(new Error('qualquer'), 'telefone')).toBe(false);
    expect(conflitoEnvolveCampo('texto', 'telefone')).toBe(false);
  });
});
