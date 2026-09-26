import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import nodemailer, { type Transporter } from 'nodemailer';
import type { Env } from '../../config/env.js';
import { EnvioEmail, type MensagemEmail } from './envio-email.js';

const TIMEOUT_SMTP_MS = 10_000;

@Injectable()
export class EnvioEmailSmtp extends EnvioEmail {
  private readonly transporte: Transporter;
  private readonly remetente: string;

  constructor(config: ConfigService<Env, true>) {
    super();
    const usuario = config.get('SMTP_USUARIO', { infer: true });
    const seguro = config.get('SMTP_SEGURO', { infer: true });
    this.transporte = nodemailer.createTransport({
      host: config.get('SMTP_HOST', { infer: true }),
      port: config.get('SMTP_PORTA', { infer: true }),
      secure: seguro,
      // em produção, sem TLS implícito (465), exige STARTTLS: um MITM não consegue rebaixar para texto claro (auditoria #15)
      requireTLS: !seguro && config.get('NODE_ENV', { infer: true }) === 'production',
      // um SMTP travado não segura a requisição (cadastro e convite esperam o envio)
      connectionTimeout: TIMEOUT_SMTP_MS,
      greetingTimeout: TIMEOUT_SMTP_MS,
      socketTimeout: TIMEOUT_SMTP_MS,
      auth: usuario ? { user: usuario, pass: config.get('SMTP_SENHA', { infer: true }) } : undefined,
    });
    this.remetente = config.get('EMAIL_REMETENTE', { infer: true });
  }

  async enviar({ para, assunto, texto, html }: MensagemEmail): Promise<void> {
    await this.transporte.sendMail({ from: this.remetente, to: para, subject: assunto, text: texto, html });
  }
}
