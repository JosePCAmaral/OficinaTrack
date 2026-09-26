import { emitidoAntesDoCorte } from './autenticacao.guard.js';

describe('emitidoAntesDoCorte (sessaoValidaDesde)', () => {
  const corte = new Date('2026-09-26T12:00:00.500Z');
  const segundoDoCorte = Math.floor(corte.getTime() / 1000);

  it('sem corte, nenhum token é recusado', () => {
    expect(emitidoAntesDoCorte({ emitidoEmMs: 0, iat: 0 }, null)).toBe(false);
  });

  it('com emitidoEmMs compara em ms: antes do corte recusa, no mesmo segundo mas depois aceita', () => {
    expect(emitidoAntesDoCorte({ emitidoEmMs: corte.getTime() - 1, iat: segundoDoCorte }, corte)).toBe(true);
    expect(emitidoAntesDoCorte({ emitidoEmMs: corte.getTime(), iat: segundoDoCorte }, corte)).toBe(false);
    expect(emitidoAntesDoCorte({ emitidoEmMs: corte.getTime() + 300, iat: segundoDoCorte }, corte)).toBe(false);
  });

  it('sem emitidoEmMs cai para o iat em segundos e nunca recusa um token do mesmo segundo', () => {
    expect(emitidoAntesDoCorte({ iat: segundoDoCorte - 1 }, corte)).toBe(true);
    expect(emitidoAntesDoCorte({ iat: segundoDoCorte }, corte)).toBe(false);
    expect(emitidoAntesDoCorte({ iat: segundoDoCorte + 1 }, corte)).toBe(false);
  });
});
