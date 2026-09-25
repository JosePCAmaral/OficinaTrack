import { z } from 'zod';
import { PerfilUsuario } from '../enums.js';
import { emailSchema, senhaSchema, tokenSchema } from './auth.js';
import { telefoneSchema } from './comuns.js';

const telefoneOpcional = z.preprocess((v) => (v === '' ? undefined : v), telefoneSchema.optional());

export const conviteSchema = z.object({
  nome: z.string().trim().min(2, { error: 'Informe o nome' }).max(120),
  email: emailSchema,
  telefone: telefoneOpcional,
  perfil: PerfilUsuario.default('FUNCIONARIO'),
});
export type ConviteEntrada = z.input<typeof conviteSchema>;

export const aceitarConviteSchema = z.object({
  token: tokenSchema,
  senha: senhaSchema,
  nome: z.string().trim().min(2).max(120).optional(),
  telefone: telefoneOpcional,
});

export const alterarUsuarioSchema = z
  .object({ perfil: PerfilUsuario.optional(), ativo: z.boolean().optional() })
  .refine((d) => d.perfil !== undefined || d.ativo !== undefined, { error: 'Nada para alterar' });
