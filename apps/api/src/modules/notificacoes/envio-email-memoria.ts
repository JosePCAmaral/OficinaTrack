import { Injectable } from '@nestjs/common';
import { EnvioEmail, type MensagemEmail } from './envio-email.js';

/** Usado nos testes (EMAIL_TRANSPORTE=memoria): guarda as mensagens em vez de enviar. */
@Injectable()
export class EnvioEmailMemoria extends EnvioEmail {
  readonly enviados: MensagemEmail[] = [];

  async enviar(mensagem: MensagemEmail): Promise<void> {
    this.enviados.push(mensagem);
  }

  ultimoPara(email: string): MensagemEmail | undefined {
    return this.enviados.filter((m) => m.para === email).at(-1);
  }
}
