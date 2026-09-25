import { z } from 'zod';
import { normalizarPlaca } from '../placa.js';
import { normalizarTelefone } from '../telefone.js';

export const placaSchema = z.string().transform((valor, ctx) => {
  const placa = normalizarPlaca(valor);
  if (!placa) {
    ctx.addIssue({ code: 'custom', message: 'Placa inválida' });
    return z.NEVER;
  }
  return placa;
});

export const telefoneSchema = z.string().transform((valor, ctx) => {
  const telefone = normalizarTelefone(valor);
  if (!telefone) {
    ctx.addIssue({ code: 'custom', message: 'Telefone inválido' });
    return z.NEVER;
  }
  return telefone;
});
