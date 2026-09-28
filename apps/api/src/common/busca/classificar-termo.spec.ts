import { classificarTermo, placaParcial } from './classificar-termo.js';

describe('classificarTermo', () => {
  it.each(['ABC1234', 'abc-1d23', 'ABC 1D23'])('reconhece placa em qualquer formato (%s)', (entrada) => {
    expect(classificarTermo(entrada).tipo).toBe('placa');
  });

  it.each(['+5543988887777', '(43) 98888-7777', '43988887777'])('reconhece telefone em qualquer formato (%s)', (entrada) => {
    expect(classificarTermo(entrada).tipo).toBe('telefone');
  });

  it('cai para nome quando não é placa nem telefone', () => {
    expect(classificarTermo('Maria Aparecida')).toEqual({ tipo: 'nome', valor: 'Maria Aparecida' });
  });

  it('nome vem com trim', () => {
    expect(classificarTermo('  apare  ')).toEqual({ tipo: 'nome', valor: 'apare' });
  });
});

describe('placaParcial', () => {
  it('aceita 3 a 7 caracteres alfanuméricos', () => {
    expect(placaParcial('QWE')).toBe('QWE');
    expect(placaParcial('qwe1r23')).toBe('QWE1R23');
  });

  it('rejeita menos de 3 ou mais de 7 caracteres', () => {
    expect(placaParcial('AB')).toBeNull();
    expect(placaParcial('ABCDEFGH')).toBeNull();
  });

  it('rejeita termo com espaço, hífen ou outros símbolos', () => {
    expect(placaParcial('AB-1')).toBeNull();
    expect(placaParcial('ab cd')).toBeNull();
  });
});
