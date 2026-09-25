/**
 * Campos de relação de cada model (Oficina + todos os models com tenant), mantidos à mão.
 * `{ [modelo]: { [campoRelacao]: modeloAlvo } }`.
 *
 * A extensão de tenant usa este mapa para reconhecer, PELO NOME, uma escrita por relação
 * dentro de `data` (nunca pelo formato do valor: há campos Json como `itens`/`avarias`).
 * O teste "mapa de relações com tenant" compara com `prisma/schema.prisma` e falha se um
 * campo de relação for criado/renomeado sem atualizar aqui.
 *
 * `CodigoPiloto` é global (sem `oficinaId`, filtrada `campoTenant` retorna `null`) e por isso
 * NÃO tem entrada própria aqui: a extensão não intercepta suas operações, então não há
 * escrita por relação para validar nesse sentido. Ele aparece só como ALVO da relação
 * `Oficina.codigoPiloto` (Oficina continua com tenant, então a chave em `data.codigoPiloto`
 * é recusada normalmente pela extensão).
 */
export const RELACOES_TENANT: Readonly<Record<string, Readonly<Record<string, string>>>> = {
  Oficina: {
    usuarios: 'Usuario',
    refreshTokens: 'RefreshToken',
    convites: 'Convite',
    clientes: 'Cliente',
    veiculos: 'Veiculo',
    ordensServico: 'OrdemServico',
    checklists: 'ChecklistEntrada',
    eventos: 'EventoOS',
    fotos: 'Foto',
    orcamentos: 'Orcamento',
    itensOrcamento: 'ItemOrcamento',
    acessosCliente: 'AcessoCliente',
    tokensUsuario: 'TokenUsuario',
    codigoPiloto: 'CodigoPiloto',
  },
  Usuario: {
    oficina: 'Oficina',
    refreshTokens: 'RefreshToken',
    convitesCriados: 'Convite',
    osResponsavel: 'OrdemServico',
    eventos: 'EventoOS',
    tokens: 'TokenUsuario',
  },
  RefreshToken: { oficina: 'Oficina', usuario: 'Usuario' },
  Convite: { oficina: 'Oficina', criadoPor: 'Usuario' },
  Cliente: { oficina: 'Oficina', veiculos: 'Veiculo', ordensServico: 'OrdemServico', acessos: 'AcessoCliente' },
  Veiculo: { oficina: 'Oficina', cliente: 'Cliente', ordensServico: 'OrdemServico' },
  OrdemServico: {
    oficina: 'Oficina',
    veiculo: 'Veiculo',
    cliente: 'Cliente',
    responsavel: 'Usuario',
    checklist: 'ChecklistEntrada',
    eventos: 'EventoOS',
    orcamentos: 'Orcamento',
    fotos: 'Foto',
  },
  ChecklistEntrada: { oficina: 'Oficina', ordemServico: 'OrdemServico' },
  EventoOS: { oficina: 'Oficina', ordemServico: 'OrdemServico', autor: 'Usuario', fotos: 'Foto' },
  Foto: { oficina: 'Oficina', ordemServico: 'OrdemServico', evento: 'EventoOS' },
  Orcamento: { oficina: 'Oficina', ordemServico: 'OrdemServico', itens: 'ItemOrcamento' },
  ItemOrcamento: { oficina: 'Oficina', orcamento: 'Orcamento' },
  AcessoCliente: { oficina: 'Oficina', cliente: 'Cliente' },
  TokenUsuario: { oficina: 'Oficina', usuario: 'Usuario' },
};

/**
 * Relações em que o `create`/`createMany` aninhado é permitido: o filho aponta de volta
 * para este model por FK composta `(oficinaId, xId)`, então herda o `oficinaId` do pai
 * e o banco garante que pai e filho são da mesma oficina. Qualquer outra relação
 * (inclusive as da `Oficina`, que usam FK simples) não aceita escrita aninhada.
 */
export const CRIACAO_ANINHADA_PERMITIDA: Readonly<Record<string, ReadonlySet<string>>> = {
  Oficina: new Set(),
  Usuario: new Set(['refreshTokens', 'convitesCriados', 'osResponsavel', 'eventos', 'tokens']),
  RefreshToken: new Set(),
  Convite: new Set(),
  Cliente: new Set(['veiculos', 'ordensServico', 'acessos']),
  Veiculo: new Set(['ordensServico']),
  OrdemServico: new Set(['checklist', 'eventos', 'orcamentos', 'fotos']),
  ChecklistEntrada: new Set(),
  EventoOS: new Set(['fotos']),
  Foto: new Set(),
  Orcamento: new Set(['itens']),
  ItemOrcamento: new Set(),
  AcessoCliente: new Set(),
  TokenUsuario: new Set(),
};
