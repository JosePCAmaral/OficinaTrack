import { Body, Controller, Get, Param, Patch } from '@nestjs/common';
import { alterarClienteSchema, type AlterarCliente, type FichaCliente } from '@oficinatrack/shared';
import { ZodValidationPipe } from '../../common/validacao/zod-validation.pipe.js';
import { ExigePermissao } from '../auth/decorators.js';
import { ClientesService } from './clientes.service.js';

@Controller('clientes')
export class ClientesController {
  constructor(private readonly clientes: ClientesService) {}

  @Get(':id')
  @ExigePermissao('CLIENTES_GERENCIAR')
  ficha(@Param('id') id: string): Promise<FichaCliente> {
    return this.clientes.ficha(id);
  }

  @Patch(':id')
  @ExigePermissao('CLIENTES_GERENCIAR')
  alterar(@Param('id') id: string, @Body(new ZodValidationPipe(alterarClienteSchema)) dados: AlterarCliente): Promise<FichaCliente> {
    return this.clientes.alterar(id, dados);
  }
}
