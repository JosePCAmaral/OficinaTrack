import { hashSenha, verificarSenha } from './senhas.js';

describe('senhas', () => {
  it('hash argon2id que confere só com a senha certa', async () => {
    const hash = await hashSenha('motor-v8-turbo');
    expect(hash.startsWith('$argon2id$')).toBe(true);
    expect(await verificarSenha(hash, 'motor-v8-turbo')).toBe(true);
    expect(await verificarSenha(hash, 'outra-senha')).toBe(false);
  });
  it('sem hash (usuário inexistente) retorna false sem lançar', async () => {
    expect(await verificarSenha(undefined, 'qualquer')).toBe(false);
  });
  it('hash corrompido retorna false', async () => {
    expect(await verificarSenha('nao-e-hash', 'x')).toBe(false);
  });
});
