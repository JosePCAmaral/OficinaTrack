import { Module } from '@nestjs/common';
import { VeiculosController } from './veiculos.controller.js';
import { VeiculosService } from './veiculos.service.js';

@Module({
  controllers: [VeiculosController],
  providers: [VeiculosService],
  exports: [VeiculosService],
})
export class VeiculosModule {}
