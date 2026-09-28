import { randomInt } from 'node:crypto';

/**
 * Celular BR válido (`+554399XXXXXXXX`, DDD 43, começa com 9) para os apoios de teste, sorteado
 * no espaço cheio de 8 dígitos com `randomInt` criptográfico (não `Math.random()`, mais previsível
 * entre workers/execuções). Como `Usuario.telefone` é único no sistema inteiro e o banco de teste
 * nunca é zerado, uma colisão ainda é possível (~1 em 10^8 por chamada): quem cria um `Usuario` com
 * telefone deve tentar de novo com um telefone novo se o insert falhar com P2002
 * (`criarUsuarioNa` em `test/auth/apoio-auth.ts`).
 */
export function telefoneTeste(): string {
  const digitos = String(randomInt(0, 100_000_000)).padStart(8, '0');
  return `+55439${digitos}`;
}
