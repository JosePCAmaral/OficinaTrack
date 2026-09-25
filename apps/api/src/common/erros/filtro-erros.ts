import { ArgumentsHost, Catch, ExceptionFilter, HttpException, Logger } from '@nestjs/common';
import type { Response } from 'express';
import { Prisma } from '../../generated/prisma/client.js';
import { TenantAusenteError, TenantViolacaoError } from '../tenant/tenant-context.js';
import { CorpoErro, ErroNegocio } from './erro-negocio.js';

const CODIGOS_HTTP: Record<number, [string, string]> = {
  400: ['REQUISICAO_INVALIDA', 'Requisição inválida'],
  401: ['NAO_AUTENTICADO', 'Não autenticado'],
  403: ['SEM_PERMISSAO', 'Sem permissão'],
  404: ['RECURSO_NAO_ENCONTRADO', 'Recurso não encontrado'],
  409: ['CONFLITO', 'Conflito'],
  413: ['CORPO_MUITO_GRANDE', 'Requisição muito grande'],
  429: ['MUITAS_REQUISICOES', 'Muitas requisições. Tente de novo em instantes'],
};

const CLASSES_ERRO_PRISMA = [
  Prisma.PrismaClientKnownRequestError,
  Prisma.PrismaClientUnknownRequestError,
  Prisma.PrismaClientRustPanicError,
  Prisma.PrismaClientInitializationError,
  Prisma.PrismaClientValidationError,
];

const ehErroPrisma = (erro: unknown): erro is Error => CLASSES_ERRO_PRISMA.some((Classe) => erro instanceof Classe);

/**
 * O que vai para o log de um 5xx.
 * - Erros do Prisma: só `name`, `code` e `meta.modelName`. A `message` (e o stack, que a
 *   repete) pode trazer os argumentos da consulta, ou seja, dados pessoais (LGPD/T7).
 * - Erros de tenant: `name` e `message` (só model e operação), sem stack.
 * - Demais: stack completo.
 */
function paraLog(erro: unknown): string {
  if (ehErroPrisma(erro)) {
    const { code, meta } = erro as { code?: unknown; meta?: { modelName?: unknown } };
    const partes = [erro.name];
    if (typeof code === 'string') partes.push(`code=${code}`);
    if (typeof meta?.modelName === 'string') partes.push(`model=${meta.modelName}`);
    return partes.join(' ');
  }
  if (erro instanceof TenantAusenteError || erro instanceof TenantViolacaoError) return `${erro.name}: ${erro.message}`;
  return erro instanceof Error ? (erro.stack ?? `${erro.name}: ${erro.message}`) : String(erro);
}

@Catch()
export class FiltroErros implements ExceptionFilter {
  private readonly logger = new Logger(FiltroErros.name);

  catch(erro: unknown, host: ArgumentsHost): void {
    const corpo = this.converter(erro);
    if (corpo.statusCode >= 500) this.logger.error(paraLog(erro));
    host.switchToHttp().getResponse<Response>().status(corpo.statusCode).json(corpo);
  }

  converter(erro: unknown): CorpoErro {
    if (erro instanceof ErroNegocio) return erro.corpo();
    if (erro instanceof Prisma.PrismaClientKnownRequestError) {
      if (erro.code === 'P2025') return { statusCode: 404, code: 'RECURSO_NAO_ENCONTRADO', message: 'Recurso não encontrado' };
      // sem ecoar campos nem valores (a constraint pode revelar o que já existe)
      if (erro.code === 'P2002') return { statusCode: 409, code: 'CONFLITO', message: 'Registro já existe' };
    }
    if (erro instanceof HttpException) {
      const status = erro.getStatus();
      const [code, message] = CODIGOS_HTTP[status] ?? ['ERRO_HTTP', 'Erro na requisição'];
      return { statusCode: status, code, message };
    }
    // TenantAusenteError/TenantViolacaoError caem aqui de propósito: 500 (falha fechada)
    return { statusCode: 500, code: 'ERRO_INTERNO', message: 'Erro interno' };
  }
}
