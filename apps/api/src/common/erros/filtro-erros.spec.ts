import { Logger, NotFoundException } from '@nestjs/common';
import { ThrottlerException } from '@nestjs/throttler';
import { Prisma } from '../../generated/prisma/client.js';
import { TenantAusenteError, TenantViolacaoError } from '../tenant/tenant-context.js';
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
    const erro = new Prisma.PrismaClientKnownRequestError('Transaction failed due to a write conflict', { code: 'P2034', clientVersion: '7.10.0' });
    expect(filtro.converter(erro)).toEqual({ statusCode: 500, code: 'ERRO_INTERNO', message: 'Erro interno' });
  });

  it('P2002 vira 409 CONFLITO sem ecoar campos nem valores', () => {
    const erro = new Prisma.PrismaClientKnownRequestError('Unique constraint failed on telefone +5543912345678', {
      code: 'P2002',
      clientVersion: '7.10.0',
      meta: { modelName: 'Cliente', target: ['oficinaId', 'telefone'] },
    });
    expect(filtro.converter(erro)).toEqual({ statusCode: 409, code: 'CONFLITO', message: 'Registro já existe' });
  });

  it('erros de tenant continuam 500 (falha fechada)', () => {
    expect(filtro.converter(new TenantViolacaoError('Cliente.oficina', 'update')).statusCode).toBe(500);
    expect(filtro.converter(new TenantAusenteError('Cliente', 'findMany')).statusCode).toBe(500);
  });
});

/** Linha de stack trace ("\n    at ..."). */
const PILHA = /\n\s+at /;

describe('FiltroErros: log sem dados pessoais (achado #5 da auditoria)', () => {
  const PESSOAL = '+5543912345678';
  let logado: string[];

  beforeEach(() => {
    logado = [];
    vi.spyOn(Logger.prototype, 'error').mockImplementation((...args: unknown[]) => {
      logado.push(args.map((a) => (typeof a === 'string' ? a : JSON.stringify(a))).join(' '));
    });
  });
  afterEach(() => vi.restoreAllMocks());

  const registrar = (erro: unknown) => {
    const res = { status: () => res, json: () => res };
    new FiltroErros().catch(erro, { switchToHttp: () => ({ getResponse: () => res }) } as never);
    return logado.join('\n');
  };

  it.each([
    ['PrismaClientValidationError', new Prisma.PrismaClientValidationError(`Invalid call: telefone: "${PESSOAL}"`, { clientVersion: '7.10.0' })],
    ['PrismaClientUnknownRequestError', new Prisma.PrismaClientUnknownRequestError(`falhou com ${PESSOAL}`, { clientVersion: '7.10.0' })],
    [
      'PrismaClientKnownRequestError',
      new Prisma.PrismaClientKnownRequestError(`falhou com ${PESSOAL}`, { code: 'P2034', clientVersion: '7.10.0', meta: { modelName: 'Cliente' } }),
    ],
  ])('%s: loga só name, code e meta.modelName', (nome, erro) => {
    const texto = registrar(erro);
    expect(texto).toContain(nome);
    expect(texto).not.toContain(PESSOAL);
    expect(texto).not.toMatch(PILHA);
  });

  it('inclui code e modelName quando existem', () => {
    const erro = new Prisma.PrismaClientKnownRequestError(`x ${PESSOAL}`, { code: 'P2034', clientVersion: '7.10.0', meta: { modelName: 'Cliente' } });
    const texto = registrar(erro);
    expect(texto).toContain('P2034');
    expect(texto).toContain('Cliente');
  });

  it('P2002 não gera log de erro', () => {
    registrar(new Prisma.PrismaClientKnownRequestError('dup', { code: 'P2002', clientVersion: '7.10.0' }));
    expect(logado).toEqual([]);
  });

  it('erro de tenant é logado sem stack', () => {
    const texto = registrar(new TenantViolacaoError('Cliente.oficina', 'update'));
    expect(texto).toContain('TenantViolacaoError');
    expect(texto).not.toMatch(PILHA);
  });

  it('outros 5xx mantêm o stack', () => {
    expect(registrar(new Error('bug qualquer'))).toMatch(PILHA);
  });
});
