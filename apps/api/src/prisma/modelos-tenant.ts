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
]);
