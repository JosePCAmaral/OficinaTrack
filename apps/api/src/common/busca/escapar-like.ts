/**
 * Escapa `\`, `%` e `_` para o termo virar texto literal num `contains`/`startsWith`/`endsWith`
 * do Prisma (que monta um LIKE/ILIKE com `\` como caractere de escape padrão do Postgres).
 * A barra vem primeiro para não escapar de novo as barras inseridas pelos curingas.
 */
export function escaparLike(termo: string): string {
  return termo.replace(/[\\%_]/g, (c) => `\\${c}`);
}
