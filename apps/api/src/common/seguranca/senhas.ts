import { hash, verify } from '@node-rs/argon2';

// Parâmetros mínimos recomendados pela OWASP para argon2id (a lib usa Argon2id por padrão).
const OPCOES = { memoryCost: 19_456, timeCost: 2, parallelism: 1 };

export function hashSenha(senha: string): Promise<string> {
  return hash(senha, OPCOES);
}

let hashFalso: Promise<string> | undefined;

/**
 * Sem hash (usuário não existe) ainda gasta o tempo de uma verificação, para o login
 * não revelar pelo tempo de resposta quais e-mails têm conta.
 */
export async function verificarSenha(senhaHash: string | undefined, senha: string): Promise<boolean> {
  if (!senhaHash) {
    hashFalso ??= hashSenha('senha-falsa-apenas-para-igualar-o-tempo');
    await verify(await hashFalso, senha).catch(() => false);
    return false;
  }
  return verify(senhaHash, senha).catch(() => false);
}
