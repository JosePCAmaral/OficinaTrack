import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client.js';
import type { Env } from '../config/env.js';

@Injectable()
export class PrismaService implements OnModuleDestroy {
  private readonly cliente: PrismaClient;
  readonly db: PrismaClient;

  constructor(config: ConfigService<Env, true>) {
    this.cliente = new PrismaClient({
      adapter: new PrismaPg({ connectionString: config.get('DATABASE_URL', { infer: true }) }),
    });
    this.db = this.cliente;
  }

  async onModuleDestroy(): Promise<void> {
    await this.cliente.$disconnect();
  }
}
