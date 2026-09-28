import { normalizarPlaca, normalizarTelefone } from '@oficinatrack/shared';

export type TermoClassificado = { tipo: 'placa'; valor: string } | { tipo: 'telefone'; valor: string } | { tipo: 'nome'; valor: string };

/** Classifica o termo: placa válida → placa; telefone válido → telefone; senão → nome por trecho. */
export function classificarTermo(termo: string): TermoClassificado {
  const placa = normalizarPlaca(termo);
  if (placa) return { tipo: 'placa', valor: placa };
  const telefone = normalizarTelefone(termo);
  if (telefone) return { tipo: 'telefone', valor: telefone };
  return { tipo: 'nome', valor: termo.trim() };
}

/** Placa parcial: só letras/números, 3 a 7 caracteres (útil mesmo quando não fecha uma placa válida). */
export function placaParcial(termo: string): string | null {
  const bruto = termo.trim();
  if (!/^[A-Za-z0-9]{3,7}$/.test(bruto)) return null;
  return bruto.toUpperCase().replace(/[^A-Z0-9]/g, '');
}
