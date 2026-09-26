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

  describe('em produção', () => {
    const producao = { ...valido, NODE_ENV: 'production', JWT_SEGREDO: 'Zq3v8mN1x0Rk7TgS5wLpYb2HcJf4Ue9AoDi6Me1Pn8Qs', EMAIL_TRANSPORTE: 'smtp' };

    it('aceita segredo forte, FATOR_LIMITES=1 e SMTP', () => {
      expect(validarEnv(producao).NODE_ENV).toBe('production');
    });

    it.each([
      ['placeholder do .env.example', 'troque-por-um-segredo-gerado-com-pelo-menos-32-caracteres'],
      ['qualquer valor começando com troque', `troque-${'a'.repeat(50)}`],
      ['segredo dos testes', 'segredo-de-teste-com-mais-de-32-caracteres!!'],
      ['segredo do CI', 'segredo-de-ci-com-mais-de-32-caracteres-para-testes'],
      ['menos de 43 caracteres', 'a'.repeat(42)],
    ])('recusa JWT_SEGREDO: %s (sem ecoar o valor)', (_caso, segredo) => {
      expect(() => validarEnv({ ...producao, JWT_SEGREDO: segredo })).toThrow(/JWT_SEGREDO/);
      expect(() => validarEnv({ ...producao, JWT_SEGREDO: segredo })).not.toThrow(new RegExp(segredo.slice(0, 20)));
    });

    it('recusa FATOR_LIMITES diferente de 1 e EMAIL_TRANSPORTE=memoria', () => {
      expect(() => validarEnv({ ...producao, FATOR_LIMITES: '100' })).toThrow(/FATOR_LIMITES/);
      expect(() => validarEnv({ ...producao, EMAIL_TRANSPORTE: 'memoria' })).toThrow(/EMAIL_TRANSPORTE/);
    });

    it('fora de produção as mesmas variáveis continuam aceitas (dev e testes)', () => {
      expect(() => validarEnv({ ...valido, NODE_ENV: 'test', FATOR_LIMITES: '100', EMAIL_TRANSPORTE: 'memoria' })).not.toThrow();
    });
  });

  it('converte CADASTRO_EXIGE_CODIGO e SMTP_SEGURO de texto', () => {
    const env = validarEnv({ ...valido, CADASTRO_EXIGE_CODIGO: 'false', SMTP_SEGURO: 'true' });
    expect(env.CADASTRO_EXIGE_CODIGO).toBe(false);
    expect(env.SMTP_SEGURO).toBe(true);
  });
});
