# Sprint 1 — Fundação: plano de implementação

> **Para agentes:** SUB-SKILL OBRIGATÓRIA: use superpowers:subagent-driven-development (recomendado) ou superpowers:executing-plans para executar este plano tarefa por tarefa. Os passos usam checkbox (`- [ ]`).

**Objetivo:** deixar o monorepo pronto para as histórias do MVP: banco com o schema completo do MVP, API NestJS com isolamento entre oficinas garantido e testado, front React funcionando e CI rodando.

**Arquitetura:** monorepo pnpm com `packages/shared` (Zod, enums, normalização), `apps/api` (NestJS 12 ESM + Prisma 7 com driver adapter `pg`) e `apps/web` (React + Vite + Tailwind v4 + shadcn/ui + TanStack Query). O isolamento entre oficinas tem duas camadas: (1) extensão do Prisma que injeta `oficinaId` em toda consulta de model com tenant e falha fechada sem contexto; (2) chaves estrangeiras compostas `(oficinaId, id)` no banco, que impedem uma OS da oficina A apontar para um veículo da oficina B.

**Stack:** Node 22, pnpm 9, TypeScript 6.0 (não 7: `typescript-eslint` e ferramentas ainda exigem < 7), NestJS 12 (ESM), Prisma 7.10 (não o 8, que ainda é RC), PostgreSQL 17, nestjs-cls 7, Zod 4, React 19, Vite 8, Tailwind 4, Vitest 5, Supertest, oxlint.

**Spec:** `CLAUDE.md`, `docs/02-escopo-mvp.md`, `docs/03-arquitetura.md`, `docs/04-modelo-dados.md`, `docs/05-roadmap.md` (Sprint 1), `docs/06-seguranca.md` (T1, T6, T7, T8, T9).

## Decisões que mudam o que foi combinado antes

1. **Vitest em todo o monorepo, inclusive na API.** O NestJS 12 passou a ser ESM e o template oficial (`nest new`, tipo `esm`) já vem com Vitest; Jest em ESM exige `--experimental-vm-modules`. O motivo para usar Jest na API deixou de existir.
2. **MinIO fica para a Sprint 6** (upload de fotos), que é quando ele é usado. A imagem oficial do MinIO parou de ser mantida para a edição comunitária; escolher a alternativa (MinIO fixado numa versão, Garage ou SeaweedFS) faz mais sentido junto com o código de upload.
3. **Schema completo do MVP já na Sprint 1**, com as correções aprovadas: `Convite`, aceite dos termos na `Oficina`, índices começando por `oficinaId`, `oficinaId` também em `ItemOrcamento`, `familiaId` no `RefreshToken` (detecção de reuso, T3) e FKs compostas. Uma migração só, em vez de uma por sprint mexendo nas mesmas tabelas.

## Restrições globais

- `oficinaId` vem **sempre** do contexto (`TenantContext`), nunca de body/query/params.
- Recurso de outra oficina → **404**, nunca 403.
- Dinheiro em centavos (`Int`), nunca float.
- Placa: maiúsculas, sem hífen (`ABC1234` ou `ABC1D23`). Telefone: E.164 (`+5543999998888`).
- Erros da API: `{ statusCode, code, message, details? }`, `code` em SCREAMING_SNAKE_CASE.
- Rotas em `/api/v1`, kebab-case, plural.
- Nomes de domínio em português sem acento (`oficinaId`, `criadoEm`); termos do framework em inglês (`Controller`, `Service`, `Module`).
- Proibidos: `$queryRawUnsafe`, `$executeRawUnsafe`, `dangerouslySetInnerHTML`, `console.log` na API (usar `Logger`).
- Services usam inputs "unchecked" do Prisma (FK escalar, ex.: `clienteId`), nunca `connect` em relação com a oficina.
- Toda tela funciona em 360px.
- Commits em Conventional Commits, terminando com `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

Entradas e falhas que a spec implica, que nenhum teste "óbvio" cobriria, e que mais machucariam um usuário real. Cada linha tem teste na tarefa dona.

1. **Referência cruzada por FK:** a oficina A cria um veículo usando o `clienteId` de um cliente da oficina B. Esperado: o banco recusa (FK composta). Teste na Tarefa 4.
2. **Operação do Prisma não prevista pela extensão** (ex.: uma operação nova numa versão futura). Esperado: erro, nunca passar sem filtro. Teste na Tarefa 5.
3. **Trocar a oficina de um registro via `update`** (`data: { oficinaId: <outra> }`). Esperado: erro, registro intacto. Teste na Tarefa 5.
4. **Telefone digitado como as pessoas digitam:** `(43) 99999-8888`, `043 99999 8888`, `+55 43 99999-8888`, celular antigo de 8 dígitos (`43 8888-7777`), fixo, número estrangeiro. Esperado: E.164 correto ou `null`. Teste na Tarefa 2.
5. **Erro inesperado na API** (exceção qualquer, erro do Prisma). Esperado: `500` com mensagem genérica, sem stack trace nem mensagem do Prisma na resposta. Teste na Tarefa 3.

## Estrutura de arquivos

```
.
├── .github/workflows/ci.yml
├── .gitignore  .nvmrc  .editorconfig  .oxlintrc.json
├── package.json  pnpm-workspace.yaml  tsconfig.base.json
├── docker-compose.yml
├── infra/postgres/init/01-banco-teste.sql
├── packages/shared/
│   ├── package.json  tsconfig.json  tsconfig.build.json  vitest.config.ts
│   └── src/
│       ├── index.ts
│       ├── placa.ts  placa.spec.ts
│       ├── telefone.ts  telefone.spec.ts
│       ├── dinheiro.ts  dinheiro.spec.ts
│       ├── enums.ts
│       └── schemas/comuns.ts  schemas/comuns.spec.ts
├── apps/api/
│   ├── .env.example  package.json  nest-cli.json  tsconfig*.json
│   ├── vitest.config.ts  vitest.config.e2e.ts
│   ├── prisma.config.ts
│   ├── prisma/schema.prisma  prisma/migrations/
│   ├── src/
│   │   ├── main.ts  app.module.ts  configurar-app.ts
│   │   ├── config/env.ts  config/env.spec.ts
│   │   ├── common/erros/erro-negocio.ts  filtro-erros.ts  filtro-erros.spec.ts
│   │   ├── common/validacao/zod-validation.pipe.ts  zod-validation.pipe.spec.ts
│   │   ├── common/tenant/tenant-context.ts  tenant.module.ts
│   │   ├── prisma/prisma.service.ts  prisma.module.ts
│   │   ├── prisma/extensao-tenant.ts  extensao-tenant.spec.ts
│   │   ├── prisma/modelos-tenant.ts
│   │   └── modules/saude/saude.controller.ts  saude.module.ts
│   └── test/
│       ├── env-teste.ts  setup-global.ts  fabricas.ts
│       ├── saude.e2e-spec.ts
│       ├── tenant/isolamento.e2e-spec.ts
│       ├── tenant/fk-composta.e2e-spec.ts
│       └── regras-proibidas.spec.ts
└── apps/web/
    ├── package.json  vite.config.ts  tsconfig*.json  components.json  index.html
    └── src/
        ├── main.tsx  index.css
        ├── app/providers.tsx  app/router.tsx
        ├── lib/api.ts  lib/api.spec.ts  lib/utils.ts
        ├── components/ui/button.tsx       (gerado pelo shadcn)
        ├── features/saude/api/use-saude.ts
        ├── features/saude/components/status-api.tsx  status-api.spec.tsx
        └── pages/inicio.tsx
```

---

### Tarefa 0: Versionar os docs e abrir a branch

**Arquivos:** nenhum código novo.

- [ ] **Passo 1:** na `main`, commitar os docs, o `CLAUDE.md`, o `COMO-USAR.md`, o `.gitignore` e `.claude/`:

```bash
git add .gitignore CLAUDE.md COMO-USAR.md docs .claude
git commit -m "docs: documentacao do produto, agents e validacao de 24/09"
```

- [ ] **Passo 2:** criar a branch da sprint:

```bash
git switch -c sprint-1
```

---

### Tarefa 1: Monorepo, Docker Compose e lint

**Arquivos:**
- Criar: `package.json`, `pnpm-workspace.yaml`, `.nvmrc`, `.editorconfig`, `tsconfig.base.json`, `.oxlintrc.json`, `docker-compose.yml`, `infra/postgres/init/01-banco-teste.sql`
- Modificar: `.gitignore`

**Interfaces:**
- Produz: scripts raiz `dev`, `build`, `build:shared`, `lint`, `typecheck`, `test`; bancos `oficinatrack` e `oficinatrack_test` em `localhost:5432` (usuário e senha `oficinatrack`).

- [ ] **Passo 1: arquivos da raiz**

`package.json`:
```json
{
  "name": "oficinatrack",
  "private": true,
  "packageManager": "pnpm@9.15.9",
  "engines": { "node": ">=22.12" },
  "scripts": {
    "dev": "pnpm -r --parallel dev",
    "build": "pnpm -r build",
    "build:shared": "pnpm --filter @oficinatrack/shared build",
    "lint": "oxlint",
    "typecheck": "pnpm build:shared && pnpm -r typecheck",
    "test": "pnpm build:shared && pnpm -r test"
  },
  "devDependencies": {
    "oxlint": "^1.58.0"
  }
}
```

`pnpm-workspace.yaml`:
```yaml
packages:
  - "apps/*"
  - "packages/*"
```

`.nvmrc`:
```
22
```

`.editorconfig`:
```ini
root = true

[*]
charset = utf-8
end_of_line = lf
indent_style = space
indent_size = 2
insert_final_newline = true
trim_trailing_whitespace = true
```

`tsconfig.base.json`:
```json
{
  "compilerOptions": {
    "target": "ES2023",
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitOverride": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "isolatedModules": true
  }
}
```

`.oxlintrc.json`:
```json
{
  "$schema": "./node_modules/oxlint/configuration_schema.json",
  "plugins": ["typescript", "unicorn", "react", "import", "vitest"],
  "categories": { "correctness": "error", "suspicious": "warn" },
  "rules": {
    "no-console": "error",
    "react/react-in-jsx-scope": "off"
  },
  "ignorePatterns": ["**/dist/**", "**/generated/**", "**/coverage/**", "**/node_modules/**"]
}
```
Se o oxlint reclamar de um plugin desconhecido, remova só aquele plugin e siga.

`.gitignore` (substituir o conteúdo atual, que está vazio):
```
node_modules/
dist/
coverage/
*.tsbuildinfo
.env
.env.*
!.env.example
apps/api/src/generated/
graphify-out/
```

- [ ] **Passo 2: Docker Compose**

`docker-compose.yml` (o `name` fixo evita problema com o "á" no nome da pasta):
```yaml
name: oficinatrack

services:
  postgres:
    image: postgres:17-alpine
    environment:
      POSTGRES_USER: oficinatrack
      POSTGRES_PASSWORD: oficinatrack
      POSTGRES_DB: oficinatrack
    ports:
      - "5432:5432"
    volumes:
      - pgdata:/var/lib/postgresql/data
      - ./infra/postgres/init:/docker-entrypoint-initdb.d:ro
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U oficinatrack"]
      interval: 5s
      timeout: 5s
      retries: 10

volumes:
  pgdata:
