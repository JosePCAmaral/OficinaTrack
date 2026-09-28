# Sprint 3 — OS rápida: plano de implementação

> **Para agentes:** SUB-SKILL OBRIGATÓRIA: use superpowers:subagent-driven-development (recomendado) ou superpowers:executing-plans para executar este plano tarefa por tarefa. Os passos usam checkbox (`- [ ]`).

**Objetivo:** abrir OS em menos de 1 minuto pelo celular (placa + WhatsApp + queixa), buscar clientes e carros, e registrar na OS notas internas e atualizações para o cliente, separadas.

**Arquitetura:** três módulos novos na API (`clientes`, `veiculos`, `ordens-servico`). O `OrdensServicoService` coordena a abertura numa transação usando os services públicos de `clientes`, `veiculos`, `oficinas` e `usuarios` (cada um aceita um `tx` opcional, padrão já usado no cadastro da Sprint 2). Listas paginadas por cursor. No web, quatro features novas (`os`, `clientes`, `veiculos`, `busca`) reusando os schemas de `packages/shared`.

**Stack:** a mesma das Sprints 1–2 (NestJS 12 ESM, Prisma 7.10, Vitest 5, React 19, TanStack Query, shadcn 3.8.5). Nenhuma dependência nova.

**Spec:** `docs/superpowers/specs/2026-09-28-sprint-3-os-rapida-design.md` (decisões D1–D5). Regras: `CLAUDE.md`, `docs/03`, `docs/04`, `docs/06`.

## Mudança consciente em relação à spec

O banco de teste (nunca zerado) já tem eventos `COMENTARIO` criados pelos testes de segurança, e `test/tenant/fk-composta.e2e-spec.ts` e `test/seguranca/t1-escrita-relacional.e2e-spec.ts` usam esse valor. Remover o valor do enum quebraria a migração. **Decisão:** `COMENTARIO` fica no enum marcado como obsoleto (`/// obsoleto desde a Sprint 3: não usar`), nenhum código novo o usa, e o schema de entrada da API só aceita `NOTA_INTERNA` e `ATUALIZACAO_CLIENTE`. Os dois testes antigos passam a usar `NOTA_INTERNA`.

## Restrições globais

- `oficinaId` vem sempre do `TenantContext`; recurso de outra oficina → **404**; sem permissão → **403 `SEM_PERMISSAO`**.
- Todo endpoint novo tem **teste de isolamento** (oficina A → 404 nos dados da B).
- Placa e telefone sempre por `normalizarPlaca`/`normalizarTelefone` (via `placaSchema`/`telefoneSchema`).
- Controllers nunca mencionam `oficinaId` (há teste estático); todo `executarSemTenant(` tem comentário de justificativa nas 3 linhas acima.
- Services gravam FKs escalares; nunca `connect`/escrita aninhada fora do permitido pela extensão.
- Um módulo não acessa tabelas de outro: `ordens-servico` usa `ClientesService`, `VeiculosService`, `OficinasService`, `UsuariosService`.
- `NOTA_INTERNA` e `VEICULO_TRANSFERIDO` sempre `visivelCliente = false`; `ATUALIZACAO_CLIENTE` e `OS_ABERTA` `visivelCliente = true`.
- Erros `{ statusCode, code, message, details? }`. Novos: `VEICULO_DE_OUTRO_CLIENTE` 409, `OS_ABERTA_EXISTENTE` 409, `RESPONSAVEL_INVALIDO` 422, `EVENTO_NAO_RETIRAVEL` 422, `TELEFONE_JA_CADASTRADO` 409, `PLACA_JA_CADASTRADA` 409.
- Paginação: `?cursor=&limite=`, padrão 20, máximo 50; resposta `{ itens, proximoCursor }`.
- Datas em UTC na API; exibição em `America/Sao_Paulo`. Textos em pt-BR; telas em 360px; toques ≥ 44px.
- Banco de teste nunca zerado: cada teste cria os próprios registros. Nunca `prisma migrate reset` nem `PRISMA_USER_CONSENT_FOR_DANGEROUS_AI_ACTION`.
- Portas: API 3333, web 5173. Parar servidores que subir.
- Commits Conventional Commits terminando com `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

1. **Placa digitada de jeitos diferentes** (`abc-1d23`, `ABC 1D23`, `abc1d23`) na abertura e na busca: é o mesmo carro, nunca duplica. → Tarefa 4 (e2e) e Tarefa 5 (abertura com placa minúscula e com hífen reaproveita o veículo).
2. **Duas pessoas abrindo OS ao mesmo tempo** (inclusive para o mesmo cliente novo): números distintos e consecutivos, um cliente só. → Tarefa 5.
3. **WhatsApp do cliente com texto que quebra a URL** (acentos, `&`, `#`, quebra de linha, emoji) no "Avisar no WhatsApp": o link abre com o texto certo. → Tarefa 8 (teste do gerador de link).
4. **Evento retirado nunca volta a aparecer como visível** e nota interna nunca vira visível (nem por PATCH, nem por body malicioso com `visivelCliente: true`). → Tarefa 6.
5. **Editar o telefone ou a placa para um valor já usado** por outro cliente/veículo da oficina: 409 com mensagem clara, nada muda; o mesmo valor em outra oficina é permitido. → Tarefa 4.

## Estrutura de arquivos

```
packages/shared/src/
  schemas/os.ts (+spec) · schemas/clientes-veiculos.ts (+spec) · schemas/paginacao.ts · tipos-os.ts · os.ts (formatarNumeroOS +spec)
  enums.ts (TipoEvento)
apps/api/
  prisma/schema.prisma · prisma/migrations/<ts>_eventos_os_sprint3/
  src/common/paginacao.ts (+spec)
  src/modules/clientes/ clientes.module.ts · clientes.service.ts · clientes.controller.ts
  src/modules/veiculos/ veiculos.module.ts · veiculos.service.ts · veiculos.controller.ts
  src/modules/busca/ busca.module.ts · busca.controller.ts
  src/modules/ordens-servico/ ordens-servico.module.ts · ordens-servico.service.ts · ordens-servico.controller.ts · eventos-os.service.ts · eventos-os.controller.ts · mapeadores.ts
  src/modules/oficinas/oficinas.service.ts (reservarNumeroOS)
  src/modules/usuarios/usuarios.service.ts (buscarAtivo com db opcional) · convites.service.ts (apagarPendentesDe, trava do criador)
  src/modules/auth/auth.service.ts (redefinirSenha apaga convites na transação)
  src/prisma/relacoes-tenant.ts
  test/os/apoio-os.ts · test/os/*.e2e-spec.ts
apps/web/src/
  lib/whatsapp.ts (+spec) · lib/formatar-data.ts (tempo relativo)
  features/os/ api/*.ts · pages/{inicio-os,abrir-os,detalhe-os}.tsx (+specs) · components/*
  features/busca/ api/use-busca.ts · pages/busca.tsx (+spec)
  features/clientes/ api/*.ts · pages/ficha-cliente.tsx (+spec)
  features/veiculos/ api/*.ts · pages/ficha-veiculo.tsx (+spec)
  features/painel/layout-painel.tsx (menu Buscar) · app/router.tsx
docs/02, 03, 04, 06
```

---

### Tarefa 1: Pendências da Sprint 2

Agent: `backend-nest`.

**Arquivos:** modificar `apps/api/vitest.config.e2e.ts`, `apps/api/src/modules/usuarios/convites.service.ts`, `apps/api/src/modules/auth/auth.service.ts`; testes em `apps/api/test/auth/convites.e2e-spec.ts` e `apps/api/test/auth/senha.e2e-spec.ts`.

**Interfaces (produz):** `ConvitesService.apagarPendentesDe(usuarioId: string, db: Db | Tx = this.prisma.db): Promise<number>`.

- [ ] **Passo 1: tempo limite dos e2e.** Em `vitest.config.e2e.ts`, dentro de `test`: `testTimeout: 30_000, hookTimeout: 60_000`. Comentário: "Postgres recém-subido + argon2 + 18 arquivos em paralelo estouram os 5 s padrão na partida a frio (CI)".

