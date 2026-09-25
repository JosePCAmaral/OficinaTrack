import { Global, Module } from '@nestjs/common';
import { TenantModule } from '../common/tenant/tenant.module.js';
import { PrismaService } from './prisma.service.js';

@Global()
@Module({ imports: [TenantModule], providers: [PrismaService], exports: [PrismaService] })
export class PrismaModule {}
