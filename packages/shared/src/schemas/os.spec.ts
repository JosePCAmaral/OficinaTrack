import { abrirOsSchema, alterarOsSchema, novoEventoSchema } from './os.js';

describe('abrirOsSchema', () => {
  it('normaliza placa e telefone e aceita só os obrigatórios', () => {
    const r = abrirOsSchema.parse({ placa: 'abc-1d23', telefone: '(43) 99999-8888', relatoCliente: 'Barulho na suspensão' });
    expect(r).toEqual({ placa: 'ABC1D23', telefone: '+5543999998888', relatoCliente: 'Barulho na suspensão' });
  });
  it('campos opcionais vazios do formulário viram undefined', () => {
    const r = abrirOsSchema.parse({ placa: 'ABC1234', telefone: '43999998888', relatoCliente: 'Troca de óleo', nomeCliente: '', kmEntrada: '', previsaoEntrega: '' });
    expect(r.nomeCliente).toBeUndefined();
    expect(r.kmEntrada).toBeUndefined();
    expect(r.previsaoEntrega).toBeUndefined();
  });
  it('km vindo do formulário como texto vira número', () => {
    expect(abrirOsSchema.parse({ placa: 'ABC1234', telefone: '43999998888', relatoCliente: 'Revisão', kmEntrada: '85432' }).kmEntrada).toBe(85432);
  });
  it.each([
    [{ relatoCliente: 'ab' }, 'queixa curta'],
    [{ relatoCliente: 'x'.repeat(1001) }, 'queixa longa'],
    [{ kmEntrada: -1 }, 'km negativo'],
    [{ previsaoEntrega: '28/09/2026' }, 'data fora do formato'],
  ])('recusa %s (%s)', (extra, _desc) => {
    expect(abrirOsSchema.safeParse({ placa: 'ABC1234', telefone: '43999998888', relatoCliente: 'Revisão', ...extra }).success).toBe(false);
  });
});

describe('alterarOsSchema', () => {
  it('string vazia limpa o campo (null) e exige ao menos um campo', () => {
    expect(alterarOsSchema.parse({ diagnostico: '' })).toEqual({ diagnostico: null });
    expect(alterarOsSchema.safeParse({}).success).toBe(false);
  });
});

describe('novoEventoSchema (Review Focus 4)', () => {
  it('só aceita NOTA_INTERNA e ATUALIZACAO_CLIENTE e descarta visivelCliente do body', () => {
    expect(novoEventoSchema.safeParse({ tipo: 'COMENTARIO', texto: 'x' }).success).toBe(false);
    expect(novoEventoSchema.safeParse({ tipo: 'OS_ABERTA', texto: 'x' }).success).toBe(false);
    expect(novoEventoSchema.parse({ tipo: 'NOTA_INTERNA', texto: ' ok ', visivelCliente: true })).toEqual({ tipo: 'NOTA_INTERNA', texto: 'ok' });
  });
  it('texto de 1 a 2000 caracteres', () => {
    expect(novoEventoSchema.safeParse({ tipo: 'NOTA_INTERNA', texto: '   ' }).success).toBe(false);
    expect(novoEventoSchema.safeParse({ tipo: 'NOTA_INTERNA', texto: 'x'.repeat(2001) }).success).toBe(false);
  });
});