- [ ] **Passo 2: convites apagados na mesma transação do reset (teste → implementação).** Em `senha.e2e-spec.ts`:
```ts
it('redefinir senha apaga, na mesma transação, os convites pendentes que o usuário criou', async () => {
  const { usuario: dono } = await criarOficinaComUsuario(ctx);
  const d = await entrar(ctx, dono.email);
  const c = await ctx.http.post('/api/v1/convites').set({ Authorization: `Bearer ${d.accessToken}` })
    .send({ nome: 'Mec', email: `pend-${sufixo()}@teste.local` }).expect(201);
  await ctx.http.post('/api/v1/auth/esqueci-senha').send({ email: dono.email }).expect(200);
  await ctx.emails.aguardarPendentes();
  const token = /#([A-Za-z0-9_-]{43})/.exec(ctx.emails.ultimoPara(dono.email)!.texto)![1]!;
  await ctx.http.post('/api/v1/auth/redefinir-senha').send({ token, senha: 'nova-senha-do-ze' }).expect(200);
  const restantes = await ctx.tenant.executarComo(dono.oficinaId, () => ctx.prisma.db.convite.count({ where: { id: c.body.convite.id } }));
  expect(restantes).toBe(0);
});
```
Implementação: em `ConvitesService`, extrair o `deleteMany` do listener para:
```ts
/** Chamar dentro do contexto da oficina (ou com o `tx` dela). */
async apagarPendentesDe(usuarioId: string, db: Db | Tx = this.prisma.db): Promise<number> {
  const { count } = await db.convite.deleteMany({ where: { criadoPorId: usuarioId, usadoEm: null } });
  return count;
}
```
O listener passa a chamar `apagarPendentesDe`. Em `AuthService.redefinirSenha`, dentro do `$transaction` já existente, acrescentar `await this.convites.apagarPendentesDe(usuarioId, tx);` (injetar `ConvitesService`; `AuthModule` já importa `UsuariosModule`, que o exporta). O evento continua sendo emitido (outros ouvintes).

- [ ] **Passo 3: trava do criador no aceite (teste → implementação).** No `aceitar`, trocar a leitura do criador por uma leitura com trava de linha, dentro da mesma transação:
```ts
// trava a linha do criador até o commit: uma desativação/rebaixamento simultâneo espera o aceite
// terminar (ou o aceite espera a desativação e então a vê).
const [criador] = await tx.$queryRaw<{ ativo: boolean; perfil: PerfilUsuario }[]>`
  SELECT "ativo", "perfil" FROM "Usuario"
  WHERE "id" = ${convite.criadoPorId} AND "oficinaId" = ${convite.oficinaId}
  FOR UPDATE`;
```
(`$queryRaw` com template é parametrizado; a condição por `oficinaId` é obrigatória porque SQL cru passa por fora da extensão — `docs/03`.) Atualizar a regra de `test/seguranca/padroes-codigo.e2e-spec.ts` que lista os usos permitidos de `$queryRaw` para incluir este arquivo, com justificativa no próprio teste.
Teste em `convites.e2e-spec.ts`: disparar em paralelo o aceite e a desativação do criador (via `UsuariosService.alterar`) e afirmar que **ou** o aceite falhou com `TOKEN_INVALIDO` **ou** o usuário criado pelo aceite foi feito antes da desativação commitar (não pode existir usuário aceito depois de o criador ficar inativo: comparar `usuario.criadoEm` com o momento do commit da desativação não é confiável — afirmar só que o resultado é um dos dois estados válidos e que, se o aceite passou, o convite não aparece mais como pendente).

- [ ] **Passo 4: verificar e commitar.**
```bash
pnpm --filter @oficinatrack/api test && pnpm --filter @oficinatrack/api typecheck && pnpm lint
git add apps/api
git commit -m "fix(api): pendencias da sprint 2 (timeout e2e, convites no reset, trava do criador)"
```

---

### Tarefa 2: `packages/shared` — schemas e tipos da OS

**Arquivos:** criar `schemas/paginacao.ts`, `schemas/os.ts` (+spec), `schemas/clientes-veiculos.ts` (+spec), `tipos-os.ts`, `os.ts` (+spec); modificar `enums.ts`, `schemas/oficina.ts` (exportar helpers), `index.ts`.

**Interfaces (produz):**
- `TipoEvento` com `NOTA_INTERNA`, `ATUALIZACAO_CLIENTE`, `VEICULO_TRANSFERIDO` (mantém `COMENTARIO`, obsoleto); `TIPOS_EVENTO_PUBLICAVEIS = ['NOTA_INTERNA','ATUALIZACAO_CLIENTE'] as const`
- `paginacaoSchema`, `type Pagina<T>`
- `textoAnulavel(max)`, `inteiroOpcional(min,max)`, `inteiroAnulavel(min,max)`
- `abrirOsSchema`/`AbrirOs`, `alterarOsSchema`/`AlterarOs`, `novoEventoSchema`/`NovoEvento`, `alterarClienteSchema`/`AlterarCliente`, `alterarVeiculoSchema`/`AlterarVeiculo`, `buscaSchema`, `consultaPlacaSchema`
- tipos `ResumoCliente`, `ResumoVeiculo`, `ResumoOS`, `DetalheOS`, `EventoOSDto`, `FichaCliente`, `FichaVeiculo`, `ConsultaPlaca`, `ResultadoBusca`
- `formatarNumeroOS(numero: number): string` → `#0001`; `SITUACOES_ABERTAS` (status que contam como "em aberto")

- [ ] **Passo 1: testes (falhando).**

`src/os.spec.ts`:
```ts
import { formatarNumeroOS, osEstaAberta } from './os.js';

describe('formatarNumeroOS', () => {
  it.each([[1, '#0001'], [42, '#0042'], [12345, '#12345']])('%i → %s', (n, esperado) => {
    expect(formatarNumeroOS(n)).toBe(esperado);
  });
});

describe('osEstaAberta', () => {
  it('ENTREGUE e CANCELADO não estão abertas', () => {
    expect(osEstaAberta('TRIAGEM')).toBe(true);
    expect(osEstaAberta('PRONTO')).toBe(true);
    expect(osEstaAberta('ENTREGUE')).toBe(false);
    expect(osEstaAberta('CANCELADO')).toBe(false);
  });
});
```

`src/schemas/os.spec.ts`:
```ts
import { abrirOsSchema, alterarOsSchema, novoEventoSchema } from './os.js';

describe('abrirOsSchema', () => {
  it('normaliza placa e telefone e aceita só os obrigatórios', () => {
    const r = abrirOsSchema.parse({ placa: 'abc-1d23', telefone: '(43) 99999-8888', relatoCliente: 'Barulho na suspensão' });
    expect(r).toEqual({ placa: 'ABC1D23', telefone: '+5543999998888', relatoCliente: 'Barulho na suspensão' });
  });
  it('campos opcionais vazios do formulário viram undefined', () => {
    const r = abrirOsSchema.parse({ placa: 'ABC1234', telefone: '43999998888', relatoCliente: 'Troca de óleo', nomeCliente: '', kmEntrada: '', previsaoEntrega: '' });
    expect(r.nomeCliente).toBeUndefined();
    expect(r.kmEntrada).toBeUndefined();
    expect(r.previsaoEntrega).toBeUndefined();
  });
  it('km vindo do formulário como texto vira número', () => {
    expect(abrirOsSchema.parse({ placa: 'ABC1234', telefone: '43999998888', relatoCliente: 'Revisão', kmEntrada: '85432' }).kmEntrada).toBe(85432);
  });
  it.each([
    [{ relatoCliente: 'ab' }, 'queixa curta'],
    [{ relatoCliente: 'x'.repeat(1001) }, 'queixa longa'],
    [{ kmEntrada: -1 }, 'km negativo'],
    [{ previsaoEntrega: '28/09/2026' }, 'data fora do formato'],
  ])('recusa %s (%s)', (extra) => {
    expect(abrirOsSchema.safeParse({ placa: 'ABC1234', telefone: '43999998888', relatoCliente: 'Revisão', ...extra }).success).toBe(false);
  });
});

describe('alterarOsSchema', () => {
  it('string vazia limpa o campo (null) e exige ao menos um campo', () => {
    expect(alterarOsSchema.parse({ diagnostico: '' })).toEqual({ diagnostico: null });
    expect(alterarOsSchema.safeParse({}).success).toBe(false);
  });
});

describe('novoEventoSchema (Review Focus 4)', () => {
  it('só aceita NOTA_INTERNA e ATUALIZACAO_CLIENTE e descarta visivelCliente do body', () => {
    expect(novoEventoSchema.safeParse({ tipo: 'COMENTARIO', texto: 'x' }).success).toBe(false);
    expect(novoEventoSchema.safeParse({ tipo: 'OS_ABERTA', texto: 'x' }).success).toBe(false);
    expect(novoEventoSchema.parse({ tipo: 'NOTA_INTERNA', texto: ' ok ', visivelCliente: true })).toEqual({ tipo: 'NOTA_INTERNA', texto: 'ok' });
  });
  it('texto de 1 a 2000 caracteres', () => {
    expect(novoEventoSchema.safeParse({ tipo: 'NOTA_INTERNA', texto: '   ' }).success).toBe(false);
    expect(novoEventoSchema.safeParse({ tipo: 'NOTA_INTERNA', texto: 'x'.repeat(2001) }).success).toBe(false);
  });
});
```

