import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from '../../config/env.js';
import { EnvioEmail } from './envio-email.js';
import { EnvioEmailMemoria } from './envio-email-memoria.js';
import { EnvioEmailSmtp } from './envio-email-smtp.js';
import { EnvioSms, EnvioSmsLog } from './envio-sms.js';
import { SegundoPlano } from './segundo-plano.js';

@Global()
@Module({
  providers: [
    SegundoPlano,
    EnvioEmailMemoria,
    {
      provide: EnvioEmail,
      inject: [ConfigService, EnvioEmailMemoria],
      useFactory: (config: ConfigService<Env, true>, memoria: EnvioEmailMemoria) =>
        config.get('EMAIL_TRANSPORTE', { infer: true }) === 'memoria' ? memoria : new EnvioEmailSmtp(config),
    },
    { provide: EnvioSms, useClass: EnvioSmsLog },
  ],
  exports: [EnvioEmail, EnvioEmailMemoria, EnvioSms, SegundoPlano],
})
export class NotificacoesModule {}
