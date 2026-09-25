import { Module } from '@nestjs/common';
import { UsuariosService } from './usuarios.service.js';

@Module({
  providers: [UsuariosService],
  exports: [UsuariosService],
})
export class UsuariosModule {}
