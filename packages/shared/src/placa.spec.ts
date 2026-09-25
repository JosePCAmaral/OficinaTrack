import { formatarPlaca, normalizarPlaca } from './placa.js';

describe('normalizarPlaca', () => {
  it.each([
    ['ABC1234', 'ABC1234'],
    ['abc-1234', 'ABC1234'],
    [' abc 1234 ', 'ABC1234'],
    ['ABC1D23', 'ABC1D23'],
    ['abc1d23', 'ABC1D23'],
    ['ABC-1D23', 'ABC1D23'],
  ])('%s → %s', (entrada, esperado) => {
    expect(normalizarPlaca(entrada)).toBe(esperado);
  });

  it.each(['', 'AB1234', 'ABCD123', 'ABC12345', '1234ABC', 'ABC1DD3', 'ÁBC1234'])(
    'rejeita %s',
    (entrada) => {
      expect(normalizarPlaca(entrada)).toBeNull();
    },
  );
});

describe('formatarPlaca', () => {
  it('coloca hífen na placa antiga', () => {
    expect(formatarPlaca('ABC1234')).toBe('ABC-1234');
  });

  it('mantém a placa Mercosul sem hífen', () => {
    expect(formatarPlaca('ABC1D23')).toBe('ABC1D23');
  });
});
