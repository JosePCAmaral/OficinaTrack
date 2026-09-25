import { readFileSync } from 'node:fs';
import { TenantViolacaoError } from '../common/tenant/tenant-context.js';
import { aplicarTenant } from './extensao-tenant.js';
import { MODELOS_COM_TENANT } from './modelos-tenant.js';
import { CRIACAO_ANINHADA_PERMITIDA, RELACOES_TENANT } from './relacoes-tenant.js';

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
  it('bate com os models do schema que têm oficinaId obrigatório', () => {
    const schema = readFileSync(new URL('../../prisma/schema.prisma', import.meta.url), 'utf8');
    // `String` sem `?`: um model global pode ter um `oficinaId String?` opcional apontando
    // PARA uma oficina (ex.: `CodigoPiloto`) sem ser, ele mesmo, um model com tenant.
    const comOficinaId = [...schema.matchAll(/model (\w+) \{([^}]*)\}/g)]
      .filter(([, , corpo]) => /^\s*oficinaId\s+String(?!\?)/m.test(corpo ?? ''))
      .map(([, nome]) => nome);
    expect(new Set(comOficinaId)).toEqual(MODELOS_COM_TENANT);
  });
});

const criarClienteCom = (veiculos: unknown) =>
  aplicarTenant('Cliente', 'oficinaId', 'create', { data: { telefone: 'x', veiculos } }, 'of-a');

describe('escrita por relação (achado #1 da auditoria)', () => {
  const OPERADORES_PROIBIDOS = [
    'connect',
    'connectOrCreate',
    'set',
    'disconnect',
    'update',
    'updateMany',
    'upsert',
    'delete',
    'deleteMany',
  ];

  it.each(OPERADORES_PROIBIDOS)('update com %s aninhado é recusado', (op) => {
    expect(() =>
      aplicarTenant('Cliente', 'oficinaId', 'update', { where: { id: 'c1' }, data: { veiculos: { [op]: { id: 'v-b' } } } }, 'of-a'),
    ).toThrow(TenantViolacaoError);
  });

  it.each(OPERADORES_PROIBIDOS)('%s aninhado também é recusado a partir da Oficina', (op) => {
    expect(() =>
      aplicarTenant('Oficina', 'id', 'update', { where: { id: 'of-a' }, data: { clientes: { [op]: { id: 'c-b' } } } }, 'of-a'),
    ).toThrow(TenantViolacaoError);
  });

  it.each(['connect', 'connectOrCreate', 'create'])('create com %s em relação "para cima" (pai) é recusado', (op) => {
    expect(() =>
      aplicarTenant('Veiculo', 'oficinaId', 'create', { data: { placa: 'ABC1234', cliente: { [op]: { id: 'c-b' } } } }, 'of-a'),
    ).toThrow(TenantViolacaoError);
  });

  it.each([
    ['create', { data: { telefone: 'x', oficina: { connect: { id: 'of-b' } } } }],
    ['createMany', { data: [{ telefone: 'x', oficina: { connect: { id: 'of-b' } } }] }],
    ['createManyAndReturn', { data: [{ telefone: 'x', oficina: { connect: { id: 'of-b' } } }] }],
    ['update', { where: { id: 'c1' }, data: { oficina: { connect: { id: 'of-b' } } } }],
    ['updateMany', { where: {}, data: { oficina: { connect: { id: 'of-b' } } } }],
    ['updateManyAndReturn', { where: {}, data: { oficina: { connect: { id: 'of-b' } } } }],
    ['upsert', { where: { id: 'c1' }, create: { telefone: 'x', oficina: { connect: { id: 'of-b' } } }, update: {} }],
    ['upsert', { where: { id: 'c1' }, create: { telefone: 'x' }, update: { oficina: { connect: { id: 'of-b' } } } }],
  ])('a chave oficina é sempre recusada (%s)', (op, args) => {
    expect(() => aplicarTenant('Cliente', 'oficinaId', op, args, 'of-a')).toThrow(TenantViolacaoError);
  });

  it('upsert.update com connect é recusado', () => {
    expect(() =>
      aplicarTenant(
        'Veiculo',
        'oficinaId',
        'upsert',
        { where: { id: 'v1' }, create: { placa: 'ABC1234', clienteId: 'c1' }, update: { cliente: { connect: { id: 'c-b' } } } },
        'of-a',
      ),
    ).toThrow(TenantViolacaoError);
  });

  it('create aninhado em filho com FK composta é permitido e recursivo', () => {
    const data = {
      telefone: 'x',
      veiculos: { create: [{ placa: 'ABC1234', ordensServico: { create: { numero: 1, relatoCliente: 'freio' } } }] },
    };
    expect(aplicarTenant('Cliente', 'oficinaId', 'create', { data }, 'of-a').data).toEqual({ ...data, oficinaId: 'of-a' });
  });

  it('createMany aninhado em filho com FK composta é permitido (também no update)', () => {
    const args = { where: { id: 'c1' }, data: { veiculos: { createMany: { data: [{ placa: 'ABC1234' }] } } } };
    expect(() => aplicarTenant('Cliente', 'oficinaId', 'update', args, 'of-a')).not.toThrow();
  });

  it('dentro do create aninhado valem as mesmas regras', () => {
    expect(() => criarClienteCom({ create: { placa: 'ABC1234', ordensServico: { connect: { id: 'os-b' } } } })).toThrow(TenantViolacaoError);
    expect(() => criarClienteCom({ createMany: { data: [{ placa: 'ABC1234', oficina: { connect: { id: 'of-b' } } }] } })).toThrow(
      TenantViolacaoError,
    );
    expect(() => criarClienteCom({ create: { placa: 'ABC1234', oficinaId: 'of-b' } })).toThrow(TenantViolacaoError);
  });

  it('create aninhado a partir da Oficina é recusado (FK simples para Oficina, não composta)', () => {
    expect(() =>
      aplicarTenant('Oficina', 'id', 'update', { where: { id: 'of-a' }, data: { clientes: { create: { telefone: 'x' } } } }, 'of-a'),
    ).toThrow(TenantViolacaoError);
  });

  it('relação com valor que não é objeto falha fechada', () => {
    expect(() => aplicarTenant('Cliente', 'oficinaId', 'update', { where: { id: 'c1' }, data: { veiculos: null } }, 'of-a')).toThrow(
      TenantViolacaoError,
    );
  });

  it('campos Json com formato de relação não são confundidos com relação', () => {
    const data = { ordemServicoId: 'os1', itens: [{ connect: 'estepe' }], avarias: { connect: { id: 'x' } } };
    expect(aplicarTenant('ChecklistEntrada', 'oficinaId', 'create', { data }, 'of-a').data).toEqual({ ...data, oficinaId: 'of-a' });
  });

  it('FKs escalares continuam permitidas', () => {
    expect(() =>
      aplicarTenant('OrdemServico', 'oficinaId', 'update', { where: { id: 'os1' }, data: { responsavelId: null, clienteId: 'c1' } }, 'of-a'),
    ).not.toThrow();
  });
});

