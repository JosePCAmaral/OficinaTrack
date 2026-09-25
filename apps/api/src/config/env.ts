import { z } from 'zod';

const booleanoTexto = (padrao: boolean) =>
  z
    .enum(['true', 'false'])
    .default(padrao ? 'true' : 'false')
    .transform((v) => v === 'true');

// Variáveis opcionais não definidas no .env chegam como string vazia (dotenv), não como undefined.
const opcional = () =>
  z
    .string()
    .optional()
    .transform((v) => (v === '' ? undefined : v));

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3333),
  DATABASE_URL: z.string().min(1),
  CORS_ORIGEM: z.url(),
  JWT_SEGREDO: z.string().min(32),
  EMAIL_TRANSPORTE: z.enum(['smtp', 'memoria']).default('smtp'),
  SMTP_HOST: z.string().min(1).default('localhost'),
  SMTP_PORTA: z.coerce.number().int().positive().default(1025),
  SMTP_USUARIO: opcional(),
  SMTP_SENHA: opcional(),
  SMTP_SEGURO: booleanoTexto(false),
  EMAIL_REMETENTE: z.string().min(1).default('OficinaTrack <nao-responda@oficinatrack.local>'),
  URL_APP: z.url(),
  CADASTRO_EXIGE_CODIGO: booleanoTexto(true),
  FATOR_LIMITES: z.coerce.number().int().min(1).default(1),
});

export type Env = z.infer<typeof envSchema>;

export function validarEnv(config: Record<string, unknown>): Env {
  const resultado = envSchema.safeParse(config);
  if (!resultado.success) {
    const nomes = resultado.error.issues.map((i) => i.path.join('.')).join(', ');
    throw new Error(`Variáveis de ambiente inválidas: ${nomes}`);
  }
  return resultado.data;
}
