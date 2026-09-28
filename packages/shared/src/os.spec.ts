import { formatarNumeroOS, osEstaAberta } from './os.js';

describe('formatarNumeroOS', () => {
  it.each([[1, '#0001'], [42, '#0042'], [12345, '#12345']])('%i → %s', (n, esperado) => {
    expect(formatarNumeroOS(n)).toBe(esperado);
  });
});

describe('osEstaAberta', () => {
  it('ENTREGUE e CANCELADO não estão abertas', () => {
    expect(osEstaAberta('TRIAGEM')).toBe(true);
    expect(osEstaAberta('PRONTO')).toBe(true);
    expect(osEstaAberta('ENTREGUE')).toBe(false);
    expect(osEstaAberta('CANCELADO')).toBe(false);
  });
});
