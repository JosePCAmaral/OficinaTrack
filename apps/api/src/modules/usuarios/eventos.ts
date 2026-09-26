export const USUARIO_DESATIVADO = 'usuario.desativado';
export type UsuarioDesativado = { oficinaId: string; usuarioId: string };

/**
 * O usuário perdeu privilégio ou teve a conta recuperada: mudou de perfil ou redefiniu a senha.
 * Quem ouve invalida o que ele deixou pendente (convites), para que não sirva de porta dos fundos.
 */
export const USUARIO_CREDENCIAIS_ALTERADAS = 'usuario.credenciais_alteradas';
export type UsuarioCredenciaisAlteradas = { oficinaId: string; usuarioId: string; motivo: 'PERFIL_ALTERADO' | 'SENHA_REDEFINIDA' };