```

`infra/postgres/init/01-banco-teste.sql`:
```sql
CREATE DATABASE oficinatrack_test;
```

- [ ] **Passo 3: verificar**

```bash
pnpm install
docker compose up -d --wait
docker compose exec postgres psql -U oficinatrack -c "\l" | grep oficinatrack_test
pnpm lint
```
Esperado: `oficinatrack_test` listado; lint sem erros (ainda não há código). Se a porta 5432 estiver ocupada, troque para `"5433:5432"` e ajuste todas as URLs do plano.

- [ ] **Passo 4: commit**

```bash
git add package.json pnpm-workspace.yaml pnpm-lock.yaml .nvmrc .editorconfig tsconfig.base.json .oxlintrc.json .gitignore docker-compose.yml infra
git commit -m "chore: monorepo pnpm, docker compose com postgres e oxlint"
```

---

### Tarefa 2: `packages/shared` (placa, telefone, dinheiro, enums, schemas)

**Arquivos:**
- Criar: `packages/shared/package.json`, `tsconfig.json`, `tsconfig.build.json`, `vitest.config.ts`, `src/index.ts`, `src/placa.ts`, `src/placa.spec.ts`, `src/telefone.ts`, `src/telefone.spec.ts`, `src/dinheiro.ts`, `src/dinheiro.spec.ts`, `src/enums.ts`, `src/schemas/comuns.ts`, `src/schemas/comuns.spec.ts`

**Interfaces:**
- Produz (importado de `@oficinatrack/shared`):
  - `normalizarPlaca(entrada: string): string | null`
  - `formatarPlaca(placa: string): string`
  - `normalizarTelefone(entrada: string): string | null`
  - `formatarCentavos(centavos: number): string`
  - `calcularTotalItemCentavos(quantidade: string, valorUnitarioCentavos: number): number`
  - enums Zod + tipos: `PerfilUsuario`, `StatusOS`, `TipoEvento`, `StatusOrcamento`, `TipoItem`, `StatusItem`
  - schemas: `placaSchema`, `telefoneSchema`

- [ ] **Passo 1: configuração do pacote**

`packages/shared/package.json`:
```json
{
  "name": "@oficinatrack/shared",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "exports": {
    ".": { "types": "./dist/index.d.ts", "default": "./dist/index.js" }
  },
  "scripts": {
    "build": "tsc -p tsconfig.build.json",
    "dev": "tsc -p tsconfig.build.json --watch --preserveWatchOutput",
    "typecheck": "tsc --noEmit",
    "test": "vitest run"
  },
  "dependencies": { "zod": "^4.6.5" },
  "devDependencies": { "typescript": "~6.0.3", "vitest": "^5.0.1" }
}
```

`packages/shared/tsconfig.json`:
```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "module": "nodenext",
    "moduleResolution": "nodenext",
    "rootDir": "src",
    "outDir": "dist",
    "declaration": true,
    "types": ["vitest/globals"]
  },
  "include": ["src"]
}
```

`packages/shared/tsconfig.build.json`:
```json
{
  "extends": "./tsconfig.json",
  "compilerOptions": { "types": [] },
  "exclude": ["src/**/*.spec.ts"]
}
```

`packages/shared/vitest.config.ts`:
```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: { globals: true, include: ['src/**/*.spec.ts'] },
});
```

Rodar `pnpm install` na raiz.

- [ ] **Passo 2: testes de placa (falhando)**

`src/placa.spec.ts`:
```ts
import { formatarPlaca, normalizarPlaca } from './placa.js';

describe('normalizarPlaca', () => {
  it.each([
    ['ABC1234', 'ABC1234'],
    ['abc-1234', 'ABC1234'],
    [' abc 1234 ', 'ABC1234'],
    ['ABC1D23', 'ABC1D23'],
    ['abc1d23', 'ABC1D23'],
    ['ABC-1D23', 'ABC1D23'],
  ])('%s → %s', (entrada, esperado) => {
    expect(normalizarPlaca(entrada)).toBe(esperado);
  });

  it.each(['', 'AB1234', 'ABCD123', 'ABC12345', '1234ABC', 'ABC1DD3', 'ÁBC1234'])(
    'rejeita %s',
    (entrada) => {
      expect(normalizarPlaca(entrada)).toBeNull();
    },
  );
});

describe('formatarPlaca', () => {
  it('coloca hífen na placa antiga', () => {
    expect(formatarPlaca('ABC1234')).toBe('ABC-1234');
  });

  it('mantém a placa Mercosul sem hífen', () => {
    expect(formatarPlaca('ABC1D23')).toBe('ABC1D23');
  });
});
```

Rodar: `pnpm --filter @oficinatrack/shared test` → FALHA (módulo não existe).

- [ ] **Passo 3: implementar placa**

`src/placa.ts`:
```ts
const PLACA_ANTIGA = /^[A-Z]{3}\d{4}$/;
const PLACA_MERCOSUL = /^[A-Z]{3}\d[A-Z]\d{2}$/;

/** Maiúsculas, sem separadores. `null` se não for placa antiga nem Mercosul. */
export function normalizarPlaca(entrada: string): string | null {
  const placa = entrada.toUpperCase().replace(/[\s-]/g, '');
  return PLACA_ANTIGA.test(placa) || PLACA_MERCOSUL.test(placa) ? placa : null;
}

/** Para exibição: `ABC-1234` (antiga) ou `ABC1D23` (Mercosul). */
export function formatarPlaca(placa: string): string {
  return PLACA_ANTIGA.test(placa) ? `${placa.slice(0, 3)}-${placa.slice(3)}` : placa;
}
```

Rodar os testes → PASSA.

- [ ] **Passo 4: testes de telefone (falhando)**

`src/telefone.spec.ts`:
```ts
import { normalizarTelefone } from './telefone.js';

describe('normalizarTelefone', () => {
  it.each([
    ['(43) 99999-8888', '+5543999998888'],
    ['43999998888', '+5543999998888'],
    ['043 99999 8888', '+5543999998888'],
    ['+55 43 99999-8888', '+5543999998888'],
    ['55 43 99999-8888', '+5543999998888'],
    ['5543999998888', '+5543999998888'],
    // celular antigo, sem o 9: acrescenta
    ['43 8888-7777', '+5543988887777'],
    // fixo
    ['(43) 3555-1234', '+554335551234'],
    // DDD 55 (Santa Maria/RS) não pode ser confundido com o código do país
    ['(55) 99999-8888', '+5555999998888'],
  ])('%s → %s', (entrada, esperado) => {
    expect(normalizarTelefone(entrada)).toBe(esperado);
  });

  it.each([
    '',
    '9999-8888', // sem DDD
    '(10) 99999-8888', // DDD inválido
    '(43) 89999-8888', // 9 dígitos sem começar com 9
    '(43) 1555-1234', // fixo começando com 1
    '+1 415 555 2671', // estrangeiro: fora do MVP
    '43 99999-88889', // dígito a mais
  ])('rejeita %s', (entrada) => {
    expect(normalizarTelefone(entrada)).toBeNull();
  });
});
```

Rodar → FALHA.

- [ ] **Passo 5: implementar telefone**

`src/telefone.ts`:
```ts
/**
 * Normaliza telefone brasileiro para E.164 (`+55DDNNNNNNNNN`).
 * Aceita máscara, DDI 55, zero de discagem e celular antigo de 8 dígitos.
 * Número estrangeiro retorna `null` (fora do MVP).
 */
export function normalizarTelefone(entrada: string): string | null {
  const texto = entrada.trim();
  let digitos = texto.replace(/\D/g, '');
  if (texto.startsWith('+') && !digitos.startsWith('55')) return null;

  digitos = digitos.replace(/^0+/, '');
  if ((digitos.length === 12 || digitos.length === 13) && digitos.startsWith('55')) {
    digitos = digitos.slice(2);
  }
  if (digitos.length !== 10 && digitos.length !== 11) return null;

  const ddd = digitos.slice(0, 2);
  if (ddd[0] === '0' || ddd[1] === '0') return null;

  let numero = digitos.slice(2);
  if (numero.length === 8 && /^[6-9]/.test(numero)) numero = `9${numero}`;
  if (numero.length === 9 && !numero.startsWith('9')) return null;
  if (numero.length === 8 && !/^[2-5]/.test(numero)) return null;

  return `+55${ddd}${numero}`;
}
```

Rodar → PASSA.

- [ ] **Passo 6: testes de dinheiro (falhando)**

`src/dinheiro.spec.ts`:
```ts
import { calcularTotalItemCentavos, formatarCentavos } from './dinheiro.js';

const semNbsp = (s: string) => s.replace(/ /g, ' ');

describe('formatarCentavos', () => {
  it('formata em reais', () => {
    expect(semNbsp(formatarCentavos(123456))).toBe('R$ 1.234,56');
    expect(semNbsp(formatarCentavos(5))).toBe('R$ 0,05');
  });

  it('recusa valor que não é inteiro', () => {
    expect(() => formatarCentavos(10.5)).toThrow(TypeError);
  });
});

describe('calcularTotalItemCentavos', () => {
  it.each([
    ['1', 15000, 15000],
    ['2', 4990, 9980],
    ['1.5', 3333, 5000], // 4999,5 → arredonda para cima
    ['0.333', 100, 33], // 33,3
    ['2.125', 999, 2123], // 2122,875
    ['0', 5000, 0],
  ])('%s × %i = %i', (quantidade, unitario, esperado) => {
    expect(calcularTotalItemCentavos(quantidade, unitario)).toBe(esperado);
  });

  it.each(['-1', '1.2345', 'abc', '1,5', ''])('recusa quantidade %s', (quantidade) => {
    expect(() => calcularTotalItemCentavos(quantidade, 100)).toThrow(TypeError);
  });

  it('recusa valor unitário negativo ou fracionado', () => {
    expect(() => calcularTotalItemCentavos('1', -1)).toThrow(TypeError);
    expect(() => calcularTotalItemCentavos('1', 1.5)).toThrow(TypeError);
  });
});
```

Rodar → FALHA.

- [ ] **Passo 7: implementar dinheiro**

`src/dinheiro.ts`:
```ts
const formatoBRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

export function formatarCentavos(centavos: number): string {
  if (!Number.isInteger(centavos)) throw new TypeError('centavos deve ser inteiro');
  return formatoBRL.format(centavos / 100);
}

/**
 * Total de um item em centavos: round(quantidade × valorUnitario), meio para cima.
 * `quantidade` vem como texto decimal com até 3 casas (formato do Prisma Decimal),
 * e a conta é feita em inteiros para não ter erro de ponto flutuante.
 */
export function calcularTotalItemCentavos(quantidade: string, valorUnitarioCentavos: number): number {
  if (!/^\d+(\.\d{1,3})?$/.test(quantidade)) throw new TypeError('quantidade inválida');
  if (!Number.isInteger(valorUnitarioCentavos) || valorUnitarioCentavos < 0) {
    throw new TypeError('valorUnitarioCentavos deve ser inteiro não negativo');
  }
  const [inteira, fracao = ''] = quantidade.split('.');
  const milesimos = BigInt(`${inteira}${fracao.padEnd(3, '0')}`);
  const totalMilesimos = milesimos * BigInt(valorUnitarioCentavos);
  return Number((totalMilesimos + 500n) / 1000n);
}
```

Rodar → PASSA.

- [ ] **Passo 8: enums, schemas e index**

`src/enums.ts`:
```ts
import { z } from 'zod';

export const PerfilUsuario = z.enum(['DONO', 'FUNCIONARIO']);
export type PerfilUsuario = z.infer<typeof PerfilUsuario>;

export const StatusOS = z.enum([
  'TRIAGEM',
  'DIAGNOSTICO',
  'AGUARDANDO_APROVACAO',
  'AGUARDANDO_PECA',
  'EM_EXECUCAO',
  'PRONTO',
  'ENTREGUE',
  'CANCELADO',
]);
export type StatusOS = z.infer<typeof StatusOS>;

