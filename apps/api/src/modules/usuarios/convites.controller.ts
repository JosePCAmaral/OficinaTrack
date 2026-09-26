import { Body, Controller, Delete, Get, HttpCode, Param, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { conviteSchema, type ConviteCriado, type ConvitePendente, type PerfilUsuario } from '@oficinatrack/shared';
import { limite } from '../../common/seguranca/limites.js';
import { ZodValidationPipe } from '../../common/validacao/zod-validation.pipe.js';
import { ExigePermissao, UsuarioAtual, type UsuarioAutenticado } from '../auth/decorators.js';
import { ConvitesService } from './convites.service.js';

/** Rotas de gestão de convites, restritas a quem administra a equipe. O aceite público mora em `ConvitesPublicoController` (módulo `auth`). */
@Controller('convites')
export class ConvitesController {
  constructor(private readonly convites: ConvitesService) {}

  @Get()
  @ExigePermissao('EQUIPE_GERENCIAR')
  listar(): Promise<ConvitePendente[]> {
    return this.convites.listarPendentes();
  }

  @Post()
  @ExigePermissao('EQUIPE_GERENCIAR')
  // cada convite é um e-mail nosso para um endereço qualquer: sem isto, vira relay de spam (auditoria #2)
  @Throttle({ default: { limit: limite(20), ttl: 3_600_000 } })
  criar(
    @Body(new ZodValidationPipe(conviteSchema)) dados: { nome: string; email: string; telefone?: string; perfil: PerfilUsuario },
    @UsuarioAtual() ator: UsuarioAutenticado,
  ): Promise<ConviteCriado> {
    return this.convites.criar(dados, ator);
  }

  @Post(':id/reenviar')
  @HttpCode(200)
  @ExigePermissao('EQUIPE_GERENCIAR')
  reenviar(@Param('id') id: string): Promise<ConviteCriado> {
    return this.convites.reenviar(id);
  }

  @Delete(':id')
  @HttpCode(204)
  @ExigePermissao('EQUIPE_GERENCIAR')
  cancelar(@Param('id') id: string): Promise<void> {
    return this.convites.cancelar(id);
  }
}