`src/schemas/clientes-veiculos.spec.ts`:
```ts
import { alterarClienteSchema, alterarVeiculoSchema, buscaSchema } from './clientes-veiculos.js';

describe('alterarClienteSchema', () => {
  it('normaliza telefone, e-mail e documento; vazio vira null', () => {
    expect(alterarClienteSchema.parse({ telefone: '(43) 98888-7777', email: ' Ze@X.com ', documento: '123.456.789-09', nome: '' }))
      .toEqual({ telefone: '+5543988887777', email: 'ze@x.com', documento: '12345678909', nome: null });
    expect(alterarClienteSchema.parse({ email: '' })).toEqual({ email: null });
  });
});

describe('alterarVeiculoSchema', () => {
  it('normaliza placa e aceita ano entre 1950 e o próximo ano', () => {
    expect(alterarVeiculoSchema.parse({ placa: 'abc-1234', anoModelo: '2019' })).toEqual({ placa: 'ABC1234', anoModelo: 2019 });
    expect(alterarVeiculoSchema.safeParse({ anoModelo: 1900 }).success).toBe(false);
  });
});

describe('buscaSchema', () => {
  it('2 a 100 caracteres', () => {
    expect(buscaSchema.safeParse({ q: 'a' }).success).toBe(false);
    expect(buscaSchema.parse({ q: ' ze ' })).toEqual({ q: 'ze' });
  });
});
```

Rodar `pnpm --filter @oficinatrack/shared test` → FALHA.

- [ ] **Passo 2: implementação.**

`src/enums.ts` — `TipoEvento`:
```ts
export const TipoEvento = z.enum([
  'OS_ABERTA',
  'STATUS_ALTERADO',
  'COMENTARIO', // obsoleto desde a Sprint 3: não usar (mantido porque há registros antigos)
  'NOTA_INTERNA',
  'ATUALIZACAO_CLIENTE',
  'VEICULO_TRANSFERIDO',
  'FOTO',
  'ORCAMENTO_ENVIADO',
  'ORCAMENTO_RESPONDIDO',
  'CHECKLIST_PREENCHIDO',
]);
```

`src/os.ts`:
```ts
import type { StatusOS } from './enums.js';

export const formatarNumeroOS = (numero: number) => `#${String(numero).padStart(4, '0')}`;

/** Status que contam como "OS em aberto" (tudo que não foi entregue nem cancelado). */
export const SITUACOES_ABERTAS: readonly StatusOS[] = [
  'TRIAGEM', 'DIAGNOSTICO', 'AGUARDANDO_APROVACAO', 'AGUARDANDO_PECA', 'EM_EXECUCAO', 'PRONTO',
];
export const osEstaAberta = (status: StatusOS) => SITUACOES_ABERTAS.includes(status);
```

`src/schemas/paginacao.ts`:
```ts
import { z } from 'zod';

export const paginacaoSchema = z.object({
  cursor: z.string().min(1).max(40).optional(),
  limite: z.coerce.number().int().min(1).max(50).default(20),
});
export type Paginacao = z.output<typeof paginacaoSchema>;
export type Pagina<T> = { itens: T[]; proximoCursor: string | null };
```

Em `src/schemas/oficina.ts`, ao lado de `textoOpcional`, acrescentar e exportar:
```ts
const vazioVira = <T>(valor: T) => (v: unknown) => (v === '' ? valor : v);

/** Para PATCH: '' limpa o campo (null); ausente não mexe. */
export const textoAnulavel = (max: number) =>
  z.preprocess(vazioVira(null), z.string().trim().max(max).nullable().optional());

const paraNumero = (v: unknown) => (typeof v === 'string' ? Number(v) : v);
export const inteiroOpcional = (min: number, max: number) =>
  z.preprocess((v) => (v === '' || v === null ? undefined : paraNumero(v)), z.number().int().min(min).max(max).optional());
export const inteiroAnulavel = (min: number, max: number) =>
  z.preprocess((v) => (v === '' ? null : paraNumero(v)), z.number().int().min(min).max(max).nullable().optional());
```

`src/schemas/os.ts`:
```ts
import { z } from 'zod';
import { placaSchema, telefoneSchema } from './comuns.js';
import { inteiroAnulavel, inteiroOpcional, textoAnulavel, textoOpcional } from './oficina.js';

const KM_MAX = 2_000_000;
const dataOpcional = z.preprocess((v) => (v === '' ? undefined : v), z.iso.date({ error: 'Data inválida' }).optional());
const dataAnulavel = z.preprocess((v) => (v === '' ? null : v), z.iso.date({ error: 'Data inválida' }).nullable().optional());
const idOpcional = z.preprocess((v) => (v === '' ? undefined : v), z.string().min(1).max(40).optional());

export const abrirOsSchema = z.object({
  placa: placaSchema,
  telefone: telefoneSchema,
  relatoCliente: z.string().trim().min(3, { error: 'Descreva a queixa do cliente' }).max(1000),
  nomeCliente: textoOpcional(120),
  kmEntrada: inteiroOpcional(0, KM_MAX),
  responsavelId: idOpcional,
  previsaoEntrega: dataOpcional,
  transferirVeiculo: z.boolean().optional(),
  criarMesmoComOsAberta: z.boolean().optional(),
});
export type AbrirOs = z.output<typeof abrirOsSchema>;
export type AbrirOsEntrada = z.input<typeof abrirOsSchema>;

export const alterarOsSchema = z
  .object({
    relatoCliente: z.string().trim().min(3).max(1000).optional(),
    diagnostico: textoAnulavel(2000),
    kmEntrada: inteiroAnulavel(0, KM_MAX),
    responsavelId: z.preprocess((v) => (v === '' ? null : v), z.string().min(1).max(40).nullable().optional()),
    previsaoEntrega: dataAnulavel,
  })
  .refine((d) => Object.values(d).some((v) => v !== undefined), { error: 'Nada para alterar' });
export type AlterarOs = z.output<typeof alterarOsSchema>;

export const TIPOS_EVENTO_PUBLICAVEIS = ['NOTA_INTERNA', 'ATUALIZACAO_CLIENTE'] as const;
export const novoEventoSchema = z.object({
  tipo: z.enum(TIPOS_EVENTO_PUBLICAVEIS),
  texto: z.string().trim().min(1, { error: 'Escreva alguma coisa' }).max(2000),
});
export type NovoEvento = z.output<typeof novoEventoSchema>;
```
(Zod `z.object` descarta chaves desconhecidas por padrão, o que cumpre o teste do `visivelCliente`.)

`src/schemas/clientes-veiculos.ts`:
```ts
import { z } from 'zod';
import { emailSchema } from './auth.js';
import { placaSchema, telefoneSchema } from './comuns.js';
import { documentoSchema, inteiroAnulavel, textoAnulavel } from './oficina.js';

const vazioNull = <T extends z.ZodType>(s: T) => z.preprocess((v) => (v === '' ? null : v), s.nullable().optional());
const peloMenosUm = (d: Record<string, unknown>) => Object.values(d).some((v) => v !== undefined);

export const alterarClienteSchema = z
  .object({
    nome: textoAnulavel(120),
    telefone: telefoneSchema.optional(),
    email: vazioNull(emailSchema),
    documento: vazioNull(documentoSchema),
    observacoes: textoAnulavel(2000),
  })
  .refine(peloMenosUm, { error: 'Nada para alterar' });
export type AlterarCliente = z.output<typeof alterarClienteSchema>;

const anoMaximo = () => new Date().getFullYear() + 1;
export const alterarVeiculoSchema = z
  .object({
    placa: placaSchema.optional(),
    marca: textoAnulavel(60),
    modelo: textoAnulavel(60),
    cor: textoAnulavel(40),
    chassi: textoAnulavel(30),
    anoModelo: inteiroAnulavel(1950, anoMaximo()),
    kmAtual: inteiroAnulavel(0, 2_000_000),
  })
  .refine(peloMenosUm, { error: 'Nada para alterar' });
