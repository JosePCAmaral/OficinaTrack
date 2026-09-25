import { normalizarEmail } from './email.js';

describe('normalizarEmail', () => {
  it.each([
    ['Dono@Oficina.COM', 'dono@oficina.com'],
    ['  ze@gmail.com  ', 'ze@gmail.com'],
  ])('%s → %s', (entrada, esperado) => {
    expect(normalizarEmail(entrada)).toBe(esperado);
  });
});
