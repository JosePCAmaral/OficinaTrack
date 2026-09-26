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

/**
 * Segredos públicos (placeholder do `.env.example`, segredo dos testes e do CI): quem lê o
 * repositório forjaria tokens `{ sub, oficinaId, perfil }` (auditoria #4). Recusados em produção.
 */
const SEGREDOS_PUBLICOS = new Set([
  'troque-por-um-segredo-gerado-com-pelo-menos-32-caracteres',
  'segredo-de-teste-com-mais-de-32-caracteres!!',
  'segredo-de-ci-com-mais-de-32-caracteres-para-testes',
]);
/** 43 caracteres base64url ≈ 256 bits (o comando do `.env.example` gera 64). */
const MIN_SEGREDO_PRODUCAO = 43;

/**
 * Regras só de produção (`NODE_ENV=production`, que o deploy precisa definir: o padrão é
 * `development`). Um erro de variável não pode desligar um controle em silêncio (auditoria #4, #8).
 */
const envProducaoSchema = envSchema.superRefine((env, ctx) => {
  if (env.NODE_ENV !== 'production') return;
  const segredo = env.JWT_SEGREDO;
  if (SEGREDOS_PUBLICOS.has(segredo) || segredo.startsWith('troque') || segredo.length < MIN_SEGREDO_PRODUCAO) {
    ctx.addIssue({ code: 'custom', path: ['JWT_SEGREDO'], message: 'segredo público ou curto em produção' });
  }
  if (env.FATOR_LIMITES !== 1) ctx.addIssue({ code: 'custom', path: ['FATOR_LIMITES'], message: 'precisa ser 1 em produção' });
  if (env.EMAIL_TRANSPORTE !== 'smtp') ctx.addIssue({ code: 'custom', path: ['EMAIL_TRANSPORTE'], message: 'precisa ser smtp em produção' });
});

export type Env = z.infer<typeof envSchema>;

/** Falha listando só os nomes das variáveis, nunca os valores (podem ser segredos). */
export function validarEnv(config: Record<string, unknown>): Env {
  const resultado = envProducaoSchema.safeParse(config);
  if (!resultado.success) {
    const nomes = resultado.error.issues.map((i) => i.path.join('.')).join(', ');
    throw new Error(`Variáveis de ambiente inválidas: ${nomes}`);
  }
  return resultado.data;
}
