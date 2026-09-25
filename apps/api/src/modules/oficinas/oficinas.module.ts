import { Module } from '@nestjs/common';
import { OficinasService } from './oficinas.service.js';

@Module({
  providers: [OficinasService],
  exports: [OficinasService],
})
export class OficinasModule {}
