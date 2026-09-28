import { randomInt } from 'node:crypto';

let contador = 0;

/**
 * Celular BR válido (`+554399…`) para os apoios de teste. O banco de teste nunca é zerado,
 * então um gerador só com `Math.random()` colide de vez em quando (achado de flakiness):
 * este mistura o relógio (muda a cada milissegundo), um contador local ao processo
 * (evita colisão entre chamadas na mesma milissegundo) e um dígito aleatório
 * (evita colisão entre processos de teste em paralelo).
 */
export function telefoneTeste(): string {
  contador += 1;
  const semente = Date.now() * 1000 + (contador % 1000);
  const tempo = String(semente % 1_000_000).padStart(6, '0');
  const aleatorio = String(randomInt(0, 100)).padStart(2, '0');
  return `+55439${tempo}${aleatorio}`;
}
