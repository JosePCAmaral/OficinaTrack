import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { validarEnv } from './config/env.js';
import { limite } from './common/seguranca/limites.js';
import { TenantModule } from './common/tenant/tenant.module.js';
import { PrismaModule } from './prisma/prisma.module.js';
import { SaudeModule } from './modules/saude/saude.module.js';
import { NotificacoesModule } from './modules/notificacoes/notificacoes.module.js';
import { AuthModule } from './modules/auth/auth.module.js';
import { OficinasModule } from './modules/oficinas/oficinas.module.js';
import { UsuariosModule } from './modules/usuarios/usuarios.module.js';
import { ClientesModule } from './modules/clientes/clientes.module.js';
import { VeiculosModule } from './modules/veiculos/veiculos.module.js';
import { BuscaModule } from './modules/busca/busca.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: validarEnv }),
    EventEmitterModule.forRoot(),
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: limite(120) }]),
    TenantModule,
    PrismaModule,
    NotificacoesModule,
    SaudeModule,
    OficinasModule,
    UsuariosModule,
    AuthModule,
    ClientesModule,
    VeiculosModule,
    BuscaModule,
  ],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
