import type { Pagina, Paginacao } from '@oficinatrack/shared';

/** Monta `{ itens, proximoCursor }`: pede sempre `limite + 1` linhas para saber se há mais. */
export function paginar<T extends { id: string }>(linhas: T[], limite: number): Pagina<T> {
  const temMais = linhas.length > limite;
  const itens = temMais ? linhas.slice(0, limite) : linhas;
  return { itens, proximoCursor: temMais ? itens[itens.length - 1]!.id : null };
}

/**
 * Args do Prisma para uma consulta paginada por cursor (`findMany`). O `orderBy` da consulta
 * precisa terminar num campo único (ex.: `[{ criadoEm: 'desc' }, { id: 'desc' }]`): sem um
 * desempate único, linhas com o mesmo valor de ordenação podem pular a página ou repetir
 * quando o cursor não é a chave primária sozinha.
 */
export function argsPaginacao(p: Paginacao): { take: number; cursor?: { id: string }; skip?: number } {
  return { take: p.limite + 1, ...(p.cursor ? { cursor: { id: p.cursor }, skip: 1 } : {}) };
}
