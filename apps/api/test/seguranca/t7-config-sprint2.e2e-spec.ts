import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { validarEnv } from '../../src/config/env.js';

/**
 * Auditoria Sprint 2 (docs/auditorias/2026-09-26-sprint-2.md): T7, configuração perigosa aceita em produção.
 * Não imprime segredo real: lê só o valor de exemplo do `.env.example`, que é público no repositório.
 */
const exemplo = readFileSync(fileURLToPath(new URL('../../.env.example', import.meta.url)), 'utf8');
const valorExemplo = (nome: string) => new RegExp(`^${nome}=(.*)$`, 'm').exec(exemplo)?.[1]?.trim() ?? '';

const envProducao = (extra: Record<string, string> = {}) => ({
  NODE_ENV: 'production',
  DATABASE_URL: 'postgresql://app:x@db:5432/oficinatrack',
  CORS_ORIGEM: 'https://app.oficinatrack.com.br',
  URL_APP: 'https://app.oficinatrack.com.br',
  JWT_SEGREDO: 'Zq3v8mN1x0Rk7TgS5wLpYb2HcJf4Ue9AoDi6Me1Pn8Qs',
  EMAIL_TRANSPORTE: 'smtp',
  ...extra,
});

describe('T7: configuração de produção (auditoria Sprint 2)', () => {
  it('controle: o ambiente de produção de referência é aceito', () => {
    expect(() => validarEnv(envProducao())).not.toThrow();
  });

  it('[achado #4, FALHA HOJE] recusa em produção o JWT_SEGREDO de exemplo do .env.example', () => {
    const segredoExemplo = valorExemplo('JWT_SEGREDO');
    expect(segredoExemplo.length).toBeGreaterThanOrEqual(32); // por isso passa no .min(32)
    // com o segredo público, qualquer um forja { sub, oficinaId, perfil } e entra em qualquer oficina
    expect(() => validarEnv(envProducao({ JWT_SEGREDO: segredoExemplo }))).toThrow();
  });

  it('[achado #8, FALHA HOJE] recusa em produção FATOR_LIMITES > 1 e EMAIL_TRANSPORTE=memoria', () => {
    expect(() => validarEnv(envProducao({ FATOR_LIMITES: '100' }))).toThrow();
    expect(() => validarEnv(envProducao({ EMAIL_TRANSPORTE: 'memoria' }))).toThrow();
  });
});
