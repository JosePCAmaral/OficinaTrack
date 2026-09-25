import { NotFoundException } from '@nestjs/common';
import { ThrottlerException } from '@nestjs/throttler';
import { Prisma } from '../../generated/prisma/client.js';
import { ErroNegocio } from './erro-negocio.js';
import { FiltroErros } from './filtro-erros.js';

describe('FiltroErros.converter', () => {
  const filtro = new FiltroErros();

  it('mantém o código do erro de negócio', () => {
    const corpo = filtro.converter(new ErroNegocio(422, 'OS_STATUS_INVALIDO', 'Transição inválida', { de: 'ENTREGUE' }));
    expect(corpo).toEqual({ statusCode: 422, code: 'OS_STATUS_INVALIDO', message: 'Transição inválida', details: { de: 'ENTREGUE' } });
  });

  it('converte 404 do Nest', () => {
    expect(filtro.converter(new NotFoundException())).toEqual({
      statusCode: 404, code: 'RECURSO_NAO_ENCONTRADO', message: 'Recurso não encontrado',
    });
  });

  it('converte rate limit', () => {
    expect(filtro.converter(new ThrottlerException()).code).toBe('MUITAS_REQUISICOES');
  });

  it('esconde detalhes de erro inesperado', () => {
    const corpo = filtro.converter(new Error('senha do banco: xyz'));
    expect(corpo).toEqual({ statusCode: 500, code: 'ERRO_INTERNO', message: 'Erro interno' });
    expect(JSON.stringify(corpo)).not.toContain('xyz');
  });

  it('converte registro não encontrado do Prisma em 404', () => {
    const erro = new Prisma.PrismaClientKnownRequestError('No record found', { code: 'P2025', clientVersion: '7.10.0' });
    expect(filtro.converter(erro).statusCode).toBe(404);
  });

  it('esconde erro desconhecido do Prisma (Review Focus 5)', () => {
    const erro = new Prisma.PrismaClientKnownRequestError('Unique constraint failed on oficinaId', { code: 'P2002', clientVersion: '7.10.0' });
    expect(filtro.converter(erro)).toEqual({ statusCode: 500, code: 'ERRO_INTERNO', message: 'Erro interno' });
  });
});
