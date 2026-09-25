import { execSync } from 'node:child_process';
import { ENV_TESTE } from './env-teste.js';

/**
 * Aplica as migrações pendentes no banco de teste, uma vez por execução.
 * Não usamos `migrate reset` (destrutivo): os testes não dependem de banco vazio,
 * cada teste cria as próprias oficinas/registros e não assume estado inicial.
 */
export default function setup(): void {
  execSync('pnpm exec prisma migrate deploy', {
    stdio: 'inherit',
    env: { ...process.env, DATABASE_URL: ENV_TESTE.DATABASE_URL },
  });
}
