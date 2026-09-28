import { paraDetalhe, paraDia, paraMeioDia, paraResumo } from './mapeadores.js';

describe('mapeadores da OS', () => {
  it('previsão: dia vira meio-dia em São Paulo (15:00 UTC) e volta como o mesmo dia', () => {
    const data = paraMeioDia('2026-10-02');
    expect(data.toISOString()).toBe('2026-10-02T15:00:00.000Z');
    expect(paraDia(data)).toBe('2026-10-02');
    // no fuso de São Paulo (UTC-3) continua sendo o dia 2
    expect(data.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })).toBe('02/10/2026');
  });

  const base = {
    id: 'os1', numero: 7, status: 'TRIAGEM' as const, statusDesde: new Date('2026-09-28T10:00:00Z'), criadoEm: new Date('2026-09-28T10:00:00Z'),
    relatoCliente: 'Barulho',
  };

  it('detalhe: datas em ISO e previsão nula continua nula', () => {
    const d = paraDetalhe({
      ...base, diagnostico: null, kmEntrada: null, previsaoEntrega: null,
      veiculo: { id: 'v1', placa: 'ABC1D23', marca: null, modelo: null, cor: null, anoModelo: null },
      cliente: { id: 'c1', nome: null, telefone: '+5543999990000' }, responsavel: null,
    });
    expect(d).toMatchObject({ statusDesde: '2026-09-28T10:00:00.000Z', criadoEm: '2026-09-28T10:00:00.000Z', previsaoEntrega: null });
  });

  it('resumo: achata placa e modelo do veículo', () => {
    const r = paraResumo({ ...base, veiculo: { placa: 'ABC1D23', modelo: 'Gol' }, cliente: { id: 'c1', nome: 'Ana' } });
    expect(r).toEqual({
      id: 'os1', numero: 7, status: 'TRIAGEM', statusDesde: '2026-09-28T10:00:00.000Z', criadoEm: '2026-09-28T10:00:00.000Z',
      relatoCliente: 'Barulho', placa: 'ABC1D23', modelo: 'Gol', cliente: { id: 'c1', nome: 'Ana' },
    });
  });
});
