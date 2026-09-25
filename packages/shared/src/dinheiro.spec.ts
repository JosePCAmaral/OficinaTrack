import { calcularTotalItemCentavos, formatarCentavos } from './dinheiro.js';

const semNbsp = (s: string) => s.replace(/ /g, ' ');

describe('formatarCentavos', () => {
  it('formata em reais', () => {
    expect(semNbsp(formatarCentavos(123456))).toBe('R$ 1.234,56');
    expect(semNbsp(formatarCentavos(5))).toBe('R$ 0,05');
  });

  it('recusa valor que não é inteiro', () => {
    expect(() => formatarCentavos(10.5)).toThrow(TypeError);
  });
});

describe('calcularTotalItemCentavos', () => {
  it.each([
    ['1', 15000, 15000],
    ['2', 4990, 9980],
    ['1.5', 3333, 5000], // 4999,5 → arredonda para cima
    ['0.333', 100, 33], // 33,3
    ['2.125', 999, 2123], // 2122,875
    ['0', 5000, 0],
  ])('%s × %i = %i', (quantidade, unitario, esperado) => {
    expect(calcularTotalItemCentavos(quantidade, unitario)).toBe(esperado);
  });

  it.each(['-1', '1.2345', 'abc', '1,5', ''])('recusa quantidade %s', (quantidade) => {
    expect(() => calcularTotalItemCentavos(quantidade, 100)).toThrow(TypeError);
  });

  it('recusa valor unitário negativo ou fracionado', () => {
    expect(() => calcularTotalItemCentavos('1', -1)).toThrow(TypeError);
    expect(() => calcularTotalItemCentavos('1', 1.5)).toThrow(TypeError);
  });
});
