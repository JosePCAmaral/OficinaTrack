import { Body, Controller, Get, HttpCode, Post, Req, Res } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { loginSchema, type Login, type RespostaSessao, type UsuarioEu } from '@oficinatrack/shared';
import { ErroNegocio } from '../../common/erros/erro-negocio.js';
import { limite } from '../../common/seguranca/limites.js';
import { ZodValidationPipe } from '../../common/validacao/zod-validation.pipe.js';
import type { Env } from '../../config/env.js';
import { AuthService } from './auth.service.js';
import { COOKIE_REFRESH, definirCookieRefresh, limparCookieRefresh } from './cookie-refresh.js';
import { Publico, UsuarioAtual, type UsuarioAutenticado } from './decorators.js';
import { SessoesService } from './sessoes.service.js';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly sessoes: SessoesService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  @Publico()
  @Post('login')
  @HttpCode(200)
  @Throttle({ default: { limit: limite(5), ttl: 60_000 } })
  async login(@Body(new ZodValidationPipe(loginSchema)) dados: Login, @Res({ passthrough: true }) res: Response): Promise<RespostaSessao> {
    const sessao = await this.auth.login(dados);
    definirCookieRefresh(res, sessao);
    return this.auth.montarResposta(sessao);
  }

  @Publico()
  @Post('refresh')
  @HttpCode(200)
  @Throttle({ default: { limit: limite(30), ttl: 60_000 } })
  async refresh(@Req() req: Request, @Res({ passthrough: true }) res: Response): Promise<RespostaSessao> {
    this.exigirOrigem(req);
    const token = req.cookies?.[COOKIE_REFRESH] as string | undefined;
    if (!token) throw new ErroNegocio(401, 'SESSAO_INVALIDA', 'Sua sessão expirou. Entre de novo');
    try {
      const sessao = await this.sessoes.renovar(token);
      definirCookieRefresh(res, sessao);
      return await this.auth.montarResposta(sessao);
    } catch (erro) {
      limparCookieRefresh(res);
      throw erro;
    }
  }

  @Publico()
  @Post('logout')
  @HttpCode(204)
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response): Promise<void> {
    this.exigirOrigem(req);
    const token = req.cookies?.[COOKIE_REFRESH] as string | undefined;
    if (token) await this.sessoes.revogar(token);
    limparCookieRefresh(res);
  }

  @Get('eu')
  eu(@UsuarioAtual() usuario: UsuarioAutenticado): Promise<UsuarioEu> {
    return this.auth.montarEu(usuario.id);
  }

  /** Rotas que agem pelo cookie conferem a origem (defesa extra além do SameSite=Strict). */
  private exigirOrigem(req: Request): void {
    if (req.headers.origin !== this.config.get('CORS_ORIGEM', { infer: true })) {
      throw new ErroNegocio(403, 'SEM_PERMISSAO', 'Origem não permitida');
    }
  }
}
