/**
 * Models filtrados automaticamente por `oficinaId`.
 * Todo model novo com `oficinaId` precisa entrar aqui; o teste
 * "lista de models com tenant bate com o schema" falha se esquecer.
 * `Oficina` é tratada à parte (filtrada por `id`).
 */
export const MODELOS_COM_TENANT: ReadonlySet<string> = new Set([
  'Usuario',
  'RefreshToken',
  'Convite',
  'Cliente',
  'Veiculo',
  'OrdemServico',
  'ChecklistEntrada',
  'EventoOS',
  'Foto',
  'Orcamento',
  'ItemOrcamento',
  'AcessoCliente',
  'TokenUsuario',
]);

/**
 * Models globais (sem `oficinaId`, nunca filtrados por tenant). Todo model do schema precisa
 * estar em `MODELOS_COM_TENANT` OU aqui (ou ser `Oficina`) — a extensão de tenant falha fechado
 * (`TenantModeloDesconhecidoError`) para qualquer model fora dos três, e o teste de partição em
 * `extensao-tenant.spec.ts` garante que os três conjuntos cobrem o schema inteiro sem overlap.
 */
export const MODELOS_GLOBAIS: ReadonlySet<string> = new Set(['CodigoPiloto']);
