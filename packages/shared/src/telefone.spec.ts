import { normalizarTelefone } from './telefone.js';

describe('normalizarTelefone', () => {
  it.each([
    ['(43) 99999-8888', '+5543999998888'],
    ['43999998888', '+5543999998888'],
    ['043 99999 8888', '+5543999998888'],
    ['+55 43 99999-8888', '+5543999998888'],
    ['55 43 99999-8888', '+5543999998888'],
    ['5543999998888', '+5543999998888'],
    // celular antigo, sem o 9: acrescenta
    ['43 8888-7777', '+5543988887777'],
    // fixo
    ['(43) 3555-1234', '+554335551234'],
    // DDD 55 (Santa Maria/RS) não pode ser confundido com o código do país
    ['(55) 99999-8888', '+5555999998888'],
  ])('%s → %s', (entrada, esperado) => {
    expect(normalizarTelefone(entrada)).toBe(esperado);
  });

  it.each([
    '',
    '9999-8888', // sem DDD
    '(10) 99999-8888', // DDD inválido
    '(43) 89999-8888', // 9 dígitos sem começar com 9
    '(43) 1555-1234', // fixo começando com 1
    '+1 415 555 2671', // estrangeiro: fora do MVP
    '43 99999-88889', // dígito a mais
  ])('rejeita %s', (entrada) => {
    expect(normalizarTelefone(entrada)).toBeNull();
  });
});
