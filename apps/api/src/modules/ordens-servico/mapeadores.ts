import type { DetalheOS, ResumoOS, StatusOS } from '@oficinatrack/shared';

export const CAMPOS_DETALHE = {
  id: true, numero: true, status: true, statusDesde: true, criadoEm: true,
  relatoCliente: true, diagnostico: true, kmEntrada: true, previsaoEntrega: true,
  veiculo: { select: { id: true, placa: true, marca: true, modelo: true, cor: true, anoModelo: true } },
  cliente: { select: { id: true, nome: true, telefone: true } },
  responsavel: { select: { id: true, nome: true } },
} as const;

export const CAMPOS_RESUMO = {
  id: true, numero: true, status: true, statusDesde: true, criadoEm: true, relatoCliente: true,
  veiculo: { select: { placa: true, modelo: true } },
  cliente: { select: { id: true, nome: true } },
} as const;

type LinhaDetalhe = Omit<DetalheOS, 'statusDesde' | 'criadoEm' | 'previsaoEntrega'> & {
  statusDesde: Date; criadoEm: Date; previsaoEntrega: Date | null;
};

type LinhaResumo = {
  id: string; numero: number; status: StatusOS; statusDesde: Date; criadoEm: Date; relatoCliente: string;
  veiculo: { placa: string; modelo: string | null }; cliente: { id: string; nome: string | null };
};

/**
 * Previsão de entrega é um dia, não um instante: `'2026-10-02'` vira meio-dia em São Paulo
 * (15:00 UTC), longe da virada do dia em qualquer fuso do Brasil, e volta como `'2026-10-02'`.
 */
export const paraMeioDia = (data: string) => new Date(`${data}T15:00:00.000Z`);
export const paraDia = (data: Date) => data.toISOString().slice(0, 10);

export const paraDetalhe = (os: LinhaDetalhe): DetalheOS => ({
  ...os,
  statusDesde: os.statusDesde.toISOString(),
  criadoEm: os.criadoEm.toISOString(),
  previsaoEntrega: os.previsaoEntrega ? paraDia(os.previsaoEntrega) : null,
});

export const paraResumo = ({ veiculo, ...os }: LinhaResumo): ResumoOS => ({
  ...os,
  statusDesde: os.statusDesde.toISOString(),
  criadoEm: os.criadoEm.toISOString(),
  placa: veiculo.placa,
  modelo: veiculo.modelo,
});
