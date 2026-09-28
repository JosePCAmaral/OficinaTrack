import { z } from 'zod';
import { telefoneSchema } from './comuns.js';

export const UFS = [
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG', 'PA',
  'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO',
] as const;
export const ufSchema = z.enum(UFS, { error: 'UF inválida' });

/** Texto opcional: string vazia (campo de formulário em branco) vira `undefined`. */
export const textoOpcional = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((v) => (v ? v : undefined));

const vazioVira = <T>(valor: T) => (v: unknown) => (v === '' ? valor : v);

/** Para PATCH: '' limpa o campo (null); ausente não mexe. */
export const textoAnulavel = (max: number) =>
  z.preprocess(vazioVira(null), z.string().trim().max(max).nullable().optional());

const paraNumero = (v: unknown) => (typeof v === 'string' ? Number(v) : v);
export const inteiroOpcional = (min: number, max: number) =>
  z.preprocess((v) => (v === '' || v === null ? undefined : paraNumero(v)), z.number().int().min(min).max(max).optional());
export const inteiroAnulavel = (min: number, max: number) =>
  z.preprocess((v) => (v === '' ? null : paraNumero(v)), z.number().int().min(min).max(max).nullable().optional());

export const documentoSchema = z
  .string()
  .max(20)
  .transform((v) => v.replace(/\D/g, ''))
  .refine((v) => v.length === 11 || v.length === 14, { error: 'CPF ou CNPJ inválido' });

export const oficinaDadosSchema = z.object({
  nome: z.string().trim().min(2, { error: 'Informe o nome da oficina' }).max(120),
  telefone: telefoneSchema,
  endereco: textoOpcional(200),
  cidade: textoOpcional(80),
  uf: z.preprocess((v) => (v === '' ? undefined : v), ufSchema.optional()),
  documento: z.preprocess((v) => (v === '' ? undefined : v), documentoSchema.optional()),
});
export type DadosOficinaEntrada = z.input<typeof oficinaDadosSchema>;
export type DadosOficinaValidos = z.output<typeof oficinaDadosSchema>;
