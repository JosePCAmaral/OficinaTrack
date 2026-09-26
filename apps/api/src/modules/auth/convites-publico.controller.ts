import { Body, Controller, HttpCode, Post, Req, Res } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { aceitarConviteSchema, tokenApenasSchema, type RespostaSessao } from '@oficinatrack/shared';
import { limite } from '../../common/seguranca/limites.js';
import { ZodValidationPipe } from '../../common/validacao/zod-validation.pipe.js';
import type { Env } from '../../config/env.js';
import { ConvitesService } from '../usuarios/convites.service.js';
import { AuthService } from './auth.service.js';
import { definirCookieRefresh } from './cookie-refresh.js';
import { Publico } from './decorators.js';
import { exigirOrigem } from './origem.js';

/** Consulta e aceite público de convites (sem login). A gestão de convites do DONO mora em `ConvitesController` (módulo `usuarios`). */
@Controller('convites')
export class ConvitesPublicoController {
  constructor(
    private readonly convites: ConvitesService,
    private readonly auth: AuthService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  @Publico()
  @Post('consultar')
  @HttpCode(200)
  @Throttle({ default: { limit: limite(10), ttl: 60_000 } })
  consultar(@Body(new ZodValidationPipe(tokenApenasSchema)) { token }: { token: string }) {
    return this.convites.consultar(token);
  }

  @Publico()
  @Post('aceitar')
  @HttpCode(200)
  @Throttle({ default: { limit: limite(10), ttl: 60_000 } })
  async aceitar(
    @Req() req: Request,
    @Body(new ZodValidationPipe(aceitarConviteSchema)) dados: { token: string; senha: string; nome?: string; telefone?: string },
    @Res({ passthrough: true }) res: Response,
  ): Promise<RespostaSessao> {
    exigirOrigem(req, this.config.get('CORS_ORIGEM', { infer: true }));
    const usuario = await this.convites.aceitar(dados);
    const sessao = await this.auth.criarSessaoConvite(usuario);
    definirCookieRefresh(res, sessao);
    return this.auth.montarResposta(sessao);
  }
}
