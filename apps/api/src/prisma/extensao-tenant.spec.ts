import { readFileSync } from 'node:fs';
import { TenantViolacaoError } from '../common/tenant/tenant-context.js';
import { aplicarTenant } from './extensao-tenant.js';
import { MODELOS_COM_TENANT } from './modelos-tenant.js';

describe('aplicarTenant', () => {
  it('acrescenta o filtro de oficina sem apagar o where original', () => {
    const args = aplicarTenant('Cliente', 'oficinaId', 'findMany', { where: { nome: 'Ana', AND: [{ ativo: true }] } }, 'of-a');
    expect(args.where).toEqual({ nome: 'Ana', AND: [{ ativo: true }, { oficinaId: 'of-a' }] });
  });

  it('aceita AND como objeto único', () => {
    const args = aplicarTenant('Cliente', 'oficinaId', 'findFirst', { where: { AND: { nome: 'Ana' } } }, 'of-a');
    expect(args.where).toEqual({ AND: [{ nome: 'Ana' }, { oficinaId: 'of-a' }] });
  });

  it('filtra Oficina pelo id', () => {
    const args = aplicarTenant('Oficina', 'id', 'findUnique', { where: { id: 'of-b' } }, 'of-a');
    expect(args.where).toEqual({ id: 'of-b', AND: [{ id: 'of-a' }] });
  });

  it('força oficinaId no create e no createMany', () => {
    expect(aplicarTenant('Cliente', 'oficinaId', 'create', { data: { oficinaId: 'of-b', telefone: 'x' } }, 'of-a').data)
      .toEqual({ oficinaId: 'of-a', telefone: 'x' });
    expect(aplicarTenant('Cliente', 'oficinaId', 'createMany', { data: [{ telefone: 'x' }, { telefone: 'y' }] }, 'of-a').data)
      .toEqual([{ telefone: 'x', oficinaId: 'of-a' }, { telefone: 'y', oficinaId: 'of-a' }]);
  });

  it('upsert filtra o where e força a oficina no create', () => {
    const args = aplicarTenant('Cliente', 'oficinaId', 'upsert', { where: { id: 'c1' }, create: { telefone: 'x' }, update: {} }, 'of-a');
    expect(args.where).toEqual({ id: 'c1', AND: [{ oficinaId: 'of-a' }] });
    expect(args.create).toEqual({ telefone: 'x', oficinaId: 'of-a' });
  });

  it.each(['update', 'updateMany', 'updateManyAndReturn'])('%s não pode trocar a oficina (Review Focus 3)', (op) => {
    expect(() => aplicarTenant('Cliente', 'oficinaId', op, { where: {}, data: { oficinaId: 'of-b' } }, 'of-a'))
      .toThrow(TenantViolacaoError);
  });

  it('upsert não pode trocar a oficina no update', () => {
    expect(() => aplicarTenant('Cliente', 'oficinaId', 'upsert', { where: { id: 'c1' }, create: {}, update: { oficinaId: 'of-b' } }, 'of-a'))
      .toThrow(TenantViolacaoError);
  });

  it('operação desconhecida falha fechada (Review Focus 2)', () => {
    expect(() => aplicarTenant('Cliente', 'oficinaId', 'operacaoNova', {}, 'of-a')).toThrow(/não suportada/);
  });
});

describe('lista de models com tenant', () => {
  it('bate com os models do schema que têm oficinaId', () => {
    const schema = readFileSync(new URL('../../prisma/schema.prisma', import.meta.url), 'utf8');
    const comOficinaId = [...schema.matchAll(/model (\w+) \{([^}]*)\}/g)]
      .filter(([, , corpo]) => /^\s*oficinaId\s+String/m.test(corpo ?? ''))
      .map(([, nome]) => nome);
    expect(new Set(comOficinaId)).toEqual(MODELOS_COM_TENANT);
  });
});
