/**
 * Normaliza telefone brasileiro para E.164 (`+55DDNNNNNNNNN`).
 * Aceita máscara, DDI 55, zero de discagem e celular antigo de 8 dígitos.
 * Número estrangeiro retorna `null` (fora do MVP).
 */
export function normalizarTelefone(entrada: string): string | null {
  const texto = entrada.trim();
  let digitos = texto.replace(/\D/g, '');
  if (texto.startsWith('+') && !digitos.startsWith('55')) return null;

  digitos = digitos.replace(/^0+/, '');
  if ((digitos.length === 12 || digitos.length === 13) && digitos.startsWith('55')) {
    digitos = digitos.slice(2);
  }
  if (digitos.length !== 10 && digitos.length !== 11) return null;

  const ddd = digitos.slice(0, 2);
  if (ddd[0] === '0' || ddd[1] === '0') return null;

  let numero = digitos.slice(2);
  if (numero.length === 8 && /^[6-9]/.test(numero)) numero = `9${numero}`;
  if (numero.length === 9 && !numero.startsWith('9')) return null;
  if (numero.length === 8 && !/^[2-5]/.test(numero)) return null;

  return `+55${ddd}${numero}`;
}
