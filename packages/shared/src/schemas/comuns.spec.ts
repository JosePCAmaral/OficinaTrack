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
});
