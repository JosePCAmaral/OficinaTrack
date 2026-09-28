import { defineConfig } from 'vitest/config';
import tsconfigPaths from 'vite-tsconfig-paths';
import { ENV_TESTE } from './test/env-teste.js';

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    globals: true,
    root: './',
    include: ['test/**/*.e2e-spec.ts'],
    env: ENV_TESTE,
    globalSetup: ['./test/setup-global.ts'],
    // Postgres recém-subido + argon2 + 18 arquivos em paralelo estouram os 5 s padrão na partida a frio (CI).
    testTimeout: 30_000,
    hookTimeout: 60_000,
  },
});
