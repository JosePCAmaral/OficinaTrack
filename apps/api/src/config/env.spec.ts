import { validarEnv } from './env.js';

const valido = {
  DATABASE_URL: 'postgresql://u:s@localhost:5432/db',
  CORS_ORIGEM: 'http://localhost:5173',
  JWT_SEGREDO: 'x'.repeat(32),
  URL_APP: 'http://localhost:5173',
};

describe('validarEnv', () => {
  it('aplica padrões', () => {
    const env = validarEnv(valido);
    expect(env.PORT).toBe(3333);
    expect(env.NODE_ENV).toBe('development');
  });

  it('falha listando só os nomes das variáveis, sem os valores', () => {
    expect(() => validarEnv({ DATABASE_URL: 'segredo' })).toThrow(/CORS_ORIGEM/);
    expect(() => validarEnv({ DATABASE_URL: 'segredo' })).not.toThrow(/segredo/);
  });

  it('exige JWT_SEGREDO com pelo menos 32 caracteres', () => {
    expect(() => validarEnv({ ...valido, JWT_SEGREDO: 'curto' })).toThrow(/JWT_SEGREDO/);
  });

  it('converte CADASTRO_EXIGE_CODIGO e SMTP_SEGURO de texto', () => {
    const env = validarEnv({ ...valido, CADASTRO_EXIGE_CODIGO: 'false', SMTP_SEGURO: 'true' });
    expect(env.CADASTRO_EXIGE_CODIGO).toBe(false);
    expect(env.SMTP_SEGURO).toBe(true);
  });
});
