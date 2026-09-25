import { Global, Module } from '@nestjs/common';
import { ClsModule } from 'nestjs-cls';
import { TenantContext } from './tenant-context.js';

@Global()
@Module({
  imports: [ClsModule.forRoot({ global: true, middleware: { mount: true } })],
  providers: [TenantContext],
  exports: [TenantContext],
})
export class TenantModule {}