export const TipoEvento = z.enum([
  'OS_ABERTA',
  'STATUS_ALTERADO',
  'COMENTARIO',
  'FOTO',
  'ORCAMENTO_ENVIADO',
  'ORCAMENTO_RESPONDIDO',
  'CHECKLIST_PREENCHIDO',
]);
export type TipoEvento = z.infer<typeof TipoEvento>;

export const StatusOrcamento = z.enum(['RASCUNHO', 'ENVIADO', 'RESPONDIDO', 'SUBSTITUIDO']);
export type StatusOrcamento = z.infer<typeof StatusOrcamento>;

export const TipoItem = z.enum(['PECA', 'MAO_DE_OBRA']);
export type TipoItem = z.infer<typeof TipoItem>;

export const StatusItem = z.enum(['PENDENTE', 'APROVADO', 'RECUSADO']);
export type StatusItem = z.infer<typeof StatusItem>;
```

`src/schemas/comuns.spec.ts`:
```ts
import { placaSchema, telefoneSchema } from './comuns.js';

describe('schemas comuns', () => {
  it('placaSchema normaliza', () => {
    expect(placaSchema.parse('abc-1234')).toBe('ABC1234');
  });

  it('placaSchema recusa com mensagem em português', () => {
    const r = placaSchema.safeParse('xx');
    expect(r.success).toBe(false);
    expect(r.error?.issues[0]?.message).toBe('Placa inválida');
  });

  it('telefoneSchema normaliza e recusa', () => {
    expect(telefoneSchema.parse('(43) 99999-8888')).toBe('+5543999998888');
    expect(telefoneSchema.safeParse('123').success).toBe(false);
  });
});
```

`src/schemas/comuns.ts`:
```ts
import { z } from 'zod';
import { normalizarPlaca } from '../placa.js';
import { normalizarTelefone } from '../telefone.js';

export const placaSchema = z.string().transform((valor, ctx) => {
  const placa = normalizarPlaca(valor);
  if (!placa) {
    ctx.addIssue({ code: 'custom', message: 'Placa inválida' });
    return z.NEVER;
  }
  return placa;
});

export const telefoneSchema = z.string().transform((valor, ctx) => {
  const telefone = normalizarTelefone(valor);
  if (!telefone) {
    ctx.addIssue({ code: 'custom', message: 'Telefone inválido' });
    return z.NEVER;
  }
  return telefone;
});
```

`src/index.ts`:
```ts
export * from './placa.js';
export * from './telefone.js';
export * from './dinheiro.js';
export * from './enums.js';
export * from './schemas/comuns.js';
```

- [ ] **Passo 9: verificar e commitar**

```bash
pnpm --filter @oficinatrack/shared test
pnpm --filter @oficinatrack/shared typecheck
pnpm build:shared
pnpm lint
git add packages/shared pnpm-lock.yaml
git commit -m "feat(shared): normalizacao de placa e telefone, dinheiro em centavos e enums"
```
Esperado: todos os testes passam; `packages/shared/dist/index.js` existe.

---

### Tarefa 3: API NestJS (configuração, erros, validação, saúde)

Agent: `backend-nest`.

**Arquivos:**
- Criar: `apps/api/` via `nest new`; depois `src/configurar-app.ts`, `src/config/env.ts`, `src/config/env.spec.ts`, `src/common/erros/erro-negocio.ts`, `src/common/erros/filtro-erros.ts`, `src/common/erros/filtro-erros.spec.ts`, `src/common/validacao/zod-validation.pipe.ts`, `src/common/validacao/zod-validation.pipe.spec.ts`, `src/modules/saude/saude.controller.ts`, `src/modules/saude/saude.module.ts`, `test/env-teste.ts`, `test/saude.e2e-spec.ts`, `.env.example`
- Modificar: `src/main.ts`, `src/app.module.ts`, `package.json`, `vitest.config.ts`, `vitest.config.e2e.ts`
- Remover: `src/app.controller.ts`, `src/app.service.ts`, `src/app.controller.spec.ts`, `test/app.e2e-spec.ts`, `.prettierrc`, `.oxlintrc.json` do app (o lint é o da raiz)

**Interfaces:**
- Produz:
  - `class ErroNegocio extends HttpException` — `new ErroNegocio(statusCode: number, code: string, message: string, details?: unknown)`
  - `type CorpoErro = { statusCode: number; code: string; message: string; details?: unknown }`
  - `class FiltroErros implements ExceptionFilter` com `converter(erro: unknown): CorpoErro`
  - `class ZodValidationPipe` — `@Body(new ZodValidationPipe(schema))`
  - `configurarApp(app: INestApplication): void` (usado no `main.ts` e nos testes e2e)
  - `validarEnv(config: Record<string, unknown>): Env`; `type Env`
  - `GET /api/v1/saude` → `200 { status: 'ok' }` (a checagem do banco entra na Tarefa 4)

- [ ] **Passo 1: gerar o app**

```bash
cd apps
pnpm dlx @nestjs/cli@12 new api --type esm --strict --skip-git --package-manager pnpm
cd ..
```
Depois:
- `apps/api/package.json`: `"name": "@oficinatrack/api"`; trocar `lint` por `"lint": "oxlint ."`; adicionar `"typecheck": "tsc --noEmit"`; trocar `test` por `"test": "vitest run && vitest run --config vitest.config.e2e.ts"`; adicionar `"dev": "nest start --watch"`.
- `tsconfig.json`: `"extends": "../../tsconfig.base.json"` mantendo as opções geradas (`module`/`moduleResolution` `nodenext`, `emitDecoratorMetadata`, `experimentalDecorators`).
- Remover os arquivos listados acima e limpar o `AppModule`.
- Instalar: `pnpm --filter @oficinatrack/api add @nestjs/config @nestjs/throttler @nestjs/swagger helmet zod@^4.6.5 @oficinatrack/shared@workspace:*` e `pnpm --filter @oficinatrack/api add -D vitest@^5.0.1 @vitest/coverage-v8@^5.0.1`.
- Se os testes do Nest falharem com Vitest 5 por falta de metadados de decorator (injeção retornando `undefined`), voltar para `vitest@^4.1.11` na API **e** nos outros pacotes, para manter uma versão só.

- [ ] **Passo 2: env (teste falhando → implementação)**

`src/config/env.spec.ts`:
```ts
import { validarEnv } from './env.js';

const valido = {
  DATABASE_URL: 'postgresql://u:s@localhost:5432/db',
  CORS_ORIGEM: 'http://localhost:5173',
};

describe('validarEnv', () => {
  it('aplica padrões', () => {
    const env = validarEnv(valido);
    expect(env.PORT).toBe(3000);
    expect(env.NODE_ENV).toBe('development');
  });

  it('falha listando só os nomes das variáveis, sem os valores', () => {
    expect(() => validarEnv({ DATABASE_URL: 'segredo' })).toThrow(/CORS_ORIGEM/);
    expect(() => validarEnv({ DATABASE_URL: 'segredo' })).not.toThrow(/segredo/);
  });
});
```

`src/config/env.ts`:
```ts
import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  DATABASE_URL: z.string().min(1),
  CORS_ORIGEM: z.url(),
});

export type Env = z.infer<typeof envSchema>;

export function validarEnv(config: Record<string, unknown>): Env {
  const resultado = envSchema.safeParse(config);
  if (!resultado.success) {
    const nomes = resultado.error.issues.map((i) => i.path.join('.')).join(', ');
    throw new Error(`Variáveis de ambiente inválidas: ${nomes}`);
  }
  return resultado.data;
}
```

`.env.example`:
```
NODE_ENV=development
PORT=3000
DATABASE_URL=postgresql://oficinatrack:oficinatrack@localhost:5432/oficinatrack
CORS_ORIGEM=http://localhost:5173
```
Copiar para `apps/api/.env`.

- [ ] **Passo 3: erros (teste falhando → implementação)**

`src/common/erros/filtro-erros.spec.ts`:
```ts
import { NotFoundException } from '@nestjs/common';
import { ThrottlerException } from '@nestjs/throttler';
import { ErroNegocio } from './erro-negocio.js';
import { FiltroErros } from './filtro-erros.js';

describe('FiltroErros.converter', () => {
  const filtro = new FiltroErros();

  it('mantém o código do erro de negócio', () => {
    const corpo = filtro.converter(new ErroNegocio(422, 'OS_STATUS_INVALIDO', 'Transição inválida', { de: 'ENTREGUE' }));
    expect(corpo).toEqual({ statusCode: 422, code: 'OS_STATUS_INVALIDO', message: 'Transição inválida', details: { de: 'ENTREGUE' } });
  });

  it('converte 404 do Nest', () => {
    expect(filtro.converter(new NotFoundException())).toEqual({
      statusCode: 404, code: 'RECURSO_NAO_ENCONTRADO', message: 'Recurso não encontrado',
    });
  });

  it('converte rate limit', () => {
    expect(filtro.converter(new ThrottlerException()).code).toBe('MUITAS_REQUISICOES');
  });

  it('esconde detalhes de erro inesperado', () => {
    const corpo = filtro.converter(new Error('senha do banco: xyz'));
    expect(corpo).toEqual({ statusCode: 500, code: 'ERRO_INTERNO', message: 'Erro interno' });
    expect(JSON.stringify(corpo)).not.toContain('xyz');
  });
});
```

`src/common/erros/erro-negocio.ts`:
```ts
import { HttpException } from '@nestjs/common';

export type CorpoErro = { statusCode: number; code: string; message: string; details?: unknown };

export class ErroNegocio extends HttpException {
  constructor(statusCode: number, readonly code: string, message: string, readonly details?: unknown) {
    super({ statusCode, code, message, details }, statusCode);
  }

  corpo(): CorpoErro {
    const corpo: CorpoErro = { statusCode: this.getStatus(), code: this.code, message: this.message };
    if (this.details !== undefined) corpo.details = this.details;
    return corpo;
  }
}
```

`src/common/erros/filtro-erros.ts`:
```ts
import { ArgumentsHost, Catch, ExceptionFilter, HttpException, Logger } from '@nestjs/common';
import type { Response } from 'express';
import { CorpoErro, ErroNegocio } from './erro-negocio.js';

const CODIGOS_HTTP: Record<number, [string, string]> = {
  400: ['REQUISICAO_INVALIDA', 'Requisição inválida'],
  401: ['NAO_AUTENTICADO', 'Não autenticado'],
  403: ['SEM_PERMISSAO', 'Sem permissão'],
  404: ['RECURSO_NAO_ENCONTRADO', 'Recurso não encontrado'],
  409: ['CONFLITO', 'Conflito'],
  413: ['CORPO_MUITO_GRANDE', 'Requisição muito grande'],
  429: ['MUITAS_REQUISICOES', 'Muitas requisições. Tente de novo em instantes'],
};

@Catch()
export class FiltroErros implements ExceptionFilter {
  private readonly logger = new Logger(FiltroErros.name);

  catch(erro: unknown, host: ArgumentsHost): void {
    const corpo = this.converter(erro);
    if (corpo.statusCode >= 500) {
      this.logger.error(erro instanceof Error ? erro.stack : String(erro));
    }
    host.switchToHttp().getResponse<Response>().status(corpo.statusCode).json(corpo);
  }