export type AlterarVeiculo = z.output<typeof alterarVeiculoSchema>;

export const buscaSchema = z.object({ q: z.string().trim().min(2, { error: 'Digite pelo menos 2 caracteres' }).max(100) });
export const consultaPlacaSchema = z.object({ placa: placaSchema });
```

`src/tipos-os.ts`:
```ts
import type { StatusOS, TipoEvento } from './enums.js';

type Pessoa = { id: string; nome: string | null };
export type ResumoCliente = { id: string; nome: string | null; telefone: string };
export type ResumoVeiculo = { id: string; placa: string; marca: string | null; modelo: string | null; cliente: Pessoa };
export type ResumoOS = {
  id: string; numero: number; status: StatusOS; statusDesde: string; criadoEm: string;
  placa: string; modelo: string | null; cliente: Pessoa; relatoCliente: string;
};
export type DetalheOS = {
  id: string; numero: number; status: StatusOS; statusDesde: string; criadoEm: string;
  relatoCliente: string; diagnostico: string | null; kmEntrada: number | null; previsaoEntrega: string | null;
  veiculo: { id: string; placa: string; marca: string | null; modelo: string | null; cor: string | null; anoModelo: number | null };
  cliente: { id: string; nome: string | null; telefone: string };
  responsavel: { id: string; nome: string } | null;
};
export type EventoOSDto = {
  id: string; tipo: TipoEvento; texto: string | null; visivelCliente: boolean; criadoEm: string;
  statusDe: StatusOS | null; statusPara: StatusOS | null;
  autor: { id: string; nome: string } | null;
  retiradoEm: string | null; retiradoPor: { id: string; nome: string } | null;
};
export type FichaVeiculo = {
  id: string; placa: string; marca: string | null; modelo: string | null; anoModelo: number | null; cor: string | null;
  chassi: string | null; kmAtual: number | null; criadoEm: string; cliente: { id: string; nome: string | null; telefone: string };
};
export type FichaCliente = {
  id: string; nome: string | null; telefone: string; email: string | null; documento: string | null; observacoes: string | null;
  criadoEm: string; veiculos: Omit<ResumoVeiculo, 'cliente'>[];
};
export type ConsultaPlaca = { veiculo: FichaVeiculo; osAberta: { id: string; numero: number; criadoEm: string } | null };
export type ResultadoBusca = { clientes: ResumoCliente[]; veiculos: ResumoVeiculo[] };
```

`src/index.ts`: exportar `os.js`, `schemas/paginacao.js`, `schemas/os.js`, `schemas/clientes-veiculos.js`, `tipos-os.js`.

- [ ] **Passo 3: verificar e commitar.**
```bash
pnpm --filter @oficinatrack/shared test && pnpm --filter @oficinatrack/shared typecheck && pnpm build:shared && pnpm lint
git add packages/shared
git commit -m "feat(shared): schemas e tipos da os, clientes e veiculos"
```

---

### Tarefa 3: Banco — eventos da OS

Agent: `arquiteto-dados`.

**Arquivos:** `apps/api/prisma/schema.prisma`, nova migração `eventos_os_sprint3`, `src/prisma/relacoes-tenant.ts`, `test/tenant/fk-composta.e2e-spec.ts` e `test/seguranca/t1-escrita-relacional.e2e-spec.ts` (`COMENTARIO` → `NOTA_INTERNA`), `docs/04-modelo-dados.md`.

**Interfaces (produz):** `TipoEvento` Prisma igual ao do shared; `EventoOS.retiradoEm DateTime?`, `EventoOS.retiradoPorId String?`, relação `retiradoPor` (FK composta `(oficinaId, retiradoPorId)` → `Usuario(oficinaId, id)`, `onDelete: NoAction`, `onUpdate: Restrict`); `Usuario` ganha a relação inversa `eventosRetirados`.

- [ ] **Passo 1:** schema:
```prisma
enum TipoEvento {
  OS_ABERTA
  STATUS_ALTERADO
  COMENTARIO /// obsoleto desde a Sprint 3: não usar (registros antigos)
  NOTA_INTERNA
  ATUALIZACAO_CLIENTE
  VEICULO_TRANSFERIDO
  FOTO
  ORCAMENTO_ENVIADO
  ORCAMENTO_RESPONDIDO
  CHECKLIST_PREENCHIDO
}
```
Em `EventoOS`:
```prisma
  retiradoEm    DateTime? // atualização retirada do portal (nunca apagada)
  retiradoPorId String?
  retiradoPor   Usuario?  @relation("EventoRetiradoPor", fields: [oficinaId, retiradoPorId], references: [oficinaId, id], onDelete: NoAction, onUpdate: Restrict)
```
A relação `autor` existente precisa ganhar nome (`@relation("EventoAutor", …)`) porque agora há duas relações `EventoOS`↔`Usuario`; em `Usuario`: `eventos EventoOS[] @relation("EventoAutor")` e `eventosRetirados EventoOS[] @relation("EventoRetiradoPor")`.

- [ ] **Passo 2:** migração via `prisma migrate diff` numa pasta nova `…_eventos_os_sprint3`; `ALTER TYPE "TipoEvento" ADD VALUE` para os três valores (Postgres não permite usar valor novo na mesma transação em que foi criado — manter a migração só com `ADD VALUE` + colunas + FK). Aplicar com `prisma migrate dev`. Se pedir reset: PARAR (BLOCKED).

- [ ] **Passo 3:** `relacoes-tenant.ts`: `EventoOS.retiradoPor: 'Usuario'`; `Usuario.eventosRetirados: 'EventoOS'` (sem criação aninhada permitida para `eventosRetirados`). Rodar os testes de sincronia (`extensao-tenant.spec.ts`).

- [ ] **Passo 4:** trocar `'COMENTARIO'` por `'NOTA_INTERNA'` nos dois testes antigos. Acrescentar em `test/tenant/fk-composta.e2e-spec.ts`:
```ts
it('EventoOS.retiradoPor não aceita usuário de outra oficina (P2003)', async () => {
  // mesmo padrão dos testes vizinhos: evento da oficina A com retiradoPorId de um usuário da B
});
```
(escrever completo seguindo o teste de `autorId` que já existe no arquivo).

- [ ] **Passo 5:** docs/04 atualizado; verificar e commitar:
```bash
pnpm --filter @oficinatrack/api test && pnpm --filter @oficinatrack/api typecheck && pnpm lint
git add apps/api docs/04-modelo-dados.md
git commit -m "feat(db): notas internas, atualizacoes para o cliente e retirada de eventos"
```

---

### Tarefa 4: API — clientes, veículos e busca

Agent: `backend-nest`.

**Arquivos:** criar `src/common/paginacao.ts` (+spec), `src/modules/clientes/*`, `src/modules/veiculos/*`, `src/modules/busca/*`, `test/os/apoio-os.ts`, `test/os/clientes-veiculos.e2e-spec.ts`; modificar `app.module.ts`.

**Interfaces (produz):**
- `paginar<T extends { id: string }>(linhas: T[], limite: number): Pagina<T>` e `argsPaginacao(p: Paginacao)` → `{ take: limite + 1, ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}) }`
- `ClientesService`: `obterOuCriar(tx: Tx, dados: { telefone: string; nome?: string }): Promise<{ id: string; nome: string | null; telefone: string; criado: boolean }>`, `buscarPorId(id)`, `ficha(id): Promise<FichaCliente>`, `alterar(id, dados: AlterarCliente): Promise<FichaCliente>`, `buscar(termo): Promise<ResumoCliente[]>`
- `VeiculosService`: `buscarPorPlaca(placa, db?)`, `criar(tx, { placa, clienteId, kmAtual? })`, `transferir(tx, veiculoId, clienteId)`, `atualizarKmSeMaior(tx, veiculoId, km)`, `ficha(id): Promise<FichaVeiculo>`, `alterar(id, dados: AlterarVeiculo): Promise<FichaVeiculo>`, `buscar(termo): Promise<ResumoVeiculo[]>`
- Endpoints: `GET /busca?q=`, `GET /veiculos/consulta?placa=` (a parte `osAberta` usa `OrdensServicoService` — nesta tarefa devolve `osAberta: null` e a Tarefa 5 completa), `GET|PATCH /veiculos/:id`, `GET|PATCH /clientes/:id`
- Apoio de teste: `criarClienteNa(ctx, oficinaId, dados?)`, `criarVeiculoNa(ctx, oficinaId, clienteId, placa?)`, `placaUnica()`

Regras da busca (`BuscaController` chama os dois services):
```ts
/** Classifica o termo: placa válida → placa; telefone válido → telefone; senão → nome por trecho. */
export function classificarTermo(termo: string):
  | { tipo: 'placa'; valor: string } | { tipo: 'telefone'; valor: string } | { tipo: 'nome'; valor: string } {
  const placa = normalizarPlaca(termo);
  if (placa) return { tipo: 'placa', valor: placa };
  const telefone = normalizarTelefone(termo);
  if (telefone) return { tipo: 'telefone', valor: telefone };
  return { tipo: 'nome', valor: termo.trim() };
}
```
Placa parcial (ex.: "ABC1") também é útil no balcão: quando o termo tem só letras e números e 3–7 caracteres, buscar veículos com `placa: { startsWith: termo.toUpperCase().replace(/[^A-Z0-9]/g, '') }` além da classificação acima. Nome: `nome: { contains: termo, mode: 'insensitive' }`. Máximo 10 de cada.

`ClientesService.obterOuCriar`:
```ts
const CAMPOS_RESUMO = { id: true, nome: true, telefone: true } as const;

