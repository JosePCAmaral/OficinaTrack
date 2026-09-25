import { Body, Controller, Get, HttpCode, Post, Req, Res } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import {
  cadastroSchema,
  emailApenasSchema,
  loginSchema,
  tokenApenasSchema,
  type Cadastro,
  type Login,
  type RespostaSessao,
  type UsuarioEu,
} from '@oficinatrack/shared';
import { ErroNegocio } from '../../common/erros/erro-negocio.js';
import { limite } from '../../common/seguranca/limites.js';
import { ZodValidationPipe } from '../../common/validacao/zod-validation.pipe.js';
import type { Env } from '../../config/env.js';
import { AuthService } from './auth.service.js';
import { CadastroService } from './cadastro.service.js';
import { COOKIE_REFRESH, definirCookieRefresh, limparCookieRefresh } from './cookie-refresh.js';
import { Publico, UsuarioAtual, type UsuarioAutenticado } from './decorators.js';
import { SessaoConcorrenteError, SessoesService } from './sessoes.service.js';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly sessoes: SessoesService,
    private readonly cadastroService: CadastroService,
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
  @Post('cadastro')
  @Throttle({ default: { limit: limite(5), ttl: 3_600_000 } })
  async cadastro(@Body(new ZodValidationPipe(cadastroSchema)) dados: Cadastro): Promise<{ mensagem: string }> {
    await this.cadastroService.cadastrar(dados);
    return { mensagem: 'Enviamos um link de confirmação para o seu e-mail' };
  }

  @Publico()
  @Post('confirmar-email')
  @HttpCode(200)
  @Throttle({ default: { limit: limite(10), ttl: 60_000 } })
  async confirmarEmail(
    @Body(new ZodValidationPipe(tokenApenasSchema)) { token }: { token: string },
    @Res({ passthrough: true }) res: Response,
  ): Promise<RespostaSessao> {
    const sessao = await this.cadastroService.confirmarEmail(token);
    definirCookieRefresh(res, sessao);
    return this.auth.montarResposta(sessao);
  }

  @Publico()
  @Post('reenviar-confirmacao')
  @HttpCode(200)
  @Throttle({ default: { limit: limite(3), ttl: 3_600_000 } })
  async reenviarConfirmacao(@Body(new ZodValidationPipe(emailApenasSchema)) { email }: { email: string }): Promise<{ mensagem: string }> {
    await this.cadastroService.reenviarConfirmacao(email);
    return { mensagem: 'Se houver uma conta aguardando confirmação com este e-mail, enviamos um novo link' };
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
      // perdedor de uma rotação concorrente: não limpa o cookie, o vencedor já gravou um novo
      if (!(erro instanceof SessaoConcorrenteError)) limparCookieRefresh(res);
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
