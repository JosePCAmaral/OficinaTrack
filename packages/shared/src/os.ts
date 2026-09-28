import type { StatusOS } from './enums.js';

export const formatarNumeroOS = (numero: number) => `#${String(numero).padStart(4, '0')}`;

/** Status que contam como "OS em aberto" (tudo que não foi entregue nem cancelado). */
export const SITUACOES_ABERTAS: readonly StatusOS[] = [
  'TRIAGEM', 'DIAGNOSTICO', 'AGUARDANDO_APROVACAO', 'AGUARDANDO_PECA', 'EM_EXECUCAO', 'PRONTO',
];
export const osEstaAberta = (status: StatusOS) => SITUACOES_ABERTAS.includes(status);
