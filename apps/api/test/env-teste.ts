export const ENV_TESTE = {
  NODE_ENV: 'test',
  DATABASE_URL:
    process.env.DATABASE_URL_TEST ??
    'postgresql://oficinatrack:oficinatrack@localhost:5432/oficinatrack_test',
  CORS_ORIGEM: 'http://localhost:5173',
  JWT_SEGREDO: 'segredo-de-teste-com-mais-de-32-caracteres!!',
  EMAIL_TRANSPORTE: 'memoria',
  URL_APP: 'http://localhost:5173',
  CADASTRO_EXIGE_CODIGO: 'true',
  FATOR_LIMITES: '100',
};
