import { createParamDecorator, type ExecutionContext, SetMetadata } from '@nestjs/common';
import type { PerfilUsuario, Permissao } from '@oficinatrack/shared';

export const CHAVE_PUBLICO = 'rota-publica';
export const CHAVE_PERMISSOES = 'permissoes-exigidas';

/** Libera a rota do guard de autenticação. Toda rota sem isto exige login. */
export const Publico = () => SetMetadata(CHAVE_PUBLICO, true);
export const ExigePermissao = (...permissoes: Permissao[]) => SetMetadata(CHAVE_PERMISSOES, permissoes);

export type UsuarioAutenticado = { id: string; oficinaId: string; perfil: PerfilUsuario; nome: string; email: string; familiaId: string };
export type RequisicaoAutenticada = { usuario?: UsuarioAutenticado };

export const UsuarioAtual = createParamDecorator(
  (_dado: unknown, ctx: ExecutionContext): UsuarioAutenticado => ctx.switchToHttp().getRequest<RequisicaoAutenticada>().usuario!,
);
