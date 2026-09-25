import { gerarToken, hashToken } from './tokens.js';

describe('tokens', () => {
  it('gera 32 bytes em base64url e guarda só o hash sha-256', () => {
    const { token, hash } = gerarToken();
    expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
    expect(hashToken(token)).toBe(hash);
  });
  it('tokens diferentes a cada chamada', () => {
    expect(gerarToken().token).not.toBe(gerarToken().token);
  });
});
