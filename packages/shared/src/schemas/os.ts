import { z } from 'zod';
import { placaSchema, telefoneSchema } from './comuns.js';
import { paginacaoSchema } from './paginacao.js';
import { inteiroAnulavel, inteiroOpcional, textoAnulavel, textoOpcional } from './oficina.js';

const KM_MAX = 2_000_000;
const dataOpcional = z.preprocess((v) => (v === '' ? undefined : v), z.iso.date({ error: 'Data inválida' }).optional());
const dataAnulavel = z.preprocess((v) => (v === '' ? null : v), z.iso.date({ error: 'Data inválida' }).nullable().optional());
const idOpcional = z.preprocess((v) => (v === '' ? undefined : v), z.string().min(1).max(40).optional());

export const abrirOsSchema = z.object({
  placa: placaSchema,
  telefone: telefoneSchema,
  relatoCliente: z.string().trim().min(3, { error: 'Descreva a queixa do cliente' }).max(1000),
  nomeCliente: textoOpcional(120),
  kmEntrada: inteiroOpcional(0, KM_MAX),
  responsavelId: idOpcional,
  previsaoEntrega: dataOpcional,
  transferirVeiculo: z.boolean().optional(),
  criarMesmoComOsAberta: z.boolean().optional(),
});
export type AbrirOs = z.output<typeof abrirOsSchema>;
export type AbrirOsEntrada = z.input<typeof abrirOsSchema>;

export const alterarOsSchema = z
  .object({
    relatoCliente: z.string().trim().min(3).max(1000).optional(),
    diagnostico: textoAnulavel(2000),
    kmEntrada: inteiroAnulavel(0, KM_MAX),
    responsavelId: z.preprocess((v) => (v === '' ? null : v), z.string().min(1).max(40).nullable().optional()),
    previsaoEntrega: dataAnulavel,
  })
  .refine((d) => Object.values(d).some((v) => v !== undefined), { error: 'Nada para alterar' });
export type AlterarOs = z.output<typeof alterarOsSchema>;
export type AlterarOsEntrada = z.input<typeof alterarOsSchema>;

export const TIPOS_EVENTO_PUBLICAVEIS = ['NOTA_INTERNA', 'ATUALIZACAO_CLIENTE'] as const;
export const novoEventoSchema = z.object({
  tipo: z.enum(TIPOS_EVENTO_PUBLICAVEIS),
  texto: z.string().trim().min(1, { error: 'Escreva alguma coisa' }).max(2000),
});
export type NovoEvento = z.output<typeof novoEventoSchema>;

/** `GET /ordens-servico`: nesta sprint só existe a situação "abertas" (status fora de ENTREGUE/CANCELADO). */
export const listarOsSchema = paginacaoSchema.extend({
  situacao: z.enum(['abertas']).default('abertas'),
});
export type ListarOs = z.output<typeof listarOsSchema>;
