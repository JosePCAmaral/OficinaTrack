import { Module } from '@nestjs/common';
import { ClientesModule } from '../clientes/clientes.module.js';
import { VeiculosModule } from '../veiculos/veiculos.module.js';
import { BuscaController } from './busca.controller.js';

@Module({
  imports: [ClientesModule, VeiculosModule],
  controllers: [BuscaController],
})
export class BuscaModule {}
