const formatoBRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

export function formatarCentavos(centavos: number): string {
  if (!Number.isInteger(centavos)) throw new TypeError('centavos deve ser inteiro');
  return formatoBRL.format(centavos / 100);
}

/**
 * Total de um item em centavos: round(quantidade × valorUnitario), meio para cima.
 * `quantidade` vem como texto decimal com até 3 casas (formato do Prisma Decimal),
 * e a conta é feita em inteiros para não ter erro de ponto flutuante.
 */
export function calcularTotalItemCentavos(quantidade: string, valorUnitarioCentavos: number): number {
  if (!/^\d+(\.\d{1,3})?$/.test(quantidade)) throw new TypeError('quantidade inválida');
  if (!Number.isInteger(valorUnitarioCentavos) || valorUnitarioCentavos < 0) {
    throw new TypeError('valorUnitarioCentavos deve ser inteiro não negativo');
  }
  const [inteira, fracao = ''] = quantidade.split('.');
  const milesimos = BigInt(`${inteira}${fracao.padEnd(3, '0')}`);
  const totalMilesimos = milesimos * BigInt(valorUnitarioCentavos);
  return Number((totalMilesimos + 500n) / 1000n);
}
