export const ENV_TESTE = {
  NODE_ENV: 'test',
  DATABASE_URL:
    process.env.DATABASE_URL_TEST ??
    'postgresql://oficinatrack:oficinatrack@localhost:5432/oficinatrack_test',
  CORS_ORIGEM: 'http://localhost:5173',
};
