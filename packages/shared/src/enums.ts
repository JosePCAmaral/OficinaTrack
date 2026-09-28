import { z } from 'zod';

export const PerfilUsuario = z.enum(['DONO', 'FUNCIONARIO']);
export type PerfilUsuario = z.infer<typeof PerfilUsuario>;

export const StatusOS = z.enum([
  'TRIAGEM',
  'DIAGNOSTICO',
  'AGUARDANDO_APROVACAO',
  'AGUARDANDO_PECA',
  'EM_EXECUCAO',
  'PRONTO',
  'ENTREGUE',
  'CANCELADO',
]);
export type StatusOS = z.infer<typeof StatusOS>;

export const TipoEvento = z.enum([
  'OS_ABERTA',
  'STATUS_ALTERADO',
  'COMENTARIO', // obsoleto desde a Sprint 3: não usar (mantido porque há registros antigos)
  'NOTA_INTERNA',
  'ATUALIZACAO_CLIENTE',
  'VEICULO_TRANSFERIDO',
  'FOTO',
  'ORCAMENTO_ENVIADO',
  'ORCAMENTO_RESPONDIDO',
  'CHECKLIST_PREENCHIDO',
]);
export type TipoEvento = z.infer<typeof TipoEvento>;

export const StatusOrcamento = z.enum(['RASCUNHO', 'ENVIADO', 'RESPONDIDO', 'SUBSTITUIDO']);
export type StatusOrcamento = z.infer<typeof StatusOrcamento>;

export const TipoItem = z.enum(['PECA', 'MAO_DE_OBRA']);
export type TipoItem = z.infer<typeof TipoItem>;

export const StatusItem = z.enum(['PENDENTE', 'APROVADO', 'RECUSADO']);
export type StatusItem = z.infer<typeof StatusItem>;
