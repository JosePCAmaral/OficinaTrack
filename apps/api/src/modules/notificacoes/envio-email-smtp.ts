import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import nodemailer, { type Transporter } from 'nodemailer';
import type { Env } from '../../config/env.js';
import { EnvioEmail, type MensagemEmail } from './envio-email.js';

@Injectable()
export class EnvioEmailSmtp extends EnvioEmail {
  private readonly transporte: Transporter;
  private readonly remetente: string;

  constructor(config: ConfigService<Env, true>) {
    super();
    const usuario = config.get('SMTP_USUARIO', { infer: true });
    this.transporte = nodemailer.createTransport({
      host: config.get('SMTP_HOST', { infer: true }),
      port: config.get('SMTP_PORTA', { infer: true }),
      secure: config.get('SMTP_SEGURO', { infer: true }),
      auth: usuario ? { user: usuario, pass: config.get('SMTP_SENHA', { infer: true }) } : undefined,
    });
    this.remetente = config.get('EMAIL_REMETENTE', { infer: true });
  }

  async enviar({ para, assunto, texto, html }: MensagemEmail): Promise<void> {
    await this.transporte.sendMail({ from: this.remetente, to: para, subject: assunto, text: texto, html });
  }
}
