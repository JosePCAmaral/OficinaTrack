import { Module } from '@nestjs/common';
import { OficinasController } from './oficinas.controller.js';
import { OficinasService } from './oficinas.service.js';

@Module({
  controllers: [OficinasController],
  providers: [OficinasService],
  exports: [OficinasService],
})
export class OficinasModule {}
