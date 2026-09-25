import { HttpException } from '@nestjs/common';

export type CorpoErro = { statusCode: number; code: string; message: string; details?: unknown };

export class ErroNegocio extends HttpException {
  constructor(statusCode: number, readonly code: string, message: string, readonly details?: unknown) {
    super({ statusCode, code, message, details }, statusCode);
  }

  corpo(): CorpoErro {
    const corpo: CorpoErro = { statusCode: this.getStatus(), code: this.code, message: this.message };
    if (this.details !== undefined) corpo.details = this.details;
    return corpo;
  }
}
