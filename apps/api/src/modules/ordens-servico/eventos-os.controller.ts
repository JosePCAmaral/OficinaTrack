import { Body, Controller, Get, HttpCode, Param, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { novoEventoSchema, paginacaoSchema, type EventoOSDto, type NovoEvento, type Pagina, type Paginacao } from '@oficinatrack/shared';
import { ZodValidationPipe } from '../../common/validacao/zod-validation.pipe.js';
import { ExigePermissao, UsuarioAtual, type UsuarioAutenticado } from '../auth/decorators.js';
import { EventosOsService } from './eventos-os.service.js';

@ApiTags('ordens-servico')
@Controller('ordens-servico/:id/eventos')
export class EventosOsController {
  constructor(private readonly eventos: EventosOsService) {}

  @Get()
  @ExigePermissao('OS_GERENCIAR')
  listar(@Param('id') id: string, @Query(new ZodValidationPipe(paginacaoSchema)) p: Paginacao): Promise<Pagina<EventoOSDto>> {
    return this.eventos.listar(id, p);
  }

  @Post()
  @HttpCode(201)
  @ExigePermissao('OS_GERENCIAR')
  publicar(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(novoEventoSchema)) dados: NovoEvento,
    @UsuarioAtual() ator: UsuarioAutenticado,
  ): Promise<EventoOSDto> {
    return this.eventos.publicar(id, dados, ator);
  }

  @Post(':eventoId/retirar')
  @HttpCode(200)
  @ExigePermissao('OS_GERENCIAR')
  retirar(
    @Param('id') id: string,
    @Param('eventoId') eventoId: string,
    @UsuarioAtual() ator: UsuarioAutenticado,
  ): Promise<EventoOSDto> {
    return this.eventos.retirar(id, eventoId, ator);
  }
}
