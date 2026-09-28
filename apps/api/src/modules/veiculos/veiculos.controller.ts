import { Body, Controller, Get, Param, Patch } from '@nestjs/common';
import { alterarVeiculoSchema, type AlterarVeiculo, type FichaVeiculo } from '@oficinatrack/shared';
import { ZodValidationPipe } from '../../common/validacao/zod-validation.pipe.js';
import { ExigePermissao } from '../auth/decorators.js';
import { VeiculosService } from './veiculos.service.js';

@Controller('veiculos')
export class VeiculosController {
  constructor(private readonly veiculos: VeiculosService) {}

  // `GET /veiculos/consulta` fica no OrdensServicoModule (precisa da OS em aberto) e é
  // registrada antes desta ':id' pela ordem dos módulos no AppModule.
  @Get(':id')
  @ExigePermissao('VEICULOS_GERENCIAR')
  ficha(@Param('id') id: string): Promise<FichaVeiculo> {
    return this.veiculos.ficha(id);
  }

  @Patch(':id')
  @ExigePermissao('VEICULOS_GERENCIAR')
  alterar(@Param('id') id: string, @Body(new ZodValidationPipe(alterarVeiculoSchema)) dados: AlterarVeiculo): Promise<FichaVeiculo> {
    return this.veiculos.alterar(id, dados);
  }
}
