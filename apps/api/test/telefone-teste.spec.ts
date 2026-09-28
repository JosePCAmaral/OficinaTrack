import { telefoneTeste } from './telefone-teste.js';

describe('telefoneTeste', () => {
  it('gera um celular BR válido no formato +55439 + 8 dígitos', () => {
    for (let i = 0; i < 50; i++) {
      expect(telefoneTeste()).toMatch(/^\+55439\d{8}$/);
    }
  });

  it('1000 chamadas seguidas não colidem entre si (espaço cheio de 8 dígitos)', () => {
    const gerados = Array.from({ length: 1000 }, () => telefoneTeste());
    expect(new Set(gerados).size).toBe(gerados.length);
  });
});
