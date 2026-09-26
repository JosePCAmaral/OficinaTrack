import { Module } from '@nestjs/common';
import { OficinasModule } from '../oficinas/oficinas.module.js';
import { ConvitesController } from './convites.controller.js';
import { ConvitesService } from './convites.service.js';
import { UsuariosController } from './usuarios.controller.js';
import { UsuariosService } from './usuarios.service.js';

@Module({
  imports: [OficinasModule],
  controllers: [UsuariosController, ConvitesController],
  providers: [UsuariosService, ConvitesService],
  exports: [UsuariosService, ConvitesService],
})
export class UsuariosModule {}
