import { placaSchema, telefoneSchema } from './comuns.js';

describe('schemas comuns', () => {
  it('placaSchema normaliza', () => {
    expect(placaSchema.parse('abc-1234')).toBe('ABC1234');
  });

  it('placaSchema recusa com mensagem em português', () => {
    const r = placaSchema.safeParse('xx');
    expect(r.success).toBe(false);
    expect(r.error?.issues[0]?.message).toBe('Placa inválida');
  });

  it('telefoneSchema normaliza e recusa', () => {
    expect(telefoneSchema.parse('(43) 99999-8888')).toBe('+5543999998888');
    expect(telefoneSchema.safeParse('123').success).toBe(false);
  });

  it('recusa entrada acima de 20 caracteres antes de normalizar', () => {
    expect(placaSchema.safeParse('A'.repeat(21)).success).toBe(false);
    expect(telefoneSchema.safeParse('9'.repeat(21)).success).toBe(false);
    expect(telefoneSchema.safeParse(' '.repeat(10) + '43999998888').success).toBe(false);
    expect(placaSchema.parse('abc-1234' + ' '.repeat(12))).toBe('ABC1234');
  });
});
