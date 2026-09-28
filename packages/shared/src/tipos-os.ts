import type { StatusOS, TipoEvento } from './enums.js';

type Pessoa = { id: string; nome: string | null };
export type ResumoCliente = { id: string; nome: string | null; telefone: string };
export type ResumoVeiculo = { id: string; placa: string; marca: string | null; modelo: string | null; cliente: Pessoa };
export type ResumoOS = {
  id: string; numero: number; status: StatusOS; statusDesde: string; criadoEm: string;
  placa: string; modelo: string | null; cliente: Pessoa; relatoCliente: string;
};
export type DetalheOS = {
  id: string; numero: number; status: StatusOS; statusDesde: string; criadoEm: string;
  relatoCliente: string; diagnostico: string | null; kmEntrada: number | null; previsaoEntrega: string | null;
  veiculo: { id: string; placa: string; marca: string | null; modelo: string | null; cor: string | null; anoModelo: number | null };
  cliente: { id: string; nome: string | null; telefone: string };
  responsavel: { id: string; nome: string } | null;
};
export type EventoOSDto = {
  id: string; tipo: TipoEvento; texto: string | null; visivelCliente: boolean; criadoEm: string;
  statusDe: StatusOS | null; statusPara: StatusOS | null;
  autor: { id: string; nome: string } | null;
  retiradoEm: string | null; retiradoPor: { id: string; nome: string } | null;
};
export type FichaVeiculo = {
  id: string; placa: string; marca: string | null; modelo: string | null; anoModelo: number | null; cor: string | null;
  chassi: string | null; kmAtual: number | null; criadoEm: string; cliente: { id: string; nome: string | null; telefone: string };
};
export type FichaCliente = {
  id: string; nome: string | null; telefone: string; email: string | null; documento: string | null; observacoes: string | null;
  criadoEm: string; veiculos: Omit<ResumoVeiculo, 'cliente'>[];
};
export type ConsultaPlaca = { veiculo: FichaVeiculo; osAberta: { id: string; numero: number; criadoEm: string } | null };
export type ResultadoBusca = { clientes: ResumoCliente[]; veiculos: ResumoVeiculo[] };
