import { z } from 'zod';

export const paginacaoSchema = z.object({
  cursor: z.string().min(1).max(40).optional(),
  limite: z.coerce.number().int().min(1).max(50).default(20),
});
export type Paginacao = z.output<typeof paginacaoSchema>;
export type Pagina<T> = { itens: T[]; proximoCursor: string | null };
