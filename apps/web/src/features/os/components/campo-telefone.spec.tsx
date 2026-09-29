import { normalizarTelefone } from '@oficinatrack/shared';
import { mascararTelefone } from './campo-telefone';

describe('mascararTelefone', () => {
  it('mascara enquanto digita', () => {
    expect(mascararTelefone('43')).toBe('(43');
    expect(mascararTelefone('439999')).toBe('(43) 9999');
    expect(mascararTelefone('43999998888')).toBe('(43) 99999-8888');
  });

  it('colar "+55 43 99999-8888" tira o DDI e fica válido', () => {
    const mascarado = mascararTelefone('+55 43 99999-8888');
    expect(mascarado).toBe('(43) 99999-8888');
    expect(normalizarTelefone(mascarado)).toBe('+5543999998888');
  });

  it('colar "+55 91 98888-7777" mantém o número certo (não corta os últimos dígitos)', () => {
    const mascarado = mascararTelefone('+55 91 98888-7777');
    expect(mascarado).toBe('(91) 98888-7777');
    expect(normalizarTelefone(mascarado)).toBe('+5591988887777');
  });

  it('colar "043 99999-8888" tira o zero de discagem', () => {
    const mascarado = mascararTelefone('043 99999-8888');
    expect(mascarado).toBe('(43) 99999-8888');
    expect(normalizarTelefone(mascarado)).toBe('+5543999998888');
  });

  it('colar "0055 43 99999-8888" tira os zeros e o DDI', () => {
    expect(mascararTelefone('0055 43 99999-8888')).toBe('(43) 99999-8888');
  });

  it('DDD 55 com 11 dígitos continua intacto', () => {
    expect(mascararTelefone('55999998888')).toBe('(55) 99999-8888');
  });
});
