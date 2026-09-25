import { PipeTransform } from '@nestjs/common';
import type { z } from 'zod';
import { ErroNegocio } from '../erros/erro-negocio.js';

export class ZodValidationPipe<T extends z.ZodType> implements PipeTransform<unknown, z.output<T>> {
  constructor(private readonly schema: T) {}

  transform(valor: unknown): z.output<T> {
    const resultado = this.schema.safeParse(valor);
    if (!resultado.success) {
      throw new ErroNegocio(
        400,
        'VALIDACAO_FALHOU',
        'Dados inválidos',
        resultado.error.issues.map((i) => ({ campo: i.path.join('.'), mensagem: i.message })),
      );
    }
    return resultado.data;
  }
}
