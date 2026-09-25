import { Injectable, Logger } from '@nestjs/common';

export abstract class EnvioSms {
  abstract enviar(telefoneE164: string, texto: string): Promise<void>;
}

/** SMS está fora do MVP: só registra que haveria um envio (sem o número nem o texto). */
@Injectable()
export class EnvioSmsLog extends EnvioSms {
  private readonly logger = new Logger('EnvioSms');
  async enviar(): Promise<void> {
    this.logger.log('SMS não enviado: canal desligado no MVP');
  }
}
