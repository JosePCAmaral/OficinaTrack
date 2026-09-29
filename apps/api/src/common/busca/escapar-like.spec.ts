import { escaparLike } from './escapar-like.js';

describe('escaparLike', () => {
  it('mantém texto comum intacto', () => {
    expect(escaparLike('Maria da Silva')).toBe('Maria da Silva');
  });

  it('escapa os curingas % e _', () => {
    expect(escaparLike('%%')).toBe('\\%\\%');
    expect(escaparLike('__')).toBe('\\_\\_');
    expect(escaparLike('50%_off')).toBe('50\\%\\_off');
  });

  it('escapa a barra invertida antes dos curingas (não dupla-escapa)', () => {
    expect(escaparLike('\\')).toBe('\\\\');
    expect(escaparLike('\\%')).toBe('\\\\\\%');
  });
});
