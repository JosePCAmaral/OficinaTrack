import { Module } from '@nestjs/common';
import { ClientesModule } from '../clientes/clientes.module.js';
import { OficinasModule } from '../oficinas/oficinas.module.js';
import { UsuariosModule } from '../usuarios/usuarios.module.js';
import { VeiculosModule } from '../veiculos/veiculos.module.js';
import { EventosOsController } from './eventos-os.controller.js';
import { EventosOsService } from './eventos-os.service.js';
import { HistoricoOsController, OrdensServicoController } from './ordens-servico.controller.js';
import { OrdensServicoService } from './ordens-servico.service.js';

@Module({
  imports: [ClientesModule, VeiculosModule, OficinasModule, UsuariosModule],
  controllers: [OrdensServicoController, HistoricoOsController, EventosOsController],
  providers: [OrdensServicoService, EventosOsService],
  exports: [OrdensServicoService],
})
export class OrdensServicoModule {}
