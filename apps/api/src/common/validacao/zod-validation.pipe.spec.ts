import { z } from 'zod';
import { placaSchema } from '@oficinatrack/shared';
import { ErroNegocio } from '../erros/erro-negocio.js';
import { ZodValidationPipe } from './zod-validation.pipe.js';

const pipe = new ZodValidationPipe(z.object({ placa: placaSchema, km: z.number().int().optional() }));

describe('ZodValidationPipe', () => {
  it('devolve o dado já normalizado', () => {
    expect(pipe.transform({ placa: 'abc-1234' })).toEqual({ placa: 'ABC1234' });
  });

  it('lança VALIDACAO_FALHOU com os campos', () => {
    // As assertions dependem da forma do erro capturado, então precisam ficar no catch.
    /* oxlint-disable vitest/no-conditional-expect */
    try {
      pipe.transform({ placa: 'x', km: 1.5 });
      expect.unreachable();
    } catch (e) {
      expect(e).toBeInstanceOf(ErroNegocio);
      const corpo = (e as ErroNegocio).corpo();
      expect(corpo.statusCode).toBe(400);
      expect(corpo.code).toBe('VALIDACAO_FALHOU');
      expect(corpo.details).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ campo: 'placa', mensagem: 'Placa inválida' }),
          expect.objectContaining({ campo: 'km' }),
        ]),
      );
    }
    /* oxlint-enable vitest/no-conditional-expect */
  });
});
