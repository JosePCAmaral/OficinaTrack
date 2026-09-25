export type MensagemEmail = { para: string; assunto: string; texto: string; html: string };
export abstract class EnvioEmail {
  abstract enviar(mensagem: MensagemEmail): Promise<void>;
}
