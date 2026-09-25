import { Body, Controller, Get, Patch } from '@nestjs/common';
import { oficinaDadosSchema, type DadosOficina, type DadosOficinaValidos } from '@oficinatrack/shared';
import { ZodValidationPipe } from '../../common/validacao/zod-validation.pipe.js';
import { ExigePermissao } from '../auth/decorators.js';
import { OficinasService } from './oficinas.service.js';

@Controller('oficinas')
export class OficinasController {
  constructor(private readonly oficinas: OficinasService) {}

  @Get('atual')
  buscar(): Promise<DadosOficina> {
    return this.oficinas.buscarAtual();
  }

  @Patch('atual')
  @ExigePermissao('OFICINA_EDITAR')
  atualizar(@Body(new ZodValidationPipe(oficinaDadosSchema)) dados: DadosOficinaValidos): Promise<DadosOficina> {
    return this.oficinas.atualizar(dados);
  }
}
