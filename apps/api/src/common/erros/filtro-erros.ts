import { ArgumentsHost, Catch, ExceptionFilter, HttpException, Logger } from '@nestjs/common';
import type { Response } from 'express';
import { Prisma } from '../../generated/prisma/client.js';
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

@Catch()
export class FiltroErros implements ExceptionFilter {
  private readonly logger = new Logger(FiltroErros.name);

  catch(erro: unknown, host: ArgumentsHost): void {
    const corpo = this.converter(erro);
    if (corpo.statusCode >= 500) {
      this.logger.error(erro instanceof Error ? erro.stack : String(erro));
    }
    host.switchToHttp().getResponse<Response>().status(corpo.statusCode).json(corpo);
  }

  converter(erro: unknown): CorpoErro {
    if (erro instanceof ErroNegocio) return erro.corpo();
    if (erro instanceof Prisma.PrismaClientKnownRequestError && erro.code === 'P2025') {
      return { statusCode: 404, code: 'RECURSO_NAO_ENCONTRADO', message: 'Recurso não encontrado' };
    }
    if (erro instanceof HttpException) {
      const status = erro.getStatus();
      const [code, message] = CODIGOS_HTTP[status] ?? ['ERRO_HTTP', 'Erro na requisição'];
      return { statusCode: status, code, message };
    }
    return { statusCode: 500, code: 'ERRO_INTERNO', message: 'Erro interno' };
  }
}
