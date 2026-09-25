const PLACA_ANTIGA = /^[A-Z]{3}\d{4}$/;
const PLACA_MERCOSUL = /^[A-Z]{3}\d[A-Z]\d{2}$/;

/** Maiúsculas, sem separadores. `null` se não for placa antiga nem Mercosul. */
export function normalizarPlaca(entrada: string): string | null {
  const placa = entrada.toUpperCase().replace(/[\s-]/g, '');
  return PLACA_ANTIGA.test(placa) || PLACA_MERCOSUL.test(placa) ? placa : null;
}

/** Para exibição: `ABC-1234` (antiga) ou `ABC1D23` (Mercosul). */
export function formatarPlaca(placa: string): string {
  return PLACA_ANTIGA.test(placa) ? `${placa.slice(0, 3)}-${placa.slice(3)}` : placa;
}