  converter(erro: unknown): CorpoErro {
    if (erro instanceof ErroNegocio) return erro.corpo();
    if (erro instanceof HttpException) {
      const status = erro.getStatus();
      const [code, message] = CODIGOS_HTTP[status] ?? ['ERRO_HTTP', 'Erro na requisição'];
      return { statusCode: status, code, message };
    }
    return { statusCode: 500, code: 'ERRO_INTERNO', message: 'Erro interno' };
  }
}
```

Rodar `pnpm --filter @oficinatrack/api exec vitest run src/common/erros` → PASSA.

- [ ] **Passo 4: pipe de validação (teste falhando → implementação)**

`src/common/validacao/zod-validation.pipe.spec.ts`:
```ts
import { z } from 'zod';
import { placaSchema } from '@oficinatrack/shared';
import { ErroNegocio } from '../erros/erro-negocio.js';
import { ZodValidationPipe } from './zod-validation.pipe.js';

const pipe = new ZodValidationPipe(z.object({ placa: placaSchema, km: z.number().int().optional() }));

describe('ZodValidationPipe', () => {
  it('devolve o dado já normalizado', () => {
    expect(pipe.transform({ placa: 'abc-1234' })).toEqual({ placa: 'ABC1234' });
  });

  it('lança VALIDACAO_FALHOU com os campos', () => {
    try {
      pipe.transform({ placa: 'x', km: 1.5 });
      expect.unreachable();
    } catch (e) {
      expect(e).toBeInstanceOf(ErroNegocio);
      const corpo = (e as ErroNegocio).corpo();
      expect(corpo.statusCode).toBe(400);
      expect(corpo.code).toBe('VALIDACAO_FALHOU');
      expect(corpo.details).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ campo: 'placa', mensagem: 'Placa inválida' }),
          expect.objectContaining({ campo: 'km' }),
        ]),
      );
    }
  });
});
```

`src/common/validacao/zod-validation.pipe.ts`:
```ts
import { PipeTransform } from '@nestjs/common';
import type { z } from 'zod';
import { ErroNegocio } from '../erros/erro-negocio.js';

export class ZodValidationPipe<T extends z.ZodType> implements PipeTransform<unknown, z.output<T>> {
  constructor(private readonly schema: T) {}

  transform(valor: unknown): z.output<T> {
    const resultado = this.schema.safeParse(valor);
    if (!resultado.success) {
      throw new ErroNegocio(
        400,
        'VALIDACAO_FALHOU',
        'Dados inválidos',
        resultado.error.issues.map((i) => ({ campo: i.path.join('.'), mensagem: i.message })),
      );
    }
    return resultado.data;
  }
}
```

Rodar → PASSA.

- [ ] **Passo 5: app, saúde e segurança básica**

`src/modules/saude/saude.controller.ts`:
```ts
import { Controller, Get } from '@nestjs/common';

@Controller('saude')
export class SaudeController {
  @Get()
  verificar(): { status: 'ok' } {
    return { status: 'ok' };
  }
}
```

`src/modules/saude/saude.module.ts`:
```ts
import { Module } from '@nestjs/common';
import { SaudeController } from './saude.controller.js';

@Module({ controllers: [SaudeController] })
export class SaudeModule {}
```

`src/app.module.ts`:
```ts
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { validarEnv } from './config/env.js';
import { SaudeModule } from './modules/saude/saude.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: validarEnv }),
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 120 }]),
    SaudeModule,
  ],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
```

`src/configurar-app.ts`:
```ts
import type { INestApplication } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import type { Env } from './config/env.js';
import { FiltroErros } from './common/erros/filtro-erros.js';

export function configurarApp(app: INestApplication): void {
  const config = app.get(ConfigService<Env, true>);
  const express = app as NestExpressApplication;

  express.use(helmet());
  express.useBodyParser('json', { limit: '100kb' });
  express.enableCors({ origin: config.get('CORS_ORIGEM', { infer: true }), credentials: true });
  express.setGlobalPrefix('api/v1');
  express.useGlobalFilters(new FiltroErros());
  express.enableShutdownHooks();

  if (config.get('NODE_ENV', { infer: true }) !== 'production') {
    const doc = SwaggerModule.createDocument(
      express,
      new DocumentBuilder().setTitle('OficinaTrack API').setVersion('1').build(),
    );
    SwaggerModule.setup('api/docs', express, doc);
  }
}
```

`src/main.ts`:
```ts
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module.js';
import type { Env } from './config/env.js';
import { configurarApp } from './configurar-app.js';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { bodyParser: false });
  configurarApp(app);
  await app.listen(app.get(ConfigService<Env, true>).get('PORT', { infer: true }));
}
void bootstrap();
```
(`bodyParser: false` porque o `configurarApp` registra o parser com limite.)

Atenção: o erro de corpo grande nasce no middleware do Express, que pode não passar pelo `FiltroErros`. Se o teste "recusa corpo acima de 100kb" receber HTML em vez do JSON padrão, registre no `configurarApp`, logo depois do `useBodyParser`, um middleware de erro do Express que converta `err.type === 'entity.too.large'` em `413 { statusCode: 413, code: 'CORPO_MUITO_GRANDE', message: 'Requisição muito grande' }` e JSON malformado (`entity.parse.failed`) em `400 REQUISICAO_INVALIDA`.

- [ ] **Passo 6: teste e2e (falhando antes do Passo 5, passando depois)**

`test/env-teste.ts`:
```ts
export const ENV_TESTE = {
  NODE_ENV: 'test',
  DATABASE_URL:
    process.env.DATABASE_URL_TEST ??
    'postgresql://oficinatrack:oficinatrack@localhost:5432/oficinatrack_test',
  CORS_ORIGEM: 'http://localhost:5173',
};
```

`vitest.config.e2e.ts` (manter o `tsconfigPaths` do template):
```ts
import { defineConfig } from 'vitest/config';
import tsconfigPaths from 'vite-tsconfig-paths';
import { ENV_TESTE } from './test/env-teste.js';

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    globals: true,
    root: './',
    include: ['test/**/*.e2e-spec.ts'],
    env: ENV_TESTE,
  },
});
```
`vitest.config.ts` (unitários): `include: ['src/**/*.spec.ts', 'test/**/*.spec.ts']` e `env: ENV_TESTE`.

`test/saude.e2e-spec.ts`:
```ts
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { configurarApp } from '../src/configurar-app.js';

