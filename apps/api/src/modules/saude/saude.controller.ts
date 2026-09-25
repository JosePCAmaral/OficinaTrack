import { Controller, Get } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';

@Controller('saude')
export class SaudeController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async verificar(): Promise<{ status: 'ok'; banco: 'ok' }> {
    await this.prisma.db.$queryRaw`SELECT 1`;
    return { status: 'ok', banco: 'ok' };
  }
}
