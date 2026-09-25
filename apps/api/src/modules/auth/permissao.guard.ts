import { type CanActivate, type ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { temPermissao, type Permissao } from '@oficinatrack/shared';
import { ErroNegocio } from '../../common/erros/erro-negocio.js';
import { naoAutenticado } from './autenticacao.guard.js';
import { CHAVE_PERMISSOES, type RequisicaoAutenticada } from './decorators.js';

@Injectable()
export class PermissaoGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(ctx: ExecutionContext): boolean {
    const exigidas = this.reflector.getAllAndOverride<Permissao[] | undefined>(CHAVE_PERMISSOES, [ctx.getHandler(), ctx.getClass()]);
    if (!exigidas?.length) return true;
    const usuario = ctx.switchToHttp().getRequest<RequisicaoAutenticada>().usuario;
    if (!usuario) throw naoAutenticado();
    if (!exigidas.every((p) => temPermissao(usuario.perfil, p))) {
      throw new ErroNegocio(403, 'SEM_PERMISSAO', 'Você não tem permissão para esta ação');
    }
    return true;
  }
}
