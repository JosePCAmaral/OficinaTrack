import { z } from 'zod';
import { emailSchema } from './auth.js';
import { placaSchema, telefoneSchema } from './comuns.js';
import { documentoSchema, inteiroAnulavel, textoAnulavel } from './oficina.js';

const vazioNull = <T extends z.ZodType>(s: T) => z.preprocess((v) => (v === '' ? null : v), s.nullable().optional());
const peloMenosUm = (d: Record<string, unknown>) => Object.values(d).some((v) => v !== undefined);

export const alterarClienteSchema = z
  .object({
    nome: textoAnulavel(120),
    telefone: telefoneSchema.optional(),
    email: vazioNull(emailSchema),
    documento: vazioNull(documentoSchema),
    observacoes: textoAnulavel(2000),
  })
  .refine(peloMenosUm, { error: 'Nada para alterar' });
export type AlterarCliente = z.output<typeof alterarClienteSchema>;

const anoMaximo = () => new Date().getFullYear() + 1;
export const alterarVeiculoSchema = z
  .object({
    placa: placaSchema.optional(),
    marca: textoAnulavel(60),
    modelo: textoAnulavel(60),
    cor: textoAnulavel(40),
    chassi: textoAnulavel(30),
    anoModelo: inteiroAnulavel(1950, anoMaximo()),
    kmAtual: inteiroAnulavel(0, 2_000_000),
  })
  .refine(peloMenosUm, { error: 'Nada para alterar' });
export type AlterarVeiculo = z.output<typeof alterarVeiculoSchema>;

export const buscaSchema = z.object({ q: z.string().trim().min(2, { error: 'Digite pelo menos 2 caracteres' }).max(100) });
export const consultaPlacaSchema = z.object({ placa: placaSchema });