/**
 * Dentro da transação da abertura. `findFirst` (e não `findUnique`) porque a chave única é
 * composta com `oficinaId`, que a extensão de tenant acrescenta sozinha.
 * Corrida no mesmo telefone novo: o `create` perdedor dá P2002 e quem chama repete a transação.
 */
async obterOuCriar(tx: Tx, { telefone, nome }: { telefone: string; nome?: string }) {
  const existente = await tx.cliente.findFirst({ where: { telefone }, select: CAMPOS_RESUMO });
  if (existente) {
    if (nome && !existente.nome) {
      return { ...(await tx.cliente.update({ where: { id: existente.id }, data: { nome }, select: CAMPOS_RESUMO })), criado: false };
    }
    return { ...existente, criado: false };
  }
  const criado = await tx.cliente.create({
    data: { oficinaId: this.tenant.oficinaIdAtual(), telefone, nome: nome ?? null },
    select: CAMPOS_RESUMO,
  });
  return { ...criado, criado: true };
}
```

`alterar` de cliente: se `telefone` mudar para um já usado → `409 TELEFONE_JA_CADASTRADO` (pré-checagem + P2002 mapeado). Veículo: `placa` já usada → `409 PLACA_JA_CADASTRADA`.

- [ ] **Passo 1: testes e2e (falhando)** — `test/os/clientes-veiculos.e2e-spec.ts`, usando `criarApp`/`criarOficinaComUsuario`/`entrar` de `test/auth/apoio-auth.ts`:
```ts
describe('Clientes, veículos e busca', () => {
  // beforeAll/afterAll como nos outros e2e
  it('busca por placa em qualquer formato acha o mesmo veículo (Review Focus 1)', async () => {
    const { oficina, usuario } = await criarOficinaComUsuario(ctx);
    const cliente = await criarClienteNa(ctx, oficina.id, { nome: 'João' });
    const placa = placaUnica(); // ex.: 'QWE1R23'
    await criarVeiculoNa(ctx, oficina.id, cliente.id, placa);
    const { accessToken } = await entrar(ctx, usuario.email);
    for (const q of [placa.toLowerCase(), `${placa.slice(0, 3)}-${placa.slice(3)}`, ` ${placa} `]) {
      const r = await ctx.http.get('/api/v1/busca').query({ q }).set(auth(accessToken)).expect(200);
      expect(r.body.veiculos.map((v: { placa: string }) => v.placa)).toEqual([placa]);
    }
  });
  it('busca por telefone com máscara e por trecho do nome', async () => { /* cliente '+55439…' achado por '(43) 9…'; nome 'Maria Aparecida' achado por 'apare' */ });
  it('placa parcial acha veículos que começam com o trecho', async () => { /* 'QWE' → o veículo */ });
  it('isolamento: busca, ficha e PATCH de cliente/veículo da oficina B → vazio/404 para A', async () => { /* … */ });
  it('consulta por placa: desconhecida → 404; conhecida → veículo e dono', async () => { /* … */ });
  it('PATCH cliente: telefone de outro cliente → 409 TELEFONE_JA_CADASTRADO; em outra oficina pode (Review Focus 5)', async () => { /* … */ });
  it('PATCH veículo: placa de outro veículo → 409 PLACA_JA_CADASTRADA; em outra oficina pode (Review Focus 5)', async () => { /* … */ });
  it('PATCH cliente: string vazia limpa nome/e-mail/observações', async () => { /* … */ });
  it('busca com 1 caractere → 400 VALIDACAO_FALHOU', async () => { /* … */ });
});
```
Escrever cada teste por completo (as linhas `/* … */` descrevem o cenário; o implementador escreve os passos com a mesma forma do primeiro teste).

- [ ] **Passo 2: implementação** — services com `select` explícito (nunca devolver campos de outro domínio), mapeadores para os tipos do shared (datas `toISOString()`), controllers com `@ExigePermissao` conforme a spec, `@Query(new ZodValidationPipe(buscaSchema))`. `paginacao.ts` com teste unitário (menos que `limite` → `proximoCursor: null`; `limite + 1` → corta e devolve o id do último item).

- [ ] **Passo 3: verificar e commitar.**
```bash
pnpm --filter @oficinatrack/api test && pnpm --filter @oficinatrack/api typecheck && pnpm lint
git add apps/api
git commit -m "feat(clientes): clientes, veiculos e busca por placa, nome ou telefone"
```

---

### Tarefa 5: API — abrir e consultar OS

Agent: `backend-nest`.

**Arquivos:** criar `src/modules/ordens-servico/{ordens-servico.module.ts,ordens-servico.service.ts,ordens-servico.controller.ts,mapeadores.ts}`, `test/os/abrir-os.e2e-spec.ts`, `test/os/consultar-os.e2e-spec.ts`; modificar `oficinas.service.ts` (`reservarNumeroOS`), `usuarios.service.ts` (`buscarAtivo(id, db?)`), `veiculos.controller.ts` (consulta com `osAberta`), `app.module.ts`.

**Interfaces (produz):**
- `OficinasService.reservarNumeroOS(tx: Tx): Promise<number>`
- `OrdensServicoService.abrir(dados: AbrirOs): Promise<DetalheOS>`, `detalhe(id): Promise<DetalheOS>`, `alterar(id, dados: AlterarOs): Promise<DetalheOS>`, `listarAbertas(p: Paginacao): Promise<Pagina<ResumoOS>>`, `listarPorVeiculo(veiculoId, p)`, `listarPorCliente(clienteId, p)`, `osAbertaDoVeiculo(veiculoId, db?): Promise<{ id; numero; criadoEm } | null>`
- Endpoints: `POST /ordens-servico` (201), `GET /ordens-servico?situacao=abertas&cursor=&limite=`, `GET|PATCH /ordens-servico/:id`, `GET /veiculos/:id/ordens-servico`, `GET /clientes/:id/ordens-servico`

`reservarNumeroOS`:
```ts
/** Trava a linha da oficina até o commit: aberturas simultâneas recebem números seguidos. */
async reservarNumeroOS(tx: Tx): Promise<number> {
  const { id } = await tx.oficina.findFirstOrThrow({ select: { id: true } });
  const { proximoNumeroOS } = await tx.oficina.update({ where: { id }, data: { proximoNumeroOS: { increment: 1 } }, select: { proximoNumeroOS: true } });
  return proximoNumeroOS - 1;
}
```

`abrir` (núcleo):
```ts
async abrir(dados: AbrirOs, ator: UsuarioAutenticado): Promise<DetalheOS> {
  const id = await this.comRetentativa(() =>
    this.prisma.db.$transaction(async (tx) => {
      const existente = await this.veiculos.buscarPorPlaca(dados.placa, tx);
      if (existente && !dados.criarMesmoComOsAberta) {
        const aberta = await this.osAbertaDoVeiculo(existente.id, tx);
        if (aberta) throw new ErroNegocio(409, 'OS_ABERTA_EXISTENTE', `Este carro já está na OS ${formatarNumeroOS(aberta.numero)}`, aberta);
      }
      const cliente = await this.clientes.obterOuCriar(tx, { telefone: dados.telefone, nome: dados.nomeCliente });
      let veiculoId: string;
      let transferencia: { de: string; para: string } | null = null;
      if (!existente) {
        veiculoId = (await this.veiculos.criar(tx, { placa: dados.placa, clienteId: cliente.id, kmAtual: dados.kmEntrada })).id;
      } else if (existente.cliente.id !== cliente.id) {
        if (dados.transferirVeiculo === undefined) {
          throw new ErroNegocio(409, 'VEICULO_DE_OUTRO_CLIENTE', 'Esta placa está cadastrada com outro cliente', {
            dono: { nome: existente.cliente.nome, telefoneFinal: existente.cliente.telefone.slice(-4) },
          });
        }
        if (dados.transferirVeiculo) {
          await this.veiculos.transferir(tx, existente.id, cliente.id);
          transferencia = { de: existente.cliente.nome ?? existente.cliente.telefone, para: cliente.nome ?? cliente.telefone };
        }
        veiculoId = existente.id;
      } else {
        veiculoId = existente.id;
      }
      if (dados.responsavelId && !(await this.usuarios.buscarAtivo(dados.responsavelId, tx))) {
        throw new ErroNegocio(422, 'RESPONSAVEL_INVALIDO', 'Responsável não encontrado ou inativo');
      }
      if (dados.kmEntrada !== undefined && existente) await this.veiculos.atualizarKmSeMaior(tx, veiculoId, dados.kmEntrada);
      const numero = await this.oficinas.reservarNumeroOS(tx);
      const oficinaId = this.tenant.oficinaIdAtual();
      const os = await tx.ordemServico.create({
        data: {
          oficinaId, numero, veiculoId, clienteId: cliente.id, relatoCliente: dados.relatoCliente,
          kmEntrada: dados.kmEntrada ?? null, responsavelId: dados.responsavelId ?? null,
          previsaoEntrega: dados.previsaoEntrega ? paraMeioDia(dados.previsaoEntrega) : null,
        },
        select: { id: true },
      });
      const autorId = ator.id;
      await tx.eventoOS.create({ data: { oficinaId, ordemServicoId: os.id, autorId, tipo: 'OS_ABERTA', visivelCliente: true } });
      if (transferencia) {
        await tx.eventoOS.create({
          data: { oficinaId, ordemServicoId: os.id, autorId, tipo: 'VEICULO_TRANSFERIDO', visivelCliente: false,
                  texto: `Veículo transferido de ${transferencia.de} para ${transferencia.para}` },
        });
      }
      return os.id;
    }),
  );
  return this.detalhe(id);
}
```
Notas obrigatórias para o implementador:
- **Autor:** o service recebe o `UsuarioAutenticado` como parâmetro (`abrir(dados, ator)`), igual ao padrão de `UsuariosService.alterar`; o controller passa `@UsuarioAtual()`.
- **`comRetentativa`:** repete a transação uma vez quando o erro for P2002 em `Cliente` ou `Veiculo` (corrida de dois pedidos criando o mesmo cliente/veículo) ou `ehConflitoDeTransacao` (`src/prisma/conflito-transacao.ts`); na segunda falha, relança.
- **`paraMeioDia('2026-10-02')`** → `new Date('2026-10-02T15:00:00.000Z')` (meio-dia em São Paulo); `DetalheOS.previsaoEntrega` devolve `'2026-10-02'` (`toISOString().slice(0, 10)`).
- **`transferir`** só troca `clienteId` do veículo (FK composta garante mesma oficina).
- **`alterar` da OS:** `responsavelId` validado igual (`RESPONSAVEL_INVALIDO`); `null` limpa; `kmEntrada` também atualiza o veículo se maior.
- **`osAbertaDoVeiculo`:** `findFirst({ where: { veiculoId, status: { in: SITUACOES_ABERTAS } }, orderBy: { criadoEm: 'desc' } })`.
- **`GET /veiculos/consulta` com `osAberta`:** o módulo `veiculos` não pode depender de `ordens-servico` (seria dependência circular, já que `ordens-servico` usa `VeiculosService`). Por isso a rota **muda de lugar**: remover a de `VeiculosController` (criada na Tarefa 4) e criá-la num controller do módulo `ordens-servico` declarado com `@Controller()` e `@Get('veiculos/consulta')`, que chama `VeiculosService.buscarPorPlaca` + `osAbertaDoVeiculo`. O teste da Tarefa 4 para a consulta continua valendo e ganha a asserção de `osAberta`. Confirmar que existe uma única rota `GET /api/v1/veiculos/consulta` e que ela não é capturada por `GET /veiculos/:id` (rota estática registrada antes, ou teste que prova a resposta certa).

- [ ] **Passo 1: testes e2e (falhando)** — `test/os/abrir-os.e2e-spec.ts`:
```ts
describe('Abrir OS', () => {
  it('só placa + WhatsApp + queixa: cria cliente, veículo, OS #1 em TRIAGEM com evento OS_ABERTA', async () => { … });
  it('segunda OS da oficina recebe o número seguinte', async () => { … });
  it('reaproveita cliente pelo telefone e veículo pela placa em outro formato (Review Focus 1)', async () => {
    // abre com 'abc-1d23' e '(43) 9…'; depois fecha a OS no banco (status ENTREGUE) e abre de novo com 'ABC1D23' e '+55 43 9…'
    // → mesmo cliente.id e veiculo.id
  });
  it('D4: carro com OS aberta → 409 OS_ABERTA_EXISTENTE com id e número; criarMesmoComOsAberta → cria', async () => { … });
  it('D1: placa com outro dono → 409 VEICULO_DE_OUTRO_CLIENTE com nome e 4 últimos dígitos', async () => { … });
  it('D1 transferir=true: veículo passa para o novo cliente e há evento interno VEICULO_TRANSFERIDO', async () => { … });
  it('D1 transferir=false: OS no nome de quem trouxe, veículo continua com o dono', async () => { … });
  it('duas aberturas simultâneas recebem números distintos e consecutivos (Review Focus 2)', async () => {
    // Promise.all de 2 POSTs com placas diferentes na mesma oficina → numeros ordenados = [n, n+1]
  });
  it('mesmo telefone novo em duas aberturas simultâneas → um cliente só (Review Focus 2)', async () => {
    // Promise.all de 2 POSTs com o mesmo telefone inédito e placas diferentes → os dois 201 e mesmo cliente.id
  });
  it('responsável de outra oficina ou inativo → 422 RESPONSAVEL_INVALIDO', async () => { … });
  it('km maior atualiza o veículo; km menor não', async () => { … });
  it('isolamento: GET/PATCH da OS de B → 404 para A; listas não mostram OS de B', async () => { … });
  it('FUNCIONARIO abre OS (tem OS_GERENCIAR)', async () => { … });
});
```
`test/os/consultar-os.e2e-spec.ts`: `GET /ordens-servico?situacao=abertas` mais recentes primeiro, paginação (`limite=2` → `proximoCursor`, segunda página sem repetir), `limite=51` → 400; `PATCH` (diagnóstico, previsão `'2026-10-02'` volta igual, limpar com `''`); históricos por veículo e por cliente; consulta de placa com `osAberta`.
Cada `…` é escrito completo pelo implementador na forma dos testes da Sprint 2.

- [ ] **Passo 2: implementação** conforme acima.

- [ ] **Passo 3: verificar e commitar.**
```bash
pnpm --filter @oficinatrack/api test && pnpm --filter @oficinatrack/api typecheck && pnpm lint
git add apps/api
git commit -m "feat(os): abertura rapida de os com reaproveitamento de cliente e veiculo"
```

---

### Tarefa 6: API — notas internas e atualizações para o cliente

Agent: `backend-nest`.

**Arquivos:** criar `src/modules/ordens-servico/{eventos-os.service.ts,eventos-os.controller.ts}`, `test/os/eventos-os.e2e-spec.ts`.

**Interfaces (produz):** `EventosOsService.listar(osId, p): Promise<Pagina<EventoOSDto>>`, `publicar(osId, dados: NovoEvento, ator): Promise<EventoOSDto>`, `retirar(osId, eventoId, ator): Promise<EventoOSDto>`; endpoints `GET /ordens-servico/:id/eventos`, `POST /ordens-servico/:id/eventos` (201), `POST /ordens-servico/:id/eventos/:eventoId/retirar` (200).

Regras:
- `publicar`: confere que a OS existe na oficina (404); `visivelCliente` **derivado do tipo** (`ATUALIZACAO_CLIENTE` → true; `NOTA_INTERNA` → false), nunca do body.
- `retirar`: evento precisa ser da OS informada (404 se não), tipo `ATUALIZACAO_CLIENTE` e `retiradoEm` nulo (senão `422 EVENTO_NAO_RETIRAVEL`); se `ator.id !== evento.autorId` exige `temPermissao(ator.perfil, 'EQUIPE_GERENCIAR')` (senão `403 SEM_PERMISSAO`); grava `retiradoEm` e `retiradoPorId` com `updateMany where { id, retiradoEm: null }` (corrida de dois "retirar" → o segundo recebe 422). **Nunca** muda `visivelCliente` (a regra do portal combina os dois campos).
- `listar`: mais novos primeiro (`orderBy: [{ criadoEm: 'desc' }, { id: 'desc' }]`), com `autor` e `retiradoPor` (`id`, `nome`).

- [ ] **Passo 1: testes e2e (falhando)** — `test/os/eventos-os.e2e-spec.ts`:
```ts
describe('Eventos da OS', () => {
  it('publica nota interna (visivelCliente=false) e atualização (visivelCliente=true), listadas da mais nova para a mais antiga', async () => { … });
  it('body com visivelCliente=true numa NOTA_INTERNA continua false (Review Focus 4)', async () => { … });
  it('tipo COMENTARIO, OS_ABERTA ou VEICULO_TRANSFERIDO no body → 400', async () => { … });
  it('autor retira a própria atualização: retiradoEm e retiradoPor preenchidos, visivelCliente inalterado', async () => { … });
  it('outro FUNCIONARIO não retira a atualização alheia → 403; o DONO retira', async () => { … });
  it('retirar nota interna → 422; retirar de novo → 422 (Review Focus 4)', async () => { … });
  it('evento de outra OS na mesma oficina → 404', async () => { … });
  it('isolamento: listar/publicar/retirar na OS de B → 404 para A', async () => { … });
  it('paginação dos eventos respeita o limite máximo', async () => { … });
});
```

- [ ] **Passo 2: implementação.**

- [ ] **Passo 3: verificar e commitar.**
```bash
pnpm --filter @oficinatrack/api test && pnpm --filter @oficinatrack/api typecheck && pnpm lint
git add apps/api
git commit -m "feat(os): notas internas e atualizacoes para o cliente com retirada"
```

---

### Tarefa 7: Web — início e abertura de OS

Agent: `frontend-react`.

**Arquivos:** criar `features/os/api/{use-os-abertas.ts,use-abrir-os.ts,use-consulta-placa.ts}`, `features/os/pages/{inicio-os.tsx,abrir-os.tsx}` (+specs), `features/os/components/{cartao-os.tsx,dialogo-os-aberta.tsx,dialogo-dono-diferente.tsx,campo-placa.tsx,campo-telefone.tsx}`, `lib/formatar-data.ts` (acrescentar `tempoDesde(iso): string` → "há 5 min", "há 2 dias"); modificar `app/router.tsx`, `features/painel/pages/inicio-painel.tsx` (substituído pela lista).

**Interfaces:** consome `GET /ordens-servico?situacao=abertas`, `GET /veiculos/consulta?placa=`, `POST /ordens-servico`, `GET /usuarios` (só com `EQUIPE_GERENCIAR`); `abrirOsSchema`, `formatarNumeroOS`, `formatarPlaca`.

Comportamento:
- **Início (`/painel`):** busca no topo (envia para `/painel/busca?q=`); lista "OS em aberto" com `cartao-os` (número, placa formatada, modelo, cliente, "aberta há …"), paginação por "Carregar mais"; vazio: "Nenhuma OS em aberto. Toque em Abrir OS para começar."; botão flutuante "Abrir OS" (`h-14`, canto inferior direito, `bottom: calc(1rem + env(safe-area-inset-bottom))`) → `/painel/os/nova`.
- **Abrir OS (`/painel/os/nova`):**
  - `campo-placa`: `inputMode="text"`, `autoCapitalize="characters"`, converte para maiúsculas ao digitar; ao sair do campo (blur) com placa válida → `GET /veiculos/consulta`; 404 → nada; 200 → preenche WhatsApp e nome (se vazios), mostra "Gol · Prata" abaixo da placa, e se `osAberta` mostra o aviso D4 inline com "Abrir #0012" e "Criar nova mesmo assim" (marca `criarMesmoComOsAberta`).
  - `campo-telefone`: máscara `(43) 99999-8888`, `inputMode="tel"`.
  - Queixa: `textarea` com contador `x/1000`.
  - "Mais detalhes" (recolhido): nome do cliente, km (`inputMode="numeric"`), responsável (`select`: se tem `EQUIPE_GERENCIAR`, lista `GET /usuarios` ativos; senão opções "Eu" e "Ninguém"), previsão (`type="date"`).
  - Salvar → `POST`. `409 OS_ABERTA_EXISTENTE` → `dialogo-os-aberta` ("Este carro já está na OS #0012, aberta há 2 dias" / "Abrir #0012" / "Criar nova mesmo assim" / "Cancelar"). `409 VEICULO_DE_OUTRO_CLIENTE` → `dialogo-dono-diferente` ("Esta placa está cadastrada com João (…8888). O carro mudou de dono?" / "Sim, passar para {nome ou telefone digitado}" / "Não, só está trazendo" / "Cancelar") → reenvia com `transferirVeiculo`. Sucesso → `/painel/os/:id`.
  - Botões dos diálogos `h-11`, largura total no celular.
- Rotas: `/painel` (início), `/painel/os/nova`, `/painel/os/:id` (Tarefa 8).

- [ ] **Passo 1: testes (falhando)** — `inicio-os.spec.tsx` (lista, vazio, erro com "Tentar de novo", "Carregar mais"), `abrir-os.spec.tsx`:
```tsx
it('D4: 409 OS_ABERTA_EXISTENTE mostra o diálogo e "Criar nova mesmo assim" reenvia com criarMesmoComOsAberta', async () => { … });
it('D1: 409 VEICULO_DE_OUTRO_CLIENTE mostra dono e final do telefone; "Sim" reenvia com transferirVeiculo=true', async () => { … });
it('placa digitada em minúsculas aparece em maiúsculas e a consulta preenche o WhatsApp', async () => { … });
it('queixa curta mostra erro do schema e não chama a API', async () => { … });
it('FUNCIONARIO não carrega a lista da equipe (sem chamada a /usuarios) e vê "Eu"/"Ninguém"', async () => { … });
```
(escrever completos com `vi.stubGlobal('fetch', …)` e o helper `src/test/renderizar-auth.tsx`).

- [ ] **Passo 2: implementação.**

- [ ] **Passo 3: verificar e commitar.**
```bash
pnpm --filter @oficinatrack/web test && pnpm --filter @oficinatrack/web typecheck && pnpm --filter @oficinatrack/web build && pnpm lint
git add apps/web
git commit -m "feat(web): inicio com os em aberto e abertura rapida de os"
```

---

### Tarefa 8: Web — tela da OS

Agent: `frontend-react`.

**Arquivos:** criar `lib/whatsapp.ts` (+spec), `features/os/api/{use-detalhe-os.ts,use-alterar-os.ts,use-eventos-os.ts,use-publicar-evento.ts,use-retirar-evento.ts}`, `features/os/pages/detalhe-os.tsx` (+spec), `features/os/components/{cabecalho-os.tsx,editar-os.tsx,aba-eventos.tsx,item-evento.tsx}`.

**Interfaces (produz):** `linkWhatsApp(telefoneE164: string, texto: string): string` → `https://wa.me/5543999998888?text=…` (sem `+`, texto com `encodeURIComponent`); `mensagemAtualizacao({ nomeCliente, nomeOficina, veiculo, texto }): string` → `Olá, {nome ou "tudo bem"}! {oficina} sobre o {modelo ou placa formatada}: {texto}`.

