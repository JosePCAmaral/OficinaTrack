import { z } from 'zod';
import { normalizarEmail } from '../email.js';
import { SENHAS_COMUNS } from '../senhas-comuns.js';
import { telefoneOpcionalSchema } from './comuns.js';
import { oficinaDadosSchema } from './oficina.js';

export const VERSAO_TERMOS = '2026-09';

export const emailSchema = z
  .string()
  .max(254, { error: 'E-mail muito longo' })
  .transform(normalizarEmail)
  .pipe(z.email({ error: 'E-mail inválido' }));

export const senhaSchema = z
  .string()
  .min(8, { error: 'A senha precisa ter pelo menos 8 caracteres' })
  .max(128, { error: 'A senha pode ter no máximo 128 caracteres' })
  .refine((s) => !SENHAS_COMUNS.has(s.toLowerCase()), { error: 'Essa senha é muito comum. Escolha outra' });

export const identificadorSchema = z.string().trim().min(1, { error: 'Informe e-mail ou telefone' }).max(254);
export const tokenSchema = z.string().min(20).max(100);

export const cadastroSchema = z.object({
  codigoPiloto: z.string().trim().max(20).optional(),
  oficina: oficinaDadosSchema,
  dono: z.object({
    nome: z.string().trim().min(2, { error: 'Informe seu nome' }).max(120),
    email: emailSchema,
    /** WhatsApp do dono (opcional): permite entrar pelo telefone. */
    telefone: telefoneOpcionalSchema,
    senha: senhaSchema,
  }),
  aceiteTermos: z.literal(true, { error: 'É preciso aceitar os termos de uso' }),
});
export type Cadastro = z.output<typeof cadastroSchema>;

export const loginSchema = z.object({
  identificador: identificadorSchema,
  senha: z.string().min(1, { error: 'Informe a senha' }).max(128),
});
export type Login = z.output<typeof loginSchema>;

export const emailApenasSchema = z.object({ email: emailSchema });
export const tokenApenasSchema = z.object({ token: tokenSchema });
export const redefinirSenhaSchema = z.object({ token: tokenSchema, senha: senhaSchema });

export const trocarSenhaSchema = z
  .object({ senhaAtual: z.string().min(1).max(128), novaSenha: senhaSchema })
  .refine((d) => d.senhaAtual !== d.novaSenha, { error: 'A nova senha precisa ser diferente da atual', path: ['novaSenha'] });