describe('Saúde e formato de erro (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const modulo = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = modulo.createNestApplication({ bodyParser: false });
    configurarApp(app);
    await app.init();
  });

  afterAll(() => app.close());

  it('GET /api/v1/saude responde ok', async () => {
    const res = await request(app.getHttpServer()).get('/api/v1/saude').expect(200);
    expect(res.body).toEqual({ status: 'ok' });
  });

  it('rota inexistente usa o formato padrão de erro', async () => {
    const res = await request(app.getHttpServer()).get('/api/v1/nao-existe').expect(404);
    expect(res.body).toEqual({ statusCode: 404, code: 'RECURSO_NAO_ENCONTRADO', message: 'Recurso não encontrado' });
  });

  it('envia cabeçalhos do Helmet', async () => {
    const res = await request(app.getHttpServer()).get('/api/v1/saude');
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['x-powered-by']).toBeUndefined();
  });

  it('recusa corpo acima de 100kb', async () => {
    const grande = { texto: 'x'.repeat(150_000) };
    const res = await request(app.getHttpServer()).post('/api/v1/saude').send(grande);
    expect(res.status).toBe(413);
    expect(res.body.code).toBe('CORPO_MUITO_GRANDE');
  });
});
```

- [ ] **Passo 7: verificar e commitar**

```bash
pnpm --filter @oficinatrack/api test
pnpm --filter @oficinatrack/api typecheck
pnpm lint
git add apps/api pnpm-lock.yaml
git commit -m "feat(api): nestjs com config validada, formato de erro, pipe zod, helmet e throttler"
```

---

### Tarefa 4: Prisma, schema do MVP e FKs compostas

Agent: `arquiteto-dados`.

**Arquivos:**
- Criar: `apps/api/prisma.config.ts`, `apps/api/prisma/schema.prisma`, `apps/api/prisma/migrations/*`, `apps/api/src/prisma/prisma.service.ts`, `apps/api/src/prisma/prisma.module.ts`, `apps/api/test/setup-global.ts`, `apps/api/test/tenant/fk-composta.e2e-spec.ts`
- Modificar: `apps/api/package.json`, `apps/api/vitest.config.e2e.ts`, `apps/api/src/app.module.ts`, `apps/api/src/modules/saude/*`, `docs/04-modelo-dados.md`

**Interfaces:**
- Consome: `ENV_TESTE` (Tarefa 3).
- Produz:
  - `PrismaService` com a propriedade `db` (na Tarefa 5 ela passa a ser o cliente com a extensão de tenant). Nesta tarefa, `db` é o `PrismaClient` puro.
  - Cliente gerado em `apps/api/src/generated/prisma/` (import `../generated/prisma/client.js`).
  - `GET /api/v1/saude` → `{ status: 'ok', banco: 'ok' }`.

- [ ] **Passo 1: dependências e config**

```bash
pnpm --filter @oficinatrack/api add @prisma/client@7.10.0 @prisma/adapter-pg@7.10.0 pg dotenv
pnpm --filter @oficinatrack/api add -D prisma@7.10.0 @types/pg
```
Fixar exatamente 7.10.0: a tag `latest` do pacote `prisma` aponta para o 8.0 RC.

`apps/api/prisma.config.ts`:
```ts
import 'dotenv/config';
import { defineConfig, env } from 'prisma/config';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: { path: 'prisma/migrations' },
  datasource: { url: env('DATABASE_URL') },
});
```

Scripts em `apps/api/package.json`:
```json
"prisma:generate": "prisma generate",
"prisma:migrate": "prisma migrate dev",
"test": "prisma generate && vitest run && vitest run --config vitest.config.e2e.ts",
"typecheck": "prisma generate && tsc --noEmit",
"build": "prisma generate && nest build"
```

Antes de escrever o schema, confira na documentação oficial do Prisma 7 o nome do gerador (`prisma-client`) e as opções `output`/`moduleFormat`. Se algo divergir do schema abaixo, siga a documentação e anote a diferença no `docs/04-modelo-dados.md`.

- [ ] **Passo 2: schema**

`apps/api/prisma/schema.prisma`. Regras aplicadas, além do rascunho do `docs/04`:
- toda tabela da oficina tem `oficinaId` + relação com `Oficina`;
- models referenciados por outros têm `@@unique([oficinaId, id])`, e as relações obrigatórias entre tabelas da oficina usam FK composta `(oficinaId, xId)`;
- relações **opcionais** com usuário (`responsavel`, `autor`) e `Foto.evento` ficam com FK simples: FK composta com um campo opcional e outro obrigatório não funciona bem com `SET NULL`. A validação delas fica no service da sprint que as usa (Sprints 3, 4 e 6), com teste de isolamento;
- `RefreshToken` não tem `oficinaId`: é infraestrutura de autenticação, consultada por hash antes de existir contexto.

```prisma
generator client {
  provider     = "prisma-client"
  output       = "../src/generated/prisma"
  moduleFormat = "esm"
}

datasource db {
  provider = "postgresql"
}

enum PerfilUsuario {
  DONO
  FUNCIONARIO
}

enum StatusOS {
  TRIAGEM
  DIAGNOSTICO
  AGUARDANDO_APROVACAO
  AGUARDANDO_PECA
  EM_EXECUCAO
  PRONTO
  ENTREGUE
  CANCELADO
}

enum TipoEvento {
  OS_ABERTA
  STATUS_ALTERADO
  COMENTARIO
  FOTO
  ORCAMENTO_ENVIADO
  ORCAMENTO_RESPONDIDO
  CHECKLIST_PREENCHIDO
}

enum StatusOrcamento {
  RASCUNHO
  ENVIADO
  RESPONDIDO
  SUBSTITUIDO
}

enum TipoItem {
  PECA
  MAO_DE_OBRA
}

enum StatusItem {
  PENDENTE
  APROVADO
  RECUSADO
}

model Oficina {
  id              String   @id @default(cuid())
  nome            String
  documento       String?  // CNPJ ou CPF, só dígitos
  telefone        String   // E.164
  endereco        String?
  cidade          String?
  uf              String?  @db.Char(2)
  logoKey         String?
  proximoNumeroOS Int      @default(1)
  termosVersao    String   // versão dos termos aceitos no cadastro (LGPD)
  termosAceitosEm DateTime
  criadoEm        DateTime @default(now())
  atualizadoEm    DateTime @updatedAt

  usuarios       Usuario[]
  convites       Convite[]
  clientes       Cliente[]
  veiculos       Veiculo[]
  ordensServico  OrdemServico[]
  checklists     ChecklistEntrada[]
  eventos        EventoOS[]
  fotos          Foto[]
  orcamentos     Orcamento[]
  itensOrcamento ItemOrcamento[]
  acessosCliente AcessoCliente[]
}

model Usuario {
  id           String        @id @default(cuid())
  oficinaId    String
  oficina      Oficina       @relation(fields: [oficinaId], references: [id])
  nome         String
  email        String?       @unique
  telefone     String?       @unique
  senhaHash    String
  perfil       PerfilUsuario
  ativo        Boolean       @default(true)
  criadoEm     DateTime      @default(now())
  atualizadoEm DateTime      @updatedAt

  refreshTokens   RefreshToken[]
  convitesCriados Convite[]
  osResponsavel   OrdemServico[] @relation("ResponsavelOS")
  eventos         EventoOS[]

  @@unique([oficinaId, id])
}

model RefreshToken {
  id         String    @id @default(cuid())
  usuarioId  String
  usuario    Usuario   @relation(fields: [usuarioId], references: [id], onDelete: Cascade)
  familiaId  String    // tokens da mesma sessão; reuso de um token revoga a família (T3)
  tokenHash  String    @unique
  expiraEm   DateTime
  revogadoEm DateTime?
  criadoEm   DateTime  @default(now())

  @@index([usuarioId])
  @@index([familiaId])
}

model Convite {
  id          String        @id @default(cuid())
  oficinaId   String
  oficina     Oficina       @relation(fields: [oficinaId], references: [id])
  nome        String
  email       String?
  telefone    String?       // E.164
  perfil      PerfilUsuario @default(FUNCIONARIO)
  tokenHash   String        @unique
  expiraEm    DateTime
  usadoEm     DateTime?
  criadoPorId String
  criadoPor   Usuario       @relation(fields: [oficinaId, criadoPorId], references: [oficinaId, id])
  criadoEm    DateTime      @default(now())

  @@index([oficinaId, criadoEm])
}

model Cliente {
  id           String   @id @default(cuid())
  oficinaId    String
  oficina      Oficina  @relation(fields: [oficinaId], references: [id])
  nome         String?  // opcional: abertura rápida só com telefone
  telefone     String   // E.164, WhatsApp
  email        String?
  documento    String?
  observacoes  String?  // interno, nunca vai ao portal
  criadoEm     DateTime @default(now())
  atualizadoEm DateTime @updatedAt

  veiculos      Veiculo[]
  ordensServico OrdemServico[]
  acessos       AcessoCliente[]

  @@unique([oficinaId, id])
  @@unique([oficinaId, telefone])
  @@index([oficinaId, nome])
}

model Veiculo {
  id           String   @id @default(cuid())
  oficinaId    String
  oficina      Oficina  @relation(fields: [oficinaId], references: [id])
  clienteId    String
  cliente      Cliente  @relation(fields: [oficinaId, clienteId], references: [oficinaId, id])
  placa        String   // normalizada: AAA0A00 / AAA0000
  marca        String?
  modelo       String?
  anoModelo    Int?
  cor          String?
  chassi       String?
  kmAtual      Int?
  criadoEm     DateTime @default(now())
  atualizadoEm DateTime @updatedAt

  ordensServico OrdemServico[]

  @@unique([oficinaId, id])
  @@unique([oficinaId, placa])
  @@index([oficinaId, clienteId])
}

model OrdemServico {
  id              String    @id @default(cuid())
  oficinaId       String
  oficina         Oficina   @relation(fields: [oficinaId], references: [id])
  numero          Int
  veiculoId       String
  veiculo         Veiculo   @relation(fields: [oficinaId, veiculoId], references: [oficinaId, id])
  clienteId       String
  cliente         Cliente   @relation(fields: [oficinaId, clienteId], references: [oficinaId, id])
  responsavelId   String?
  responsavel     Usuario?  @relation("ResponsavelOS", fields: [responsavelId], references: [id])
  status          StatusOS  @default(TRIAGEM)
  statusDesde     DateTime  @default(now())
  relatoCliente   String    // queixa: obrigatória na abertura
  diagnostico     String?
  kmEntrada       Int?
  previsaoEntrega DateTime?
  entregueEm      DateTime?
  criadoEm        DateTime  @default(now())
  atualizadoEm    DateTime  @updatedAt

  checklist  ChecklistEntrada?
  eventos    EventoOS[]
  orcamentos Orcamento[]
  fotos      Foto[]

  @@unique([oficinaId, id])
  @@unique([oficinaId, numero])
  @@index([oficinaId, status])
  @@index([oficinaId, veiculoId])
}

model ChecklistEntrada {
  id               String       @id @default(cuid())
  oficinaId        String
  oficina          Oficina      @relation(fields: [oficinaId], references: [id])
  ordemServicoId   String       @unique
  ordemServico     OrdemServico @relation(fields: [oficinaId, ordemServicoId], references: [oficinaId, id], onDelete: Cascade)
  nivelCombustivel Int?         // 0 a 100
  km               Int?
  itens            Json         @default("[]") // [{ chave: "estepe", presente: true }]
  avarias          Json         @default("[]") // [{ local: "porta_dianteira_esq", descricao: "risco" }]
  observacoes      String?
  criadoEm         DateTime     @default(now())

  @@index([oficinaId])
}

model EventoOS {
  id             String       @id @default(cuid())
  oficinaId      String
  oficina        Oficina      @relation(fields: [oficinaId], references: [id])
  ordemServicoId String
  ordemServico   OrdemServico @relation(fields: [oficinaId, ordemServicoId], references: [oficinaId, id], onDelete: Cascade)
  autorId        String?      // null = cliente/sistema
  autor          Usuario?     @relation(fields: [autorId], references: [id])
  tipo           TipoEvento
  texto          String?
  statusDe       StatusOS?
  statusPara     StatusOS?
  visivelCliente Boolean      @default(true)
  criadoEm       DateTime     @default(now())

  fotos Foto[]

  @@unique([oficinaId, id])
  @@index([oficinaId, ordemServicoId, criadoEm])
}

model Foto {
  id             String       @id @default(cuid())
  oficinaId      String
  oficina        Oficina      @relation(fields: [oficinaId], references: [id])
  ordemServicoId String
  ordemServico   OrdemServico @relation(fields: [oficinaId, ordemServicoId], references: [oficinaId, id], onDelete: Cascade)
  eventoId       String?
  evento         EventoOS?    @relation(fields: [eventoId], references: [id])
  storageKey     String
  legenda        String?
  visivelCliente Boolean      @default(true)
  criadoEm       DateTime     @default(now())

  @@index([oficinaId, ordemServicoId])
}

model Orcamento {
  id                String          @id @default(cuid())
  oficinaId         String
  oficina           Oficina         @relation(fields: [oficinaId], references: [id])
  ordemServicoId    String
  ordemServico      OrdemServico    @relation(fields: [oficinaId, ordemServicoId], references: [oficinaId, id], onDelete: Cascade)
  versao            Int
  status            StatusOrcamento @default(RASCUNHO)
  observacoes       String?
  validadeDias      Int             @default(7)
  enviadoEm         DateTime?
  respondidoEm      DateTime?
  respostaIp        String?
  respostaUserAgent String?
  criadoEm          DateTime        @default(now())

  itens ItemOrcamento[]

  @@unique([oficinaId, id])
  @@unique([ordemServicoId, versao])
  @@index([oficinaId, ordemServicoId])
}

model ItemOrcamento {
  id                    String     @id @default(cuid())
  oficinaId             String
  oficina               Oficina    @relation(fields: [oficinaId], references: [id])
  orcamentoId           String
  orcamento             Orcamento  @relation(fields: [oficinaId, orcamentoId], references: [oficinaId, id], onDelete: Cascade)
  tipo                  TipoItem
  descricao             String
  quantidade            Decimal    @db.Decimal(10, 3)
  valorUnitarioCentavos Int
  status                StatusItem @default(PENDENTE)
  ordem                 Int        @default(0)

  @@index([oficinaId, orcamentoId])
}

model AcessoCliente {
  id          String    @id @default(cuid())
  oficinaId   String
  oficina     Oficina   @relation(fields: [oficinaId], references: [id])
  clienteId   String
  cliente     Cliente   @relation(fields: [oficinaId, clienteId], references: [oficinaId, id], onDelete: Cascade)
  tokenHash   String    @unique
  expiraEm    DateTime
  revogadoEm  DateTime?
  ultimoUsoEm DateTime?
  criadoEm    DateTime  @default(now())

  @@index([oficinaId, clienteId])
}
```

- [ ] **Passo 3: migração**

```bash
pnpm --filter @oficinatrack/api exec prisma migrate dev --name schema_inicial_mvp
```
Esperado: `prisma/migrations/<timestamp>_schema_inicial_mvp/migration.sql` criado; cliente gerado em `src/generated/prisma/`. Abrir o `migration.sql` e conferir que as FKs de `Veiculo`, `OrdemServico`, `ChecklistEntrada`, `EventoOS`, `Foto`, `Orcamento`, `ItemOrcamento`, `AcessoCliente` e `Convite.criadoPor` são compostas `("oficinaId", "...")`.

- [ ] **Passo 4: `PrismaService` e saúde com banco**

`src/prisma/prisma.service.ts`:
```ts
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
```

`src/prisma/prisma.module.ts`:
```ts
import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service.js';

@Global()
@Module({ providers: [PrismaService], exports: [PrismaService] })
export class PrismaModule {}
```

Importar `PrismaModule` no `AppModule`. Atualizar `SaudeController` para injetar `PrismaService` e fazer `await this.prisma.db.$queryRaw\`SELECT 1\`` antes de responder `{ status: 'ok', banco: 'ok' }`; atualizar o teste `saude.e2e-spec.ts` para esperar `{ status: 'ok', banco: 'ok' }`.

- [ ] **Passo 5: banco de teste**

`test/setup-global.ts`:
```ts
import { execSync } from 'node:child_process';
import { ENV_TESTE } from './env-teste.js';

/** Recria o banco de teste do zero com as migrações, uma vez por execução. */
export default function setup(): void {
  execSync('pnpm exec prisma migrate reset --force', {
    stdio: 'inherit',
    env: { ...process.env, DATABASE_URL: ENV_TESTE.DATABASE_URL },
  });
}
```
Em `vitest.config.e2e.ts`, adicionar `globalSetup: ['./test/setup-global.ts']`. Se o Prisma 7 pedir confirmação ou rodar seed no `reset`, conferir as flags na documentação (`--force` e, se existir, `--skip-seed`).

- [ ] **Passo 6: teste da FK composta (Review Focus 1)**

Este teste usa o `PrismaService` sem extensão (nesta tarefa ele ainda não tem). Na Tarefa 5 ele passa a rodar dentro de `executarSemTenant`, para testar só o banco.

`test/tenant/fk-composta.e2e-spec.ts`:
```ts
import { Test, TestingModule } from '@nestjs/testing';
import { AppModule } from '../../src/app.module.js';
import { PrismaService } from '../../src/prisma/prisma.service.js';