- [ ] **Passo 1: testes (falhando).**

`lib/whatsapp.spec.ts` (Review Focus 3):
```ts
import { linkWhatsApp, mensagemAtualizacao } from './whatsapp';

describe('linkWhatsApp', () => {
  it('tira o + e codifica acentos, &, #, quebra de linha e emoji', () => {
    const texto = 'Peça & mão de obra #1\nChega amanhã 🚗';
    const url = linkWhatsApp('+5543999998888', texto);
    expect(url.startsWith('https://wa.me/5543999998888?text=')).toBe(true);
    expect(decodeURIComponent(url.split('?text=')[1]!)).toBe(texto);
    expect(url).not.toContain('#1');
    expect(url).not.toContain('\n');
  });
});

describe('mensagemAtualizacao', () => {
  it('usa o nome do cliente e o modelo; sem nome usa "tudo bem"; sem modelo usa a placa formatada', () => {
    expect(mensagemAtualizacao({ nomeCliente: 'João', nomeOficina: 'Oficina do Zé', veiculo: { modelo: 'Gol', placa: 'ABC1234' }, texto: 'Pronto!' }))
      .toBe('Olá, João! Oficina do Zé sobre o Gol: Pronto!');
    expect(mensagemAtualizacao({ nomeCliente: null, nomeOficina: 'Oficina do Zé', veiculo: { modelo: null, placa: 'ABC1234' }, texto: 'Pronto!' }))
      .toBe('Olá, tudo bem! Oficina do Zé sobre o ABC-1234: Pronto!');
  });
});
```
`detalhe-os.spec.tsx`: cabeçalho com `#0001`; aba "Atualizações para o cliente" lista só `ATUALIZACAO_CLIENTE` e aba "Notas internas" só `NOTA_INTERNA` + `VEICULO_TRANSFERIDO`; publicar na aba de notas envia `tipo: 'NOTA_INTERNA'`; depois de publicar atualização aparece "Avisar no WhatsApp" com o link de `linkWhatsApp`; "Retirar" pede confirmação e chama o endpoint; evento retirado aparece riscado com "Retirada por {nome} em {data}" e sem botão "Retirar"; "Retirar" só aparece para o autor ou para quem tem `EQUIPE_GERENCIAR`; `OS_ABERTA` aparece nas duas abas como marco "OS aberta".

