/** Multiplicador dos limites de requisição (testes usam valor alto; produção usa 1). */
export function fatorLimites(): number {
  const fator = Number(process.env.FATOR_LIMITES ?? '1');
  return Number.isInteger(fator) && fator >= 1 ? fator : 1;
}

/** Para `@Throttle({ default: { limit: limite(5), ttl } })`: lido a cada requisição. */
export const limite = (base: number) => () => base * fatorLimites();
