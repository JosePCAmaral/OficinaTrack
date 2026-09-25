import { type CanActivate, type ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import type { Request } from 'express';
import type { PerfilUsuario } from '@oficinatrack/shared';
import { ErroNegocio } from '../../common/erros/erro-negocio.js';
import { TenantContext } from '../../common/tenant/tenant-context.js';
import { UsuariosService } from '../usuarios/usuarios.service.js';
import { CHAVE_PUBLICO, type RequisicaoAutenticada } from './decorators.js';

export type PayloadAcesso = { sub: string; oficinaId: string; perfil: PerfilUsuario; fam: string };
export const naoAutenticado = () => new ErroNegocio(401, 'NAO_AUTENTICADO', 'Faça login para continuar');

@Injectable()
export class AutenticacaoGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwt: JwtService,
    private readonly tenant: TenantContext,
    private readonly usuarios: UsuariosService,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    if (this.reflector.getAllAndOverride<boolean>(CHAVE_PUBLICO, [ctx.getHandler(), ctx.getClass()])) return true;
    const req = ctx.switchToHttp().getRequest<Request & RequisicaoAutenticada>();
    const [tipo, token] = (req.headers.authorization ?? '').split(' ');
    if (tipo !== 'Bearer' || !token) throw naoAutenticado();

    let payload: PayloadAcesso;
    try {
      payload = await this.jwt.verifyAsync<PayloadAcesso>(token, { algorithms: ['HS256'] });
    } catch {
      throw naoAutenticado();
    }

    this.tenant.definirOficina(payload.oficinaId);
    // perfil e "ativo" vêm do banco a cada requisição: desativar ou trocar perfil vale na hora
    const usuario = await this.usuarios.buscarAtivo(payload.sub);
    if (!usuario || !usuario.emailConfirmadoEm) throw naoAutenticado();
    req.usuario = { id: usuario.id, oficinaId: usuario.oficinaId, perfil: usuario.perfil, nome: usuario.nome, email: usuario.email, familiaId: payload.fam };
    return true;
  }
}
