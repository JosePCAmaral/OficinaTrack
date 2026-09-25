import { Controller, Get, Logger } from '@nestjs/common';
import { ErroNegocio } from '../../common/erros/erro-negocio.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { Publico } from '../auth/decorators.js';

@Controller('saude')
export class SaudeController {
  private readonly logger = new Logger(SaudeController.name);

  constructor(private readonly prisma: PrismaService) {}

  @Publico()
  @Get()
  async verificar(): Promise<{ status: 'ok'; banco: 'ok' }> {
    try {
      await this.prisma.db.$queryRaw`SELECT 1`;
    } catch (erro) {
      // só o nome do erro: a mensagem do driver/ORM pode trazer detalhes de conexão
      this.logger.error(`Banco indisponível: ${erro instanceof Error ? erro.name : 'erro desconhecido'}`);
      throw new ErroNegocio(503, 'SERVICO_INDISPONIVEL', 'Banco de dados indisponível');
    }
    return { status: 'ok', banco: 'ok' };
  }
}