describe('FK composta impede referência entre oficinas', () => {
  let modulo: TestingModule;
  let prisma: PrismaService;

  beforeAll(async () => {
    modulo = await Test.createTestingModule({ imports: [AppModule] }).compile();
    prisma = modulo.get(PrismaService);
  });

  afterAll(() => modulo.close());

  const novaOficina = (nome: string) =>
    prisma.db.oficina.create({
      data: { nome, telefone: '+5543999990000', termosVersao: '2026-09', termosAceitosEm: new Date() },
    });

  it('veículo da oficina A não pode apontar para cliente da oficina B', async () => {
    const a = await novaOficina('A');
    const b = await novaOficina('B');
    const clienteB = await prisma.db.cliente.create({
      data: { oficinaId: b.id, telefone: '+5543911112222' },
    });

    await expect(
      prisma.db.veiculo.create({
        data: { oficinaId: a.id, clienteId: clienteB.id, placa: 'ABC1234' },
      }),
    ).rejects.toMatchObject({ code: 'P2003' });
  });

  it('mesma oficina funciona', async () => {
    const a = await novaOficina('A');
    const clienteA = await prisma.db.cliente.create({
      data: { oficinaId: a.id, telefone: '+5543911113333' },
    });
    const veiculo = await prisma.db.veiculo.create({
      data: { oficinaId: a.id, clienteId: clienteA.id, placa: 'ABC1D23' },
    });
    expect(veiculo.oficinaId).toBe(a.id);
  });
});
```
Se o código de erro vier diferente de `P2003` com o driver adapter, ajustar o `toMatchObject` para o código real, conferindo que a mensagem é de violação de FK.

- [ ] **Passo 7: docs, verificação e commit**

Atualizar `docs/04-modelo-dados.md` com o schema real (FKs compostas, `Convite`, `termosVersao`/`termosAceitosEm`, `familiaId`, `oficinaId` em `ItemOrcamento`, índices) e com a regra: "relação opcional com usuário ou evento é validada no service".

```bash
pnpm --filter @oficinatrack/api test
pnpm --filter @oficinatrack/api typecheck
git add apps/api docs/04-modelo-dados.md pnpm-lock.yaml
git commit -m "feat(db): schema do mvp com fks compostas por oficina, convite e aceite de termos"
```

---

### Tarefa 5: Contexto de tenant e extensão do Prisma

Agent: `backend-nest` (implementação) e `qa-testes` (revisar os casos de isolamento). É a tarefa mais importante da sprint.

**Arquivos:**
- Criar: `src/common/tenant/tenant-context.ts`, `src/common/tenant/tenant.module.ts`, `src/prisma/modelos-tenant.ts`, `src/prisma/extensao-tenant.ts`, `src/prisma/extensao-tenant.spec.ts`, `test/fabricas.ts`, `test/tenant/isolamento.e2e-spec.ts`
- Modificar: `src/prisma/prisma.service.ts`, `src/prisma/prisma.module.ts`, `src/app.module.ts`, `src/common/erros/filtro-erros.ts` (+ spec), `test/tenant/fk-composta.e2e-spec.ts`

**Interfaces:**
- Consome: `PrismaService` (Tarefa 4), `FiltroErros` (Tarefa 3).
- Produz:
  - `TenantContext`: `oficinaId(): string | undefined`, `oficinaIdAtual(): string` (lança `TenantAusenteError`), `ignorandoTenant(): boolean`, `definirOficina(oficinaId: string): void`, `executarComo<T>(oficinaId: string, fn: () => Promise<T>): Promise<T>`, `executarSemTenant<T>(fn: () => Promise<T>): Promise<T>`
  - `TenantAusenteError`, `TenantViolacaoError`
  - `PrismaService.db`: cliente **com** a extensão (o cliente puro deixa de ser acessível)
  - `MODELOS_COM_TENANT: ReadonlySet<string>`
  - `aplicarTenant(campo, operacao, args, oficinaId)` (exportado para teste unitário)
  - `FiltroErros` converte Prisma `P2025` em 404 `RECURSO_NAO_ENCONTRADO`

Uso previsto nas próximas sprints: o guard de JWT (Sprint 2) chama `tenant.definirOficina(payload.oficinaId)`; login, refresh, aceite de convite e portal por token usam `executarSemTenant` para achar o registro pelo hash e depois `executarComo(registro.oficinaId, ...)`. Todo uso de `executarSemTenant` precisa de um comentário dizendo por quê.

- [ ] **Passo 1: `nestjs-cls` e `TenantContext`**

```bash
pnpm --filter @oficinatrack/api add nestjs-cls@^7.0.1
```

`src/common/tenant/tenant-context.ts`:
```ts
import { Injectable } from '@nestjs/common';
import { ClsService } from 'nestjs-cls';

const CHAVE_OFICINA = 'oficinaId';
const CHAVE_SEM_TENANT = 'semTenant';

export class TenantAusenteError extends Error {
  constructor(modelo: string, operacao: string) {
    super(`Consulta em ${modelo}.${operacao} sem oficina no contexto`);
    this.name = 'TenantAusenteError';
  }
}

export class TenantViolacaoError extends Error {
  constructor(modelo: string, operacao: string) {
    super(`${modelo}.${operacao} tentou gravar dados de outra oficina`);
    this.name = 'TenantViolacaoError';
  }
}

@Injectable()
export class TenantContext {
  constructor(private readonly cls: ClsService) {}

  oficinaId(): string | undefined {
    return this.cls.isActive() ? this.cls.get<string | undefined>(CHAVE_OFICINA) : undefined;
  }

  oficinaIdAtual(): string {
    const oficinaId = this.oficinaId();
    if (!oficinaId) throw new TenantAusenteError('contexto', 'oficinaIdAtual');
    return oficinaId;
  }

  ignorandoTenant(): boolean {
    return this.cls.isActive() && this.cls.get<boolean | undefined>(CHAVE_SEM_TENANT) === true;
  }

  /** Chamado pelo guard de autenticação com o `oficinaId` do JWT. */
  definirOficina(oficinaId: string): void {
    this.cls.set(CHAVE_OFICINA, oficinaId);
  }

  executarComo<T>(oficinaId: string, fn: () => Promise<T>): Promise<T> {
    return this.cls.run(() => {
      this.cls.set(CHAVE_SEM_TENANT, false);
      this.cls.set(CHAVE_OFICINA, oficinaId);
      return fn();
    });
  }

  /**
   * Desliga o filtro de oficina. Uso restrito: login, refresh, aceite de convite,
   * portal por token (achar o registro pelo hash), seeds e testes.
   * Todo uso precisa de comentário justificando.
   */
  executarSemTenant<T>(fn: () => Promise<T>): Promise<T> {
    return this.cls.run(() => {
      this.cls.set(CHAVE_OFICINA, undefined);
      this.cls.set(CHAVE_SEM_TENANT, true);
      return fn();
    });
  }
}
```

`src/common/tenant/tenant.module.ts`:
```ts
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
```
Importar `TenantModule` no `AppModule`, antes do `PrismaModule`.

- [ ] **Passo 2: lista de models com tenant**

`src/prisma/modelos-tenant.ts`:
```ts
/**
 * Models filtrados automaticamente por `oficinaId`.
 * Todo model novo com `oficinaId` precisa entrar aqui; o teste
 * "lista de models com tenant bate com o schema" falha se esquecer.
 * `Oficina` é tratada à parte (filtrada por `id`).
 */
export const MODELOS_COM_TENANT: ReadonlySet<string> = new Set([
  'Usuario',
  'Convite',
  'Cliente',
  'Veiculo',
  'OrdemServico',
  'ChecklistEntrada',
  'EventoOS',
  'Foto',
  'Orcamento',
  'ItemOrcamento',
  'AcessoCliente',
]);
```

- [ ] **Passo 3: testes unitários da extensão (falhando)**

`src/prisma/extensao-tenant.spec.ts`:
```ts
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
```

Rodar `pnpm --filter @oficinatrack/api exec vitest run src/prisma` → FALHA.

- [ ] **Passo 4: implementar a extensão**

`src/prisma/extensao-tenant.ts`:
```ts
import { Prisma } from '../generated/prisma/client.js';
import { TenantAusenteError, TenantContext, TenantViolacaoError } from '../common/tenant/tenant-context.js';
import { MODELOS_COM_TENANT } from './modelos-tenant.js';

type Args = Record<string, unknown>;
type CampoTenant = 'oficinaId' | 'id';

const LEITURA_OU_FILTRO = new Set([
  'findUnique',
  'findUniqueOrThrow',
  'findFirst',
  'findFirstOrThrow',
  'findMany',
  'count',
  'aggregate',
  'groupBy',
  'delete',
  'deleteMany',
]);
const ATUALIZACAO = new Set(['update', 'updateMany', 'updateManyAndReturn']);
const CRIACAO = new Set(['create', 'createMany', 'createManyAndReturn']);

function campoTenant(modelo: string): CampoTenant | null {
  if (modelo === 'Oficina') return 'id';
  return MODELOS_COM_TENANT.has(modelo) ? 'oficinaId' : null;
}

function comFiltro(where: unknown, campo: CampoTenant, oficinaId: string): Args {
  const original = (where ?? {}) as Args;
  const and = original.AND === undefined ? [] : Array.isArray(original.AND) ? original.AND : [original.AND];
  return { ...original, AND: [...and, { [campo]: oficinaId }] };
}

function comOficina(data: unknown, campo: CampoTenant, oficinaId: string): Args {
  return { ...(data as Args), [campo]: oficinaId };
}

function semTrocaDeOficina(data: unknown, campo: CampoTenant, oficinaId: string, modelo: string, operacao: string): void {
  const valor = (data as Args | undefined)?.[campo];
  if (valor !== undefined && valor !== oficinaId) throw new TenantViolacaoError(modelo, operacao);
}

export function aplicarTenant(modelo: string, campo: CampoTenant, operacao: string, args: Args, oficinaId: string): Args {
  if (LEITURA_OU_FILTRO.has(operacao)) {
    return { ...args, where: comFiltro(args.where, campo, oficinaId) };
  }
  if (ATUALIZACAO.has(operacao)) {
    semTrocaDeOficina(args.data, campo, oficinaId, modelo, operacao);
    return { ...args, where: comFiltro(args.where, campo, oficinaId) };
  }
  if (CRIACAO.has(operacao)) {
    const data = Array.isArray(args.data)
      ? args.data.map((d) => comOficina(d, campo, oficinaId))
      : comOficina(args.data, campo, oficinaId);
    return { ...args, data };
  }
  if (operacao === 'upsert') {
    semTrocaDeOficina(args.update, campo, oficinaId, modelo, operacao);
    return {
      ...args,
      where: comFiltro(args.where, campo, oficinaId),
      create: comOficina(args.create, campo, oficinaId),
    };
  }
  throw new Error(`Operação ${modelo}.${operacao} não suportada pela extensão de tenant`);
}

