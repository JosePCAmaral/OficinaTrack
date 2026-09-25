import type { PerfilUsuario } from './enums.js';

export const PERMISSOES = [
  'OFICINA_EDITAR',
  'EQUIPE_GERENCIAR',
  'CLIENTES_GERENCIAR',
  'VEICULOS_GERENCIAR',
  'OS_GERENCIAR',
  'PATIO_OPERAR',
  'ORCAMENTOS_GERENCIAR',
] as const;
export type Permissao = (typeof PERMISSOES)[number];

const OPERACAO: readonly Permissao[] = [
  'CLIENTES_GERENCIAR',
  'VEICULOS_GERENCIAR',
  'OS_GERENCIAR',
  'PATIO_OPERAR',
  'ORCAMENTOS_GERENCIAR',
];

/**
 * Perfil → permissões. Endpoints e telas pedem PERMISSÕES, nunca perfis:
 * um perfil novo (ex.: FINANCEIRO, PATIO) é só mais uma entrada aqui.
 */
export const PERMISSOES_POR_PERFIL: Readonly<Record<PerfilUsuario, readonly Permissao[]>> = {
  DONO: PERMISSOES,
  FUNCIONARIO: OPERACAO,
};

export function temPermissao(perfil: PerfilUsuario, permissao: Permissao): boolean {
  return PERMISSOES_POR_PERFIL[perfil].includes(permissao);
}
