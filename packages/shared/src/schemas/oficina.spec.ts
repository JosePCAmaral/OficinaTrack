import { documentoSchema, oficinaDadosSchema } from './oficina.js';

describe('documentoSchema', () => {
  it.each([
    ['123.456.789-09', '12345678909'],
    ['12.345.678/0001-95', '12345678000195'],
  ])('%s → %s', (entrada, esperado) => {
    expect(documentoSchema.parse(entrada)).toBe(esperado);
  });
  it('recusa tamanho diferente de 11 ou 14 dígitos', () => {
    expect(documentoSchema.safeParse('1234').success).toBe(false);
  });
});

describe('oficinaDadosSchema', () => {
  it('recusa UF inexistente', () => {
    expect(oficinaDadosSchema.safeParse({ nome: 'Oficina', telefone: '43999998888', uf: 'XX' }).success).toBe(false);
  });
  it('campos opcionais vazios viram undefined', () => {
    const r = oficinaDadosSchema.parse({ nome: 'Oficina', telefone: '43999998888', endereco: '', cidade: '', documento: '' });
    expect(r.endereco).toBeUndefined();
    expect(r.documento).toBeUndefined();
  });
});