- [ ] **Passo 2: implementação.** Cabeçalho: número (`font-display`), placa formatada, modelo/cor, cliente com botão "WhatsApp" (`linkWhatsApp(cliente.telefone, '')` → só abre a conversa), status em `Badge` ("Triagem" etc., texto em pt-BR), queixa, km, responsável, previsão; "Editar" abre `Sheet` com `alterarOsSchema` (responsável como na Tarefa 7). Abas com `Tabs` do shadcn (`pnpm --filter @oficinatrack/web exec shadcn add tabs`). Campo de publicação no rodapé da aba (textarea + "Publicar", contador `x/2000`). Paginação dos eventos com "Carregar anteriores".

- [ ] **Passo 3: verificar e commitar.**
```bash
pnpm --filter @oficinatrack/web test && pnpm --filter @oficinatrack/web typecheck && pnpm --filter @oficinatrack/web build && pnpm lint
git add apps/web
git commit -m "feat(web): tela da os com notas internas e atualizacoes para o cliente"
```

---

### Tarefa 9: Web — busca e fichas

Agent: `frontend-react`.

**Arquivos:** criar `features/busca/{api/use-busca.ts,pages/busca.tsx}` (+spec), `features/clientes/{api/*.ts,pages/ficha-cliente.tsx}` (+spec), `features/veiculos/{api/*.ts,pages/ficha-veiculo.tsx}` (+spec), `features/os/components/lista-os.tsx` (reuso do cartão para os históricos); modificar `layout-painel.tsx` (item "Buscar" entre Pátio e Equipe; "Pátio" continua levando ao início) e `router.tsx` (`/painel/busca`, `/painel/clientes/:id`, `/painel/veiculos/:id`).

