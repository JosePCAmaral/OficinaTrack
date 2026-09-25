import { Test, TestingModule } from '@nestjs/testing';
import { ClsService } from 'nestjs-cls';
import { TenantContext } from './tenant-context.js';
import { TenantModule } from './tenant.module.js';

describe('TenantContext.definirOficina (achado #3 da auditoria)', () => {
  let modulo: TestingModule;
  let tenant: TenantContext;

  beforeAll(async () => {
    modulo = await Test.createTestingModule({ imports: [TenantModule] }).compile();
    tenant = modulo.get(TenantContext);
  });
  afterAll(() => modulo.close());

  it('dentro de executarSemTenant lança erro e mantém o contexto sem oficina', async () => {
    await tenant.executarSemTenant(async () => {
      expect(() => tenant.definirOficina('of-a')).toThrow(/executarSemTenant/);
      expect(tenant.oficinaId()).toBeUndefined();
    });
  });

  it('não sobrescreve uma oficina diferente já definida', async () => {
    await tenant.executarComo('of-a', async () => {
      expect(() => tenant.definirOficina('of-b')).toThrow(/já definida/);
      expect(tenant.oficinaId()).toBe('of-a');
    });
  });

  it('definir a mesma oficina de novo é no-op', async () => {
    await tenant.executarComo('of-a', async () => {
      expect(() => tenant.definirOficina('of-a')).not.toThrow();
      expect(tenant.oficinaId()).toBe('of-a');
      expect(tenant.ignorandoTenant()).toBe(false);
    });
  });

  it('em contexto CLS sem oficina, define e passa a filtrar', async () => {
    // contexto CLS "limpo", como o criado pelo middleware por requisição
    const vista = await modulo.get(ClsService).run(async () => {
      tenant.definirOficina('of-a');
      return { oficina: tenant.oficinaId(), ignorando: tenant.ignorandoTenant() };
    });
    expect(vista).toEqual({ oficina: 'of-a', ignorando: false });
  });

  it('fora de contexto CLS ativo lança erro', () => {
    expect(() => tenant.definirOficina('of-a')).toThrow();
  });
});
