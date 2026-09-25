import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client.js';
import type { Env } from '../config/env.js';
import { TenantContext } from '../common/tenant/tenant-context.js';
import { extensaoTenant } from './extensao-tenant.js';

function criarCliente(databaseUrl: string, tenant: TenantContext) {
  const base = new PrismaClient({ adapter: new PrismaPg({ connectionString: databaseUrl }) });
  return { base, db: base.$extends(extensaoTenant(tenant)) };
}

@Injectable()
export class PrismaService implements OnModuleDestroy {
  private readonly base: PrismaClient;
  /** Único acesso ao banco. Filtra por oficina automaticamente. */
  readonly db: ReturnType<typeof criarCliente>['db'];

  constructor(config: ConfigService<Env, true>, tenant: TenantContext) {
    const { base, db } = criarCliente(config.get('DATABASE_URL', { infer: true }), tenant);
    this.base = base;
    this.db = db;
  }

  async onModuleDestroy(): Promise<void> {
    await this.base.$disconnect();
  }
}