export function extensaoTenant(tenant: TenantContext) {
  return Prisma.defineExtension({
    name: 'tenant',
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }) {
          const campo = campoTenant(model);
          if (!campo || tenant.ignorandoTenant()) return query(args);
          const oficinaId = tenant.oficinaId();
          if (!oficinaId) throw new TenantAusenteError(model, operation);
          return query(aplicarTenant(model, campo, operation, (args ?? {}) as Args, oficinaId) as typeof args);
        },
      },
    },
  });
}
```

Rodar os unitários → PASSA.

- [ ] **Passo 5: `PrismaService` com a extensão**

`src/prisma/prisma.service.ts`:
```ts
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
```

No `FiltroErros.converter`, antes do ramo de `HttpException`:
```ts
if (erro instanceof Prisma.PrismaClientKnownRequestError && erro.code === 'P2025') {
  return { statusCode: 404, code: 'RECURSO_NAO_ENCONTRADO', message: 'Recurso não encontrado' };
}
```
(import `Prisma` de `../../generated/prisma/client.js`), com o teste correspondente em `filtro-erros.spec.ts`:
```ts
it('converte registro não encontrado do Prisma em 404', () => {
  const erro = new Prisma.PrismaClientKnownRequestError('No record found', { code: 'P2025', clientVersion: '7.10.0' });
  expect(filtro.converter(erro).statusCode).toBe(404);
});

it('esconde erro desconhecido do Prisma (Review Focus 5)', () => {
  const erro = new Prisma.PrismaClientKnownRequestError('Unique constraint failed on oficinaId', { code: 'P2002', clientVersion: '7.10.0' });
  expect(filtro.converter(erro)).toEqual({ statusCode: 500, code: 'ERRO_INTERNO', message: 'Erro interno' });
});
```

- [ ] **Passo 6: fábricas e testes de isolamento (e2e com banco)**

`test/fabricas.ts`:
```ts
import type { TenantContext } from '../src/common/tenant/tenant-context.js';
import type { PrismaService } from '../src/prisma/prisma.service.js';

const telefoneUnico = () => `+55439${String(Math.floor(Math.random() * 1e8)).padStart(8, '0')}`;

export function criarOficina(prisma: PrismaService, tenant: TenantContext, nome = 'Oficina Teste') {
  // sem tenant: a oficina ainda não existe (mesmo caso do cadastro na Sprint 2)
  return tenant.executarSemTenant(() =>
    prisma.db.oficina.create({
      data: { nome, telefone: '+5543999990000', termosVersao: '2026-09', termosAceitosEm: new Date() },
    }),
  );
}

export function criarCliente(prisma: PrismaService, tenant: TenantContext, oficinaId: string, nome = 'Cliente Teste') {
  return tenant.executarComo(oficinaId, () =>
    prisma.db.cliente.create({ data: { oficinaId, nome, telefone: telefoneUnico() } }),
  );
}
```

`test/tenant/isolamento.e2e-spec.ts`:
```ts
import { Test, TestingModule } from '@nestjs/testing';
import { AppModule } from '../../src/app.module.js';
import { TenantAusenteError, TenantContext, TenantViolacaoError } from '../../src/common/tenant/tenant-context.js';
import { PrismaService } from '../../src/prisma/prisma.service.js';
import { criarCliente, criarOficina } from '../fabricas.js';

describe('Isolamento entre oficinas (extensão do Prisma)', () => {
  let modulo: TestingModule;
  let prisma: PrismaService;
  let tenant: TenantContext;
  let oficinaA: string;
  let oficinaB: string;
  let clienteA: { id: string };

  const comoA = <T>(fn: () => Promise<T>) => tenant.executarComo(oficinaA, fn);
  const comoB = <T>(fn: () => Promise<T>) => tenant.executarComo(oficinaB, fn);

  beforeAll(async () => {
    modulo = await Test.createTestingModule({ imports: [AppModule] }).compile();
    prisma = modulo.get(PrismaService);
    tenant = modulo.get(TenantContext);
  });

  afterAll(() => modulo.close());

  beforeEach(async () => {
    oficinaA = (await criarOficina(prisma, tenant, 'A')).id;
    oficinaB = (await criarOficina(prisma, tenant, 'B')).id;
    clienteA = await criarCliente(prisma, tenant, oficinaA, 'Cliente da A');
  });

  it('sem contexto, qualquer consulta em model da oficina falha', async () => {
    await expect(prisma.db.cliente.findMany()).rejects.toThrow(TenantAusenteError);
    await expect(prisma.db.cliente.count()).rejects.toThrow(TenantAusenteError);
    await expect(prisma.db.oficina.findMany()).rejects.toThrow(TenantAusenteError);
  });

  it('findMany e count de B não veem nada de A', async () => {
    expect(await comoB(() => prisma.db.cliente.findMany())).toEqual([]);
    expect(await comoB(() => prisma.db.cliente.count())).toBe(0);
    expect(await comoA(() => prisma.db.cliente.count())).toBe(1);
  });

  it('findUnique e findFirst de B pelo id de A retornam null', async () => {
    expect(await comoB(() => prisma.db.cliente.findUnique({ where: { id: clienteA.id } }))).toBeNull();
    expect(await comoB(() => prisma.db.cliente.findFirst({ where: { id: clienteA.id } }))).toBeNull();
  });

  it('update e delete de B pelo id de A dão "não encontrado" e não mexem em A', async () => {
    await expect(comoB(() => prisma.db.cliente.update({ where: { id: clienteA.id }, data: { nome: 'hack' } })))
      .rejects.toMatchObject({ code: 'P2025' });
    await expect(comoB(() => prisma.db.cliente.delete({ where: { id: clienteA.id } })))
      .rejects.toMatchObject({ code: 'P2025' });
    const intacto = await comoA(() => prisma.db.cliente.findUnique({ where: { id: clienteA.id } }));
    expect(intacto?.nome).toBe('Cliente da A');
  });

  it('updateMany e deleteMany de B não afetam A', async () => {
    expect((await comoB(() => prisma.db.cliente.updateMany({ data: { nome: 'hack' } }))).count).toBe(0);
    expect((await comoB(() => prisma.db.cliente.deleteMany())).count).toBe(0);
    expect(await comoA(() => prisma.db.cliente.count())).toBe(1);
  });

  it('create em B com oficinaId de A grava em B', async () => {
    const criado = await comoB(() => prisma.db.cliente.create({ data: { oficinaId: oficinaA, telefone: '+5543977776666' } }));
    expect(criado.oficinaId).toBe(oficinaB);
  });

  it('update não pode mover registro para outra oficina', async () => {
    await expect(comoA(() => prisma.db.cliente.update({ where: { id: clienteA.id }, data: { oficinaId: oficinaB } })))
      .rejects.toThrow(TenantViolacaoError);
  });

  it('upsert de B com o id de A cria um registro novo em B e não altera A', async () => {
    const criado = await comoB(() =>
      prisma.db.cliente.upsert({
        where: { id: clienteA.id },
        create: { oficinaId: oficinaB, telefone: '+5543966665555', nome: 'Novo em B' },
        update: { nome: 'hack' },
      }),
    );
    expect(criado.oficinaId).toBe(oficinaB);
    expect(criado.id).not.toBe(clienteA.id);
    const intacto = await comoA(() => prisma.db.cliente.findUnique({ where: { id: clienteA.id } }));
    expect(intacto?.nome).toBe('Cliente da A');
  });

  it('a oficina só enxerga a si mesma', async () => {
    expect(await comoA(() => prisma.db.oficina.findUnique({ where: { id: oficinaB } }))).toBeNull();
    const visiveis = await comoA(() => prisma.db.oficina.findMany());
    expect(visiveis.map((o) => o.id)).toEqual([oficinaA]);
  });

  it('include de relação traz só dados da mesma oficina', async () => {
    await comoA(() => prisma.db.veiculo.create({ data: { oficinaId: oficinaA, clienteId: clienteA.id, placa: 'ABC1234' } }));
    const [cliente] = await comoA(() => prisma.db.cliente.findMany({ include: { veiculos: true } }));
    expect(cliente?.veiculos.every((v) => v.oficinaId === oficinaA)).toBe(true);
  });

  it('executarSemTenant enxerga as duas oficinas (uso restrito)', async () => {
    const total = await tenant.executarSemTenant(() =>
      prisma.db.oficina.count({ where: { id: { in: [oficinaA, oficinaB] } } }),
    );
    expect(total).toBe(2);
  });
});
```

Ajustar `test/tenant/fk-composta.e2e-spec.ts`: envolver as chamadas em `tenant.executarSemTenant(...)` (o teste é da camada do banco, não da extensão), obtendo o `TenantContext` do módulo.

- [ ] **Passo 7: verificar e commitar**

```bash
pnpm --filter @oficinatrack/api test
pnpm --filter @oficinatrack/api typecheck
pnpm lint
git add apps/api pnpm-lock.yaml
git commit -m "feat(api): contexto de tenant e extensao do prisma com testes de isolamento"
```

---

### Tarefa 6: Front web (Vite, Tailwind, shadcn, TanStack Query)

Agent: `frontend-react`.

**Arquivos:**
- Criar: `apps/web/` via `create-vite`; `src/app/providers.tsx`, `src/app/router.tsx`, `src/lib/api.ts`, `src/lib/api.spec.ts`, `src/features/saude/api/use-saude.ts`, `src/features/saude/components/status-api.tsx`, `src/features/saude/components/status-api.spec.tsx`, `src/pages/inicio.tsx`, `src/test/setup.ts`
- Modificar: `package.json`, `vite.config.ts`, `tsconfig.app.json`, `src/main.tsx`, `src/index.css`, `index.html`
- Remover: `src/App.tsx`, `src/App.css`, `src/assets/`, `eslint.config.js` (lint é o oxlint da raiz)

**Interfaces:**
- Consome: `GET /api/v1/saude` → `{ status: 'ok', banco: 'ok' }`.
- Produz:
  - `api<T>(caminho: string, init?: RequestInit): Promise<T>` — prefixa `/api/v1`, envia cookies, lança `ErroApi`
  - `class ErroApi extends Error { statusCode: number; code: string; details?: unknown }`
  - `useSaude()`; `<StatusApi />`; rotas em `src/app/router.tsx`; alias `@/` para `src/`

- [ ] **Passo 1: gerar e instalar**

```bash
cd apps
pnpm create vite@latest web --template react-ts
cd ..
pnpm --filter web add @tanstack/react-query react-router @oficinatrack/shared@workspace:* zod@^4.6.5
pnpm --filter web add -D tailwindcss @tailwindcss/vite vitest@^5.0.1 jsdom @testing-library/react @testing-library/jest-dom @testing-library/user-event @types/node
```
Em `apps/web/package.json`: `"name": "@oficinatrack/web"`, scripts `"dev": "vite"`, `"build": "tsc -b && vite build"`, `"typecheck": "tsc -b --noEmit"`, `"test": "vitest run"`; remover `lint` e as dependências de ESLint. `index.html`: `lang="pt-BR"`, `<title>OficinaTrack</title>`.

`vite.config.ts`:
```ts
import { fileURLToPath, URL } from 'node:url';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  server: { proxy: { '/api': 'http://localhost:3000' } },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.spec.{ts,tsx}'],
  },
});
```

`src/test/setup.ts`:
```ts
import '@testing-library/jest-dom/vitest';
```

Em `tsconfig.app.json`, adicionar `"baseUrl": "."`, `"paths": { "@/*": ["./src/*"] }` e `"types": ["vitest/globals"]`. `src/index.css`: `@import "tailwindcss";`.

Rodar `pnpm dlx shadcn@latest init` dentro de `apps/web` (estilo padrão, cor base neutra) e `pnpm dlx shadcn@latest add button`. Isso cria `components.json`, `src/lib/utils.ts` e `src/components/ui/button.tsx`.

- [ ] **Passo 2: cliente da API (teste falhando → implementação)**

`src/lib/api.spec.ts`:
```ts
import { api, ErroApi } from './api';