const nomeRelacao = (atributos: string) => /@relation\("(\w+)"/.exec(atributos)?.[1];

type CampoSchema = { nome: string; tipo: string; atributos: string };

function lerSchema(): Map<string, CampoSchema[]> {
  const schema = readFileSync(new URL('../../prisma/schema.prisma', import.meta.url), 'utf8');
  const modelos = new Map<string, CampoSchema[]>();
  for (const [, nome = '', corpo = ''] of schema.matchAll(/model (\w+) \{([^}]*)\}/g)) {
    const campos = corpo
      .split('\n')
      .map((l) => l.replace(/\/\/.*$/, '').trim())
      .filter((l) => l && !l.startsWith('@@'))
      .map((l) => {
        const [campo = '', tipo = '', ...resto] = l.split(/\s+/);
        return { nome: campo, tipo: tipo.replace(/[?[\]]/g, ''), atributos: resto.join(' ') };
      });
    modelos.set(nome, campos);
  }
  return modelos;
}

describe('mapa de relações com tenant', () => {
  const modelos = lerSchema();
  // Escopo dos dois testes de sincronia abaixo: Oficina + models com tenant. Models GLOBAIS
  // (ex.: `CodigoPiloto`, sem `oficinaId`) ficam fora de propósito: `RELACOES_TENANT` e
  // `CRIACAO_ANINHADA_PERMITIDA` existem para a extensão de tenant, que nem intercepta as
  // operações de um model global (`campoTenant` devolve `null`). `CodigoPiloto` continua
  // reconhecido como TIPO de campo (para o filtro `modelos.has(c.tipo)` abaixo), só não vira
  // uma entrada própria no mapa — daí `modelosComEntradaNoMapa` em vez de `modelos` no loop.
  const modelosComEntradaNoMapa = new Set(['Oficina', ...MODELOS_COM_TENANT]);

  it('bate com os campos de relação do schema (Oficina + models com tenant)', () => {
    const esperado: Record<string, Record<string, string>> = {};
    for (const [modelo, campos] of modelos) {
      if (!modelosComEntradaNoMapa.has(modelo)) continue;
      esperado[modelo] = Object.fromEntries(campos.filter((c) => modelos.has(c.tipo)).map((c) => [c.nome, c.tipo]));
    }
    expect(RELACOES_TENANT).toEqual(esperado);
  });

  it('cobre Oficina e todos os models com tenant', () => {
    expect(new Set(Object.keys(RELACOES_TENANT))).toEqual(new Set(['Oficina', ...MODELOS_COM_TENANT]));
  });

  it('create aninhado só nas relações cujo filho usa FK composta (oficinaId, xId)', () => {
    const esperado: Record<string, Set<string>> = {};
    for (const [modelo, campos] of modelos) {
      if (!modelosComEntradaNoMapa.has(modelo)) continue;
      esperado[modelo] = new Set(
        campos
          // lado "filho" da relação: sem `fields:` neste model
          .filter((c) => modelos.has(c.tipo) && !c.atributos.includes('fields:'))
          .filter((c) => {
            const nome = nomeRelacao(c.atributos);
            const ladoDoFilho = (modelos.get(c.tipo) ?? []).find(
              (f) => f.tipo === modelo && f.atributos.includes('fields:') && nomeRelacao(f.atributos) === nome,
            );
            return /fields: \[oficinaId, \w+\]/.test(ladoDoFilho?.atributos ?? '');
          })
          .map((c) => c.nome),
      );
    }
    const atual = Object.fromEntries(Object.entries(CRIACAO_ANINHADA_PERMITIDA).map(([m, s]) => [m, new Set(s)]));
    expect(atual).toEqual(esperado);
  });
});