Comportamento:
- **Busca:** campo com o termo da URL (`?q=`), busca ao enviar (não a cada tecla); resultados em duas seções ("Veículos", "Clientes"); vazio: "Nada encontrado para "{q}"." com botão "Abrir OS" (leva a `/painel/os/nova`, pré-preenchendo a placa se o termo for placa válida); termo com 1 caractere mostra a mensagem do schema sem chamar a API.
- **Ficha do cliente:** dados com "Editar" (`alterarClienteSchema`; `TELEFONE_JA_CADASTRADO` no campo WhatsApp), observações internas marcadas "Só a oficina vê", lista de veículos (cada um leva à ficha), histórico de OS paginado.
- **Ficha do veículo:** dados com "Editar" (`alterarVeiculoSchema`; `PLACA_JA_CADASTRADA` no campo placa), dono com link para a ficha do cliente, histórico de OS paginado, botão "Abrir OS para este carro" (pré-preenche placa).

- [ ] **Passo 1: testes (falhando):** busca (resultado com as duas seções; vazio com "Abrir OS"; 1 caractere não chama a API); ficha do cliente (editar e erro `TELEFONE_JA_CADASTRADO` no campo); ficha do veículo (erro `PLACA_JA_CADASTRADA` no campo; "Abrir OS para este carro" navega com a placa); layout mostra "Buscar" para FUNCIONARIO e DONO.
- [ ] **Passo 2: implementação.**
- [ ] **Passo 3: verificar e commitar.**
```bash
pnpm --filter @oficinatrack/web test && pnpm --filter @oficinatrack/web typecheck && pnpm --filter @oficinatrack/web build && pnpm lint
git add apps/web
git commit -m "feat(web): busca e fichas de cliente e veiculo"
```

---

### Tarefa 10: Docs e fechamento

- [ ] **Passo 1:** docs — `02` (C3 com duas áreas; D1; D4; retirada), `03` (módulos `clientes`, `veiculos`, `busca`, `ordens-servico`; coordenação da abertura; `$queryRaw … FOR UPDATE` no aceite de convite como uso permitido), `04` (tipos de evento, `COMENTARIO` obsoleto, `retiradoEm`/`retiradoPorId`), `06` (regra do portal `visivelCliente AND retiradoEm IS NULL`; paginação implementada nas listas novas — `GET /usuarios` e `GET /convites` continuam sem paginação, registrar), `CLAUDE.md` (nada novo além de apontar os módulos, se necessário).
- [ ] **Passo 2:** `pnpm lint && pnpm typecheck && pnpm test && pnpm audit --prod --audit-level high` limpos (Postgres e Mailpit rodando); commit `docs: sprint 3 os rapida`; `graphify update .`.
- [ ] **Passo 3 (controlador):** revisão final da branch, auditoria `seguranca` (`docs/auditorias/AAAA-MM-DD-sprint-3.md`), rodada única de correções, verificação completa e decisão sobre a branch.

---

## Autorrevisão

- **Cobertura da spec:** D1 (T5 API, T7 diálogo), D2 (T3 tipos, T6 API, T8 abas), D3 (T3 colunas, T6 retirar, T8 UI), D4 (T5 API, T7 aviso inline e diálogo), D5 (T4/T5 módulos e coordenação). Fluxos 1–4: T5/T7 (abrir), T6/T8 (tela da OS), T4/T9 (busca e fichas), T7 (início). Todos os 12 endpoints da tabela: T4 (busca, consulta, fichas), T5 (OS e históricos, consulta com `osAberta`), T6 (eventos). Paginação: T4 (`paginacao.ts`) usada em T5/T6. Erros novos: T4 (`TELEFONE_JA_CADASTRADO`, `PLACA_JA_CADASTRADA`), T5 (`OS_ABERTA_EXISTENTE`, `VEICULO_DE_OUTRO_CLIENTE`, `RESPONSAVEL_INVALIDO`), T6 (`EVENTO_NAO_RETIRAVEL`, `SEM_PERMISSAO`). Pendências da Sprint 2: T1. Docs: T10.
- **Mudança em relação à spec:** `COMENTARIO` mantido como obsoleto (dados de teste existentes) — registrado no topo e em T3/T10.
- **Review Focus:** 1 → T4 e T5; 2 → T5; 3 → T8 (`whatsapp.spec.ts`); 4 → T2 (schema) e T6; 5 → T4.
- **Consistência de nomes:** `obterOuCriar(tx, …)`, `buscarPorPlaca(placa, db?)`, `transferir`, `atualizarKmSeMaior`, `reservarNumeroOS(tx)`, `osAbertaDoVeiculo`, `abrir(dados, ator)`, `EventosOsService.publicar/retirar/listar`, `apagarPendentesDe(usuarioId, db?)`, `linkWhatsApp`, `mensagemAtualizacao`, `formatarNumeroOS`, `SITUACOES_ABERTAS` iguais em todas as tarefas.
- **Rota `GET /veiculos/consulta`:** criada na T4 em `VeiculosController` (com `osAberta: null`) e **movida** na T5 para `OrdensServicoController` (`@Controller()` + `@Get('veiculos/consulta')`) para não criar dependência de `veiculos` em `ordens-servico`. A T5 remove a rota antiga e garante que não há duas rotas iguais.