describe('api', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('prefixa /api/v1 e devolve o JSON', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ status: 'ok' }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    await expect(api('/saude')).resolves.toEqual({ status: 'ok' });
    expect(fetchMock).toHaveBeenCalledWith('/api/v1/saude', expect.objectContaining({ credentials: 'include' }));
  });

  it('transforma o erro padrão da API em ErroApi', async () => {
    const corpo = { statusCode: 404, code: 'RECURSO_NAO_ENCONTRADO', message: 'Recurso não encontrado' };
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify(corpo), { status: 404 })));
    await expect(api('/x')).rejects.toMatchObject({ statusCode: 404, code: 'RECURSO_NAO_ENCONTRADO' });
  });

  it('erro sem corpo JSON vira mensagem genérica', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('Bad Gateway', { status: 502 })));
    const erro = await api('/x').catch((e: unknown) => e);
    expect(erro).toBeInstanceOf(ErroApi);
    expect((erro as ErroApi).message).toBe('Não foi possível completar a ação. Tente de novo.');
  });
});
```

`src/lib/api.ts`:
```ts
export class ErroApi extends Error {
  constructor(
    readonly statusCode: number,
    readonly code: string,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = 'ErroApi';
  }
}

type CorpoErro = { code?: string; message?: string; details?: unknown };

export async function api<T>(caminho: string, init?: RequestInit): Promise<T> {
  const resposta = await fetch(`/api/v1${caminho}`, {
    ...init,
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...init?.headers },
  });
  const corpo: unknown = resposta.status === 204 ? undefined : await resposta.json().catch(() => undefined);
  if (!resposta.ok) {
    const erro = (corpo ?? {}) as CorpoErro;
    throw new ErroApi(
      resposta.status,
      erro.code ?? 'ERRO_DESCONHECIDO',
      erro.message ?? 'Não foi possível completar a ação. Tente de novo.',
      erro.details,
    );
  }
  return corpo as T;
}
```

- [ ] **Passo 3: tela inicial com estados (teste falhando → implementação)**

`src/features/saude/api/use-saude.ts`:
```ts
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';

export type Saude = { status: 'ok'; banco: 'ok' };

export function useSaude() {
  return useQuery({ queryKey: ['saude'], queryFn: () => api<Saude>('/saude'), retry: false });
}
```

`src/features/saude/components/status-api.spec.tsx`:
```tsx
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { StatusApi } from './status-api';

function renderizar() {
  const cliente = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={cliente}>
      <StatusApi />
    </QueryClientProvider>,
  );
}

const respostaOk = () => new Response(JSON.stringify({ status: 'ok', banco: 'ok' }), { status: 200 });

describe('StatusApi', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('mostra carregando e depois o sistema no ar', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(respostaOk()));
    renderizar();
    expect(screen.getByRole('status')).toHaveTextContent('Verificando');
    expect(await screen.findByText('Sistema no ar')).toBeInTheDocument();
  });

  it('mostra erro e tenta de novo', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response('', { status: 503 }))
      .mockResolvedValueOnce(respostaOk());
    vi.stubGlobal('fetch', fetchMock);
    renderizar();
    expect(await screen.findByText('Não foi possível falar com o servidor.')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Tentar de novo' }));
    expect(await screen.findByText('Sistema no ar')).toBeInTheDocument();
  });
});
```

`src/features/saude/components/status-api.tsx`:
```tsx
import { Button } from '@/components/ui/button';
import { useSaude } from '../api/use-saude';

export function StatusApi() {
  const { isPending, isError, refetch, isFetching } = useSaude();

  if (isPending) {
    return (
      <p role="status" className="h-11 animate-pulse rounded-md bg-muted px-4 leading-[2.75rem] text-muted-foreground">
        Verificando o servidor…
      </p>
    );
  }

  if (isError) {
    return (
      <div role="alert" className="flex flex-col gap-3 rounded-md border border-destructive/40 p-4">
        <p>Não foi possível falar com o servidor.</p>
        <Button className="h-11 self-start" onClick={() => refetch()} disabled={isFetching}>
          Tentar de novo
        </Button>
      </div>
    );
  }

  return <p className="rounded-md bg-muted px-4 py-3 font-medium">Sistema no ar</p>;
}
```

`src/pages/inicio.tsx`:
```tsx
import { StatusApi } from '@/features/saude/components/status-api';

export function Inicio() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col gap-6 px-4 py-8">
      <h1 className="text-2xl font-semibold">OficinaTrack</h1>
      <StatusApi />
    </main>
  );
}
```

`src/app/providers.tsx`:
```tsx
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState, type ReactNode } from 'react';

export function Providers({ children }: { children: ReactNode }) {
  const [cliente] = useState(
    () => new QueryClient({ defaultOptions: { queries: { refetchOnWindowFocus: true, staleTime: 10_000 } } }),
  );
  return <QueryClientProvider client={cliente}>{children}</QueryClientProvider>;
}
```

`src/app/router.tsx`:
```tsx
import { createBrowserRouter } from 'react-router';
import { Inicio } from '@/pages/inicio';

export const router = createBrowserRouter([{ path: '/', element: <Inicio /> }]);
```

`src/main.tsx`:
```tsx
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router';
import { Providers } from './app/providers';
import { router } from './app/router';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Providers>
      <RouterProvider router={router} />
    </Providers>
  </StrictMode>,
);
```

- [ ] **Passo 4: verificar e commitar**

```bash
pnpm --filter @oficinatrack/web test
pnpm --filter @oficinatrack/web typecheck
pnpm --filter @oficinatrack/web build
pnpm lint
```
Manual: com `docker compose up -d` e `pnpm dev`, abrir `http://localhost:5173` com o DevTools em 360px e ver "Sistema no ar"; parar a API e recarregar para ver o erro e o botão "Tentar de novo".

```bash
git add apps/web pnpm-lock.yaml
git commit -m "feat(web): app react com tailwind, shadcn, tanstack query e cliente da api"
```

---

### Tarefa 7: CI, regras proibidas e documentação

**Arquivos:**
- Criar: `.github/workflows/ci.yml`, `apps/api/test/regras-proibidas.spec.ts`
- Modificar: `CLAUDE.md` (seção Comandos), `docs/03-arquitetura.md` (stack e decisões desta sprint), `README.md`

- [ ] **Passo 1: teste de padrões proibidos**

`apps/api/test/regras-proibidas.spec.ts`:
```ts
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

// fileURLToPath decodifica o "á" da pasta e trata o drive do Windows
const RAIZ = fileURLToPath(new URL('../../', import.meta.url));
const PASTAS = ['api/src', 'web/src'].map((p) => join(RAIZ, p));
const PROIBIDOS: Array<[RegExp, string]> = [
  [/\$queryRawUnsafe|\$executeRawUnsafe/, 'SQL cru sem parâmetros (T6)'],
  [/dangerouslySetInnerHTML/, 'HTML sem escape (T6)'],
  [/console\.log\(/, 'use o Logger do Nest / sem logs no front'],
];

function arquivos(pasta: string): string[] {
  return readdirSync(pasta).flatMap((nome) => {
    const caminho = join(pasta, nome);
    if (nome === 'generated' || nome === 'node_modules') return [];
    return statSync(caminho).isDirectory() ? arquivos(caminho) : /\.(ts|tsx)$/.test(nome) ? [caminho] : [];
  });
}

describe('padrões proibidos no código', () => {
  const todos = PASTAS.flatMap(arquivos);

  it('encontra arquivos para verificar', () => {
    expect(todos.length).toBeGreaterThan(5);
  });

  it.each(PROIBIDOS)('não usa %s', (padrao, motivo) => {
    const violacoes = todos.filter((f) => padrao.test(readFileSync(f, 'utf8')));
    expect(violacoes, motivo).toEqual([]);
  });
});
```

- [ ] **Passo 2: CI**

`.github/workflows/ci.yml`:
```yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:

jobs:
  verificar:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:17-alpine
        env:
          POSTGRES_USER: oficinatrack
          POSTGRES_PASSWORD: oficinatrack
          POSTGRES_DB: oficinatrack_test
        ports: ["5432:5432"]
        options: >-
          --health-cmd "pg_isready -U oficinatrack"
          --health-interval 5s --health-timeout 5s --health-retries 10
    env:
      DATABASE_URL: postgresql://oficinatrack:oficinatrack@localhost:5432/oficinatrack_test
      DATABASE_URL_TEST: postgresql://oficinatrack:oficinatrack@localhost:5432/oficinatrack_test
      CORS_ORIGEM: http://localhost:5173
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with:
          node-version-file: .nvmrc
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      - run: pnpm lint
      - run: pnpm typecheck
      - run: pnpm test
      - run: pnpm audit --prod --audit-level high
```

- [ ] **Passo 3: documentação**

`CLAUDE.md`, seção Comandos:
```bash
pnpm install
cp apps/api/.env.example apps/api/.env
docker compose up -d --wait        # postgres (bancos oficinatrack e oficinatrack_test)
pnpm --filter @oficinatrack/api prisma:migrate
pnpm dev                           # shared (watch) + api + web
pnpm test                          # todos os testes (precisa do postgres rodando)
pnpm lint
pnpm typecheck
```
`docs/03-arquitetura.md`: registrar NestJS 12 ESM, Vitest em todo o monorepo, oxlint, Prisma 7 com gerador `prisma-client` e adapter `pg`, FKs compostas como segunda camada de isolamento, `executarSemTenant` e quando pode ser usado, MinIO adiado para a Sprint 6. `README.md`: o que é o projeto e os comandos acima.

- [ ] **Passo 4: verificação completa e commit**

```bash
pnpm lint && pnpm typecheck && pnpm test
git add .github apps/api/test/regras-proibidas.spec.ts CLAUDE.md docs/03-arquitetura.md README.md
git commit -m "ci: pipeline com lint, typecheck, testes e audit; docs da fundacao"
graphify update .
```

---

### Tarefa 8: Revisão, segurança e fechamento

- [ ] **Passo 1:** rodar o agent `revisor` sobre `git diff main...sprint-1`. Corrigir todo item "Crítico" e avaliar os "Importantes".
- [ ] **Passo 2:** rodar o agent `seguranca` com escopo "Sprint 1 completa" (foco T1, T6, T7, T8, T9). O relatório vai para `docs/auditorias/2026-MM-DD-sprint-1.md`. Corrigir achados Críticos e Altos e rodar a auditoria de novo.
- [ ] **Passo 3:** `pnpm lint && pnpm typecheck && pnpm test` com saída limpa (skill `superpowers:verification-before-completion`).
- [ ] **Passo 4:** integrar com a skill `superpowers:finishing-a-development-branch` (merge na `main`) e criar a tag:

```bash
git tag sprint-1
```

---

## Autorrevisão

- **Cobertura do roadmap (Sprint 1):** monorepo (T1), Docker Compose com Postgres (T1; MinIO adiado e justificado), NestJS + Prisma (T3, T4), React + Vite + Tailwind (T6), CI com lint e testes (T7), tenant context + extensão + teste de isolamento (T5). Correções aprovadas do schema: T4.
- **Regras do `CLAUDE.md`:** tenant pelo contexto (T5), 404 para outra oficina (P2025 → 404 em T5), centavos (T2), placa/telefone normalizados (T2), erros no formato padrão (T3), Zod compartilhado (T2, T3), 360px (T6).
- **Review Focus:** 1 → T4 passo 6; 2 e 3 → T5 passo 3; 4 → T2 passo 4; 5 → T3 passo 3 e T5 passo 5.
- **Consistência de nomes:** `TenantContext.executarComo`/`executarSemTenant`/`oficinaIdAtual`, `PrismaService.db`, `aplicarTenant(modelo, campo, operacao, args, oficinaId)`, `ErroNegocio(statusCode, code, message, details?)`, `ENV_TESTE` usados de forma igual em todas as tarefas.
