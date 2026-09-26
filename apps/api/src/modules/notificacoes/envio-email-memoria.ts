import { Injectable } from '@nestjs/common';
import { EnvioEmail, type MensagemEmail } from './envio-email.js';
import { SegundoPlano } from './segundo-plano.js';

/** Usado nos testes (EMAIL_TRANSPORTE=memoria): guarda as mensagens em vez de enviar. */
@Injectable()
export class EnvioEmailMemoria extends EnvioEmail {
  readonly enviados: MensagemEmail[] = [];

  constructor(private readonly segundoPlano: SegundoPlano) {
    super();
  }

  async enviar(mensagem: MensagemEmail): Promise<void> {
    this.enviados.push(mensagem);
  }

  ultimoPara(email: string): MensagemEmail | undefined {
    return this.enviados.filter((m) => m.para === email).at(-1);
  }

  /** "Esqueci a senha" e "reenviar confirmação" enviam depois da resposta: os testes esperam aqui antes de ler `enviados`. */
  aguardarPendentes(): Promise<void> {
    return this.segundoPlano.aguardar();
  }
}
