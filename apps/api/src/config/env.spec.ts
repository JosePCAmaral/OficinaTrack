import { validarEnv } from './env.js';

const valido = {
  DATABASE_URL: 'postgresql://u:s@localhost:5432/db',
  CORS_ORIGEM: 'http://localhost:5173',
};

describe('validarEnv', () => {
  it('aplica padrões', () => {
    const env = validarEnv(valido);
    expect(env.PORT).toBe(3000);
    expect(env.NODE_ENV).toBe('development');
  });

  it('falha listando só os nomes das variáveis, sem os valores', () => {
    expect(() => validarEnv({ DATABASE_URL: 'segredo' })).toThrow(/CORS_ORIGEM/);
    expect(() => validarEnv({ DATABASE_URL: 'segredo' })).not.toThrow(/segredo/);
  });
});
