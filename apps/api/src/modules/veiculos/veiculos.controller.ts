import { Body, Controller, Get, Param, Patch, Query } from '@nestjs/common';
import { alterarVeiculoSchema, consultaPlacaSchema, type AlterarVeiculo, type ConsultaPlaca, type FichaVeiculo } from '@oficinatrack/shared';
import { ErroNegocio } from '../../common/erros/erro-negocio.js';
import { ZodValidationPipe } from '../../common/validacao/zod-validation.pipe.js';
import { ExigePermissao } from '../auth/decorators.js';
import { VeiculosService } from './veiculos.service.js';

@Controller('veiculos')
export class VeiculosController {
  constructor(private readonly veiculos: VeiculosService) {}

  // rota estática: precisa vir antes de ':id' para não ser capturada por ela
  @Get('consulta')
  @ExigePermissao('VEICULOS_GERENCIAR')
  async consultar(@Query(new ZodValidationPipe(consultaPlacaSchema)) { placa }: { placa: string }): Promise<ConsultaPlaca> {
    const veiculo = await this.veiculos.buscarFichaPorPlaca(placa);
    if (!veiculo) throw new ErroNegocio(404, 'RECURSO_NAO_ENCONTRADO', 'Veículo não encontrado');
    // a Tarefa 5 completa com a OS em aberto (OrdensServicoService)
    return { veiculo, osAberta: null };
  }

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
