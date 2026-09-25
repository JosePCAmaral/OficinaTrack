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

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: validarEnv }),
    EventEmitterModule.forRoot(),
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: limite(120) }]),
    TenantModule,
    PrismaModule,
    NotificacoesModule,
    SaudeModule,
  ],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
