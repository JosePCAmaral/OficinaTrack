import { Controller, Get, Query } from '@nestjs/common';
import { buscaSchema, type ResultadoBusca } from '@oficinatrack/shared';
import { ZodValidationPipe } from '../../common/validacao/zod-validation.pipe.js';
import { ClientesService } from '../clientes/clientes.service.js';
import { ExigePermissao } from '../auth/decorators.js';
import { VeiculosService } from '../veiculos/veiculos.service.js';

@Controller('busca')
export class BuscaController {
  constructor(
    private readonly clientes: ClientesService,
    private readonly veiculos: VeiculosService,
  ) {}

  @Get()
  @ExigePermissao('CLIENTES_GERENCIAR')
  async buscar(@Query(new ZodValidationPipe(buscaSchema)) { q }: { q: string }): Promise<ResultadoBusca> {
    const [clientes, veiculos] = await Promise.all([this.clientes.buscar(q), this.veiculos.buscar(q)]);
    return { clientes, veiculos };
  }
}
