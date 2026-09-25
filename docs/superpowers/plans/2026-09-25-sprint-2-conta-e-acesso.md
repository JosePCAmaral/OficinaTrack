# Sprint 2 — Conta e acesso: plano de implementação

> **Para agentes:** SUB-SKILL OBRIGATÓRIA: use superpowers:subagent-driven-development (recomendado) ou superpowers:executing-plans para executar este plano tarefa por tarefa. Os passos usam checkbox (`- [ ]`).

**Objetivo:** oficina piloto cria a conta com código, confirma o e-mail, convida a equipe; todos entram pelo celular (e-mail ou telefone + senha), continuam logados e recuperam a própria senha por e-mail.

**Arquitetura:** quatro módulos NestJS (`auth`, `oficinas`, `usuarios`, `notificacoes`) conversando só por service público e evento. Autenticação própria: JWT de acesso (15 min, em memória no front) + refresh token opaco rotativo em cookie `httpOnly` (hash no banco, família com detecção de reuso). Guard global nega por padrão, define a oficina no `TenantContext` e confere o usuário ativo a cada requisição; um segundo guard confere permissões por perfil vindas de `packages/shared`. E-mail por SMTP (Mailpit no dev, adaptador em memória nos testes).

**Stack nova:** `@nestjs/jwt` 12, `@node-rs/argon2` 2, `cookie-parser` 1.4, `nodemailer` 10, `@nestjs/event-emitter` 12, `tsx` (script do código de piloto); no web `react-hook-form` 7 + `@hookform/resolvers` 5, `@fontsource/barlow` e `@fontsource/barlow-condensed`.

**Spec:** `docs/superpowers/specs/2026-09-25-sprint-2-conta-e-acesso-design.md` (decisões D1–D8). Regras do projeto: `CLAUDE.md`, `docs/03-arquitetura.md`, `docs/04-modelo-dados.md`, `docs/06-seguranca.md` (T3, T4, T7, T8).

## Restrições globais

- `oficinaId` vem sempre do `TenantContext`; recurso de outra oficina → **404**; sem permissão → **403 `SEM_PERMISSAO`**; sem login → **401 `NAO_AUTENTICADO`**.
- Todo `executarSemTenant(` no código de produção tem comentário de justificativa nas 3 linhas acima (há teste que cobra isso).
- Services gravam FKs escalares; nunca `connect`/escrita aninhada fora do permitido pela extensão.
- Tokens (refresh, confirmação, redefinição, convite, código de piloto) guardados só como hash SHA-256; tokens de link com 32 bytes aleatórios em base64url.
- Senhas: argon2id; política pelo `senhaSchema` de `packages/shared` (8–128, recusa senhas comuns).
- E-mail sempre normalizado (`normalizarEmail`: trim + minúsculas); telefone por `normalizarTelefone`.
- Logs nunca contêm e-mail, telefone, senha, tokens, cookies ou cabeçalho `Authorization`.
- Erros no formato `{ statusCode, code, message, details? }`; códigos novos: `CREDENCIAIS_INVALIDAS` 401, `NAO_AUTENTICADO` 401, `SESSAO_INVALIDA` 401, `EMAIL_NAO_CONFIRMADO` 403, `SEM_PERMISSAO` 403, `CODIGO_PILOTO_INVALIDO` 400, `TOKEN_INVALIDO` 400, `SENHA_ATUAL_INCORRETA` 400, `EMAIL_JA_CADASTRADO` 409, `TELEFONE_JA_CADASTRADO` 409, `ULTIMO_DONO` 422, `ACAO_NAO_PERMITIDA_EM_SI_MESMO` 422, `MUITAS_TENTATIVAS` 429.
- Rotas em `/api/v1`; textos da interface em português do Brasil; telas em 360px com toques ≥ 44px.
- Os testes e2e rodam no banco de teste que **não é zerado**: cada teste cria os próprios registros e só afirma sobre eles. Nunca rodar `prisma migrate reset` nem definir `PRISMA_USER_CONSENT_FOR_DANGEROUS_AI_ACTION`.
- Portas livres desta máquina: API 3333, web 5173, Postgres 5432, Mailpit 1025/8025. Não usar 3000, 4200, 3306, 3307, 6379.
- Commits em Conventional Commits terminando com `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

1. **Duas abas (ou app e navegador) renovando a sessão ao mesmo tempo:** o usuário não deve ser deslogado nem ter a família revogada. → Tarefa 4 (tolerância de 10 s na rotação; teste de refresh concorrente) e Tarefa 9 (front tenta a renovação de novo uma vez).
2. **E-mail digitado com maiúsculas/espaços** no cadastro, no login, no convite e no "esqueci a senha": é a mesma conta. → Tarefa 1 (`emailSchema`) e Tarefa 5 (login com `  Dono@Oficina.COM `).
3. **Link de e-mail aberto por pré-visualização/antivírus do provedor de e-mail:** não pode consumir o token nem criar sessão sozinho. → Tarefa 9 (telas de confirmar/redefinir/convite só enviam o token depois do clique; teste garante que nada é chamado ao abrir).
4. **Funcionário desativado com o app aberto:** a próxima chamada responde 401 e o front volta para Entrar; o refresh também falha. → Tarefa 4 (guard confere `ativo`) e Tarefa 7 (teste e2e desativar → 401 imediato e refresh 401).
5. **Dono tentando se rebaixar/desativar, ou a oficina ficando sem DONO ativo:** 422 e nada muda. Pela HTTP a regra "não altera a si mesmo" já garante um DONO; `ULTIMO_DONO` protege perfis futuros e é testado direto no service. → Tarefa 7.

## Estrutura de arquivos

```
packages/shared/src/
  email.ts (+spec) · senhas-comuns.ts · permissoes.ts (+spec)
  schemas/auth.ts (+spec) · schemas/oficina.ts (+spec) · schemas/equipe.ts (+spec) · tipos-auth.ts
apps/api/
  prisma/schema.prisma · prisma/migrations/<ts>_contas_e_acesso/
  src/config/env.ts (+spec)
  src/prisma/modelos-tenant.ts · src/prisma/relacoes-tenant.ts · src/prisma/prisma.service.ts (tipo Tx)
  src/common/seguranca/tokens.ts (+spec) · senhas.ts (+spec) · limites.ts
  src/modules/notificacoes/ notificacoes.module.ts · envio-email.ts · envio-email-smtp.ts · envio-email-memoria.ts · envio-sms.ts · modelos-email.ts (+spec)
  src/modules/oficinas/ oficinas.module.ts · oficinas.service.ts · oficinas.controller.ts
  src/modules/usuarios/ usuarios.module.ts · usuarios.service.ts · usuarios.controller.ts · convites.service.ts · convites.controller.ts · eventos.ts
  src/modules/auth/ auth.module.ts · auth.controller.ts · convites-publico.controller.ts · auth.service.ts · cadastro.service.ts
                    sessoes.service.ts · tokens-usuario.service.ts · codigos-piloto.service.ts · limite-tentativas.service.ts
                    cookie-refresh.ts · decorators.ts · autenticacao.guard.ts · permissao.guard.ts
  src/scripts/codigo-piloto.ts
  test/auth/apoio-auth.ts · test/auth/*.e2e-spec.ts · test/auth/limites.e2e-spec.ts
apps/web/src/
  index.css (identidade visual) · lib/sessao.ts · lib/api.ts (+spec)
  features/auth/ api/*.ts · contexto/auth-provider.tsx · contexto/use-auth.ts · components/rota-protegida.tsx · hooks/use-permissao.ts · pages/*.tsx (+specs)
  features/painel/ layout-painel.tsx · pages/inicio-painel.tsx
  features/equipe/ … · features/oficina/ … · features/conta/ …
  components/ui/ (input, label, card, alert, badge via shadcn) · components/campo-formulario.tsx
  app/router.tsx
docker-compose.yml (mailpit) · .github/workflows/ci.yml (env) · docs/*
```

---

### Tarefa 1: `packages/shared` — e-mail, senha, permissões e schemas de conta

**Arquivos:** criar `packages/shared/src/email.ts`, `email.spec.ts`, `senhas-comuns.ts`, `permissoes.ts`, `permissoes.spec.ts`, `schemas/auth.ts`, `schemas/auth.spec.ts`, `schemas/oficina.ts`, `schemas/oficina.spec.ts`, `schemas/equipe.ts`, `schemas/equipe.spec.ts`, `tipos-auth.ts`; modificar `src/index.ts`.

**Interfaces (produz, importado de `@oficinatrack/shared`):**
- `normalizarEmail(entrada: string): string`
- `emailSchema`, `senhaSchema`, `identificadorSchema`, `tokenSchema`
- `VERSAO_TERMOS = '2026-09'`, `UFS` (27 siglas), `ufSchema`, `documentoSchema`
- `oficinaDadosSchema`, `cadastroSchema`, `loginSchema`, `emailApenasSchema`, `redefinirSenhaSchema`, `trocarSenhaSchema`, `conviteSchema`, `aceitarConviteSchema`, `alterarUsuarioSchema` e os tipos `z.input`/`z.output` correspondentes (`Cadastro`, `Login`, …)
- `PERMISSOES`, `type Permissao`, `PERMISSOES_POR_PERFIL`, `temPermissao(perfil, permissao): boolean`
- tipos `UsuarioEu`, `RespostaSessao`, `MembroEquipe`, `ConvitePendente`, `ConviteCriado`, `DadosOficina`

- [ ] **Passo 1: testes (falhando)**

`src/email.spec.ts`:
```ts
import { normalizarEmail } from './email.js';

describe('normalizarEmail', () => {
  it.each([
    ['Dono@Oficina.COM', 'dono@oficina.com'],
    ['  ze@gmail.com  ', 'ze@gmail.com'],
  ])('%s → %s', (entrada, esperado) => {
    expect(normalizarEmail(entrada)).toBe(esperado);
  });
});
```

`src/schemas/auth.spec.ts`:
```ts
import { cadastroSchema, emailSchema, loginSchema, senhaSchema, trocarSenhaSchema, VERSAO_TERMOS } from './auth.js';

const cadastroValido = {
  codigoPiloto: 'ABCD-EFGH-JKLM',
  oficina: { nome: 'Oficina do Zé', telefone: '(43) 99999-8888', cidade: 'Ribeirão do Pinhal', uf: 'PR' },
  dono: { nome: 'José', email: ' Ze@Oficina.com ', senha: 'motor-v8-turbo' },
  aceiteTermos: true,
};

describe('emailSchema', () => {
  it('normaliza antes de validar (Review Focus 2)', () => {
    expect(emailSchema.parse('  Dono@Oficina.COM ')).toBe('dono@oficina.com');
  });
  it.each(['', 'sem-arroba', 'a@', '@b.com', `${'a'.repeat(250)}@b.com`])('recusa %s', (v) => {
    expect(emailSchema.safeParse(v).success).toBe(false);
  });
});

describe('senhaSchema', () => {
  it('aceita senha de 8+ caracteres incomum', () => {
    expect(senhaSchema.safeParse('motor-v8-turbo').success).toBe(true);
  });
  it.each([
    ['curta', 'pelo menos 8'],
    ['12345678', 'muito comum'],
    ['Senha123', 'muito comum'],
    ['x'.repeat(129), 'no máximo 128'],
  ])('recusa %s', (senha, trecho) => {
    const r = senhaSchema.safeParse(senha);
    expect(r.success).toBe(false);
    expect(r.error?.issues[0]?.message).toContain(trecho);
  });
});

describe('cadastroSchema', () => {
  it('normaliza e-mail e telefone', () => {
    const r = cadastroSchema.parse(cadastroValido);
    expect(r.dono.email).toBe('ze@oficina.com');
    expect(r.oficina.telefone).toBe('+5543999998888');
  });
  it('exige aceite dos termos', () => {
    expect(cadastroSchema.safeParse({ ...cadastroValido, aceiteTermos: false }).success).toBe(false);
  });
  it('VERSAO_TERMOS é a versão vigente', () => {
    expect(VERSAO_TERMOS).toBe('2026-09');
  });
});

describe('loginSchema', () => {
  it('não aplica a política de senha no login (senhas antigas continuam entrando)', () => {
    expect(loginSchema.safeParse({ identificador: 'ze@oficina.com', senha: 'x' }).success).toBe(true);
  });
});

describe('trocarSenhaSchema', () => {
  it('recusa nova senha igual à atual', () => {
    expect(trocarSenhaSchema.safeParse({ senhaAtual: 'motor-v8-turbo', novaSenha: 'motor-v8-turbo' }).success).toBe(false);
  });
});
```

`src/schemas/oficina.spec.ts`:
```ts
import { documentoSchema, oficinaDadosSchema } from './oficina.js';

describe('documentoSchema', () => {
  it.each([
    ['123.456.789-09', '12345678909'],
    ['12.345.678/0001-95', '12345678000195'],
  ])('%s → %s', (entrada, esperado) => {
    expect(documentoSchema.parse(entrada)).toBe(esperado);
  });
  it('recusa tamanho diferente de 11 ou 14 dígitos', () => {
    expect(documentoSchema.safeParse('1234').success).toBe(false);
  });
});

describe('oficinaDadosSchema', () => {
  it('recusa UF inexistente', () => {
    expect(oficinaDadosSchema.safeParse({ nome: 'Oficina', telefone: '43999998888', uf: 'XX' }).success).toBe(false);
  });
  it('campos opcionais vazios viram undefined', () => {
    const r = oficinaDadosSchema.parse({ nome: 'Oficina', telefone: '43999998888', endereco: '', cidade: '', documento: '' });
    expect(r.endereco).toBeUndefined();
    expect(r.documento).toBeUndefined();
  });
});
```

`src/schemas/equipe.spec.ts`:
```ts
import { alterarUsuarioSchema, conviteSchema } from './equipe.js';

describe('conviteSchema', () => {
  it('perfil padrão FUNCIONARIO e telefone opcional', () => {
    const r = conviteSchema.parse({ nome: 'Mecânico', email: 'MEC@x.com', telefone: '' });
    expect(r).toEqual({ nome: 'Mecânico', email: 'mec@x.com', perfil: 'FUNCIONARIO' });
  });
});

describe('alterarUsuarioSchema', () => {
  it('exige ao menos um campo', () => {
    expect(alterarUsuarioSchema.safeParse({}).success).toBe(false);
  });
});
```

`src/permissoes.spec.ts`:
```ts
import { PerfilUsuario } from './enums.js';
import { PERMISSOES, PERMISSOES_POR_PERFIL, temPermissao } from './permissoes.js';

describe('permissões por perfil', () => {
  it('todo perfil tem entrada no mapa', () => {
    for (const perfil of PerfilUsuario.options) expect(PERMISSOES_POR_PERFIL[perfil]).toBeDefined();
  });
  it('DONO tem todas', () => {
    for (const p of PERMISSOES) expect(temPermissao('DONO', p)).toBe(true);
  });
  it('FUNCIONARIO opera mas não gerencia equipe nem oficina', () => {
    expect(temPermissao('FUNCIONARIO', 'OS_GERENCIAR')).toBe(true);
    expect(temPermissao('FUNCIONARIO', 'EQUIPE_GERENCIAR')).toBe(false);
    expect(temPermissao('FUNCIONARIO', 'OFICINA_EDITAR')).toBe(false);
  });
});
```

Rodar `pnpm --filter @oficinatrack/shared test` → FALHA.

- [ ] **Passo 2: implementação**

`src/email.ts`:
```ts
export function normalizarEmail(entrada: string): string {
  return entrada.trim().toLowerCase();
}
```

`src/senhas-comuns.ts`:
```ts
/** Senhas de 8+ caracteres mais usadas (inclui variações brasileiras). Comparação em minúsculas. */
export const SENHAS_COMUNS: ReadonlySet<string> = new Set([
  '12345678', '123456789', '1234567890', '12345678910', '87654321', '11111111', '00000000', '88888888',
  '12341234', '11223344', '123123123', 'password', 'password1', 'password123', 'qwerty123', 'qwertyuiop',
  'iloveyou', 'abc12345', 'abcd1234', 'admin123', 'administrador', 'senha123', 'senha1234', 'senha@123',
  'mudar123', 'trocar123', 'brasil123', 'brasil2026', 'flamengo', 'flamengo123', 'corinthians', 'palmeiras',
  'saopaulo', 'vasco123', 'gremio123', 'cruzeiro', 'botafogo', 'oficina123', 'mecanico', 'mecanico123',
  'carro123', 'motor123', 'teste123', 'testando', '1q2w3e4r', '1q2w3e4r5t', 'q1w2e3r4', 'aaaaaaaa',
  'asdfghjk', 'zxcvbnm1', 'minhasenha', 'deusefiel', 'jesus123', 'amorzinho', 'princesa', 'estrela1',
  'meuamor1', 'familia123', 'welcome1', 'letmein1', 'sunshine', 'football', 'baseball', 'superman',
]);
```

`src/permissoes.ts`:
```ts
import type { PerfilUsuario } from './enums.js';

export const PERMISSOES = [
  'OFICINA_EDITAR',
  'EQUIPE_GERENCIAR',
  'CLIENTES_GERENCIAR',
  'VEICULOS_GERENCIAR',
  'OS_GERENCIAR',
  'PATIO_OPERAR',
  'ORCAMENTOS_GERENCIAR',
] as const;
export type Permissao = (typeof PERMISSOES)[number];

const OPERACAO: readonly Permissao[] = [
  'CLIENTES_GERENCIAR',
  'VEICULOS_GERENCIAR',
  'OS_GERENCIAR',
  'PATIO_OPERAR',
  'ORCAMENTOS_GERENCIAR',
];

/**
 * Perfil → permissões. Endpoints e telas pedem PERMISSÕES, nunca perfis:
 * um perfil novo (ex.: FINANCEIRO, PATIO) é só mais uma entrada aqui.
 */
export const PERMISSOES_POR_PERFIL: Readonly<Record<PerfilUsuario, readonly Permissao[]>> = {
  DONO: PERMISSOES,
  FUNCIONARIO: OPERACAO,
};

export function temPermissao(perfil: PerfilUsuario, permissao: Permissao): boolean {
  return PERMISSOES_POR_PERFIL[perfil].includes(permissao);
}
```

`src/schemas/oficina.ts`:
```ts
import { z } from 'zod';
import { telefoneSchema } from './comuns.js';

export const UFS = [
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG', 'PA',
  'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO',
] as const;
export const ufSchema = z.enum(UFS, { error: 'UF inválida' });

/** Texto opcional: string vazia (campo de formulário em branco) vira `undefined`. */
export const textoOpcional = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((v) => (v ? v : undefined));

export const documentoSchema = z
  .string()
  .max(20)
  .transform((v) => v.replace(/\D/g, ''))
  .refine((v) => v.length === 11 || v.length === 14, { error: 'CPF ou CNPJ inválido' });

export const oficinaDadosSchema = z.object({
  nome: z.string().trim().min(2, { error: 'Informe o nome da oficina' }).max(120),
  telefone: telefoneSchema,
  endereco: textoOpcional(200),
  cidade: textoOpcional(80),
  uf: z.preprocess((v) => (v === '' ? undefined : v), ufSchema.optional()),
  documento: z.preprocess((v) => (v === '' ? undefined : v), documentoSchema.optional()),
});
export type DadosOficinaEntrada = z.input<typeof oficinaDadosSchema>;
export type DadosOficinaValidos = z.output<typeof oficinaDadosSchema>;
```

`src/schemas/auth.ts`:
```ts
import { z } from 'zod';
import { normalizarEmail } from '../email.js';
import { SENHAS_COMUNS } from '../senhas-comuns.js';
import { oficinaDadosSchema } from './oficina.js';

export const VERSAO_TERMOS = '2026-09';

export const emailSchema = z
  .string()
  .max(254, { error: 'E-mail muito longo' })
  .transform(normalizarEmail)
  .pipe(z.email({ error: 'E-mail inválido' }));

export const senhaSchema = z
  .string()
  .min(8, { error: 'A senha precisa ter pelo menos 8 caracteres' })
  .max(128, { error: 'A senha pode ter no máximo 128 caracteres' })
  .refine((s) => !SENHAS_COMUNS.has(s.toLowerCase()), { error: 'Essa senha é muito comum. Escolha outra' });

export const identificadorSchema = z.string().trim().min(1, { error: 'Informe e-mail ou telefone' }).max(254);
export const tokenSchema = z.string().min(20).max(100);

export const cadastroSchema = z.object({
  codigoPiloto: z.string().trim().max(20).optional(),
  oficina: oficinaDadosSchema,
  dono: z.object({
    nome: z.string().trim().min(2, { error: 'Informe seu nome' }).max(120),
    email: emailSchema,
    senha: senhaSchema,
  }),
  aceiteTermos: z.literal(true, { error: 'É preciso aceitar os termos de uso' }),
});
export type Cadastro = z.output<typeof cadastroSchema>;

export const loginSchema = z.object({
  identificador: identificadorSchema,
  senha: z.string().min(1, { error: 'Informe a senha' }).max(128),
});
export type Login = z.output<typeof loginSchema>;

export const emailApenasSchema = z.object({ email: emailSchema });
export const tokenApenasSchema = z.object({ token: tokenSchema });
export const redefinirSenhaSchema = z.object({ token: tokenSchema, senha: senhaSchema });

export const trocarSenhaSchema = z
  .object({ senhaAtual: z.string().min(1).max(128), novaSenha: senhaSchema })
  .refine((d) => d.senhaAtual !== d.novaSenha, { error: 'A nova senha precisa ser diferente da atual', path: ['novaSenha'] });
```

`src/schemas/equipe.ts`:
```ts
import { z } from 'zod';
import { PerfilUsuario } from '../enums.js';
import { emailSchema, senhaSchema, tokenSchema } from './auth.js';
import { telefoneSchema } from './comuns.js';

const telefoneOpcional = z.preprocess((v) => (v === '' ? undefined : v), telefoneSchema.optional());

export const conviteSchema = z.object({
  nome: z.string().trim().min(2, { error: 'Informe o nome' }).max(120),
  email: emailSchema,
  telefone: telefoneOpcional,
  perfil: PerfilUsuario.default('FUNCIONARIO'),
});
export type ConviteEntrada = z.input<typeof conviteSchema>;

export const aceitarConviteSchema = z.object({
  token: tokenSchema,
  senha: senhaSchema,
  nome: z.string().trim().min(2).max(120).optional(),
  telefone: telefoneOpcional,
});

export const alterarUsuarioSchema = z
  .object({ perfil: PerfilUsuario.optional(), ativo: z.boolean().optional() })
  .refine((d) => d.perfil !== undefined || d.ativo !== undefined, { error: 'Nada para alterar' });
```

`src/tipos-auth.ts`:
```ts
import type { PerfilUsuario } from './enums.js';
import type { Permissao } from './permissoes.js';

export type UsuarioEu = {
  id: string;
  nome: string;
  email: string;
  perfil: PerfilUsuario;
  permissoes: Permissao[];
  oficina: { id: string; nome: string };
};
export type RespostaSessao = { accessToken: string; usuario: UsuarioEu };
export type MembroEquipe = {
  id: string; nome: string; email: string; telefone: string | null; perfil: PerfilUsuario; ativo: boolean; criadoEm: string;
};
export type ConvitePendente = { id: string; nome: string; email: string; telefone: string | null; perfil: PerfilUsuario; expiraEm: string; criadoEm: string };
export type ConviteCriado = { convite: ConvitePendente; link: string };
export type DadosOficina = {
  id: string; nome: string; telefone: string; endereco: string | null; cidade: string | null; uf: string | null; documento: string | null;
};
```

Adicionar ao `src/index.ts`:
```ts
export * from './email.js';
export * from './permissoes.js';
export * from './schemas/auth.js';
export * from './schemas/oficina.js';
export * from './schemas/equipe.js';
export * from './tipos-auth.js';
```

- [ ] **Passo 3: verificar e commitar**

```bash
pnpm --filter @oficinatrack/shared test && pnpm --filter @oficinatrack/shared typecheck && pnpm build:shared && pnpm lint
git add packages/shared
git commit -m "feat(shared): e-mail, senha, permissoes por perfil e schemas de conta"
```

---

### Tarefa 2: Banco — contas, tokens de usuário e códigos de piloto

Agent: `arquiteto-dados`.

**Arquivos:** modificar `apps/api/prisma/schema.prisma`; criar migração `contas_e_acesso`; modificar `src/prisma/modelos-tenant.ts`, `src/prisma/relacoes-tenant.ts`, `src/prisma/prisma.service.ts`, `test/fabricas.ts`, `test/seguranca/apoio.ts` se necessário; criar `test/tenant/contas.e2e-spec.ts`; atualizar `docs/04-modelo-dados.md`.

**Interfaces (produz):**
- models `TokenUsuario` (tenant) e `CodigoPiloto` (global); enum `TipoTokenUsuario { CONFIRMAR_EMAIL REDEFINIR_SENHA }`
- `Usuario.email String @unique` (obrigatório), `Usuario.emailConfirmadoEm DateTime?`
- `Convite.email String` (obrigatório)
- `RefreshToken.substituidoEm DateTime?` (rotação; diferente de `revogadoEm`)
- `export type Tx` em `prisma.service.ts`: o cliente de transação interativa de `PrismaService['db']`
- `export type Db = PrismaService['db'] | Tx`

- [ ] **Passo 1: schema**

Em `Usuario`: `email String @unique`, novo `emailConfirmadoEm DateTime?`, nova relação `tokens TokenUsuario[]`.
Em `Convite`: `email String`.
Em `RefreshToken`: `substituidoEm DateTime? // rotação: token trocado por outro da mesma família`.
Em `Oficina`: `tokensUsuario TokenUsuario[]` e `codigoPiloto CodigoPiloto?`.

```prisma
enum TipoTokenUsuario {
  CONFIRMAR_EMAIL
  REDEFINIR_SENHA
}

model TokenUsuario {
  id        String           @id @default(cuid())
  oficinaId String
  oficina   Oficina          @relation(fields: [oficinaId], references: [id], onUpdate: Restrict)
  usuarioId String
  usuario   Usuario          @relation(fields: [oficinaId, usuarioId], references: [oficinaId, id], onDelete: Cascade, onUpdate: Restrict)
  tipo      TipoTokenUsuario
  tokenHash String           @unique
  expiraEm  DateTime
  usadoEm   DateTime?
  criadoEm  DateTime         @default(now())

  @@index([oficinaId, usuarioId, tipo])
}

/// Global (sem tenant): códigos gerados pelo administrador para liberar o cadastro no piloto.
model CodigoPiloto {
  id         String    @id @default(cuid())
  codigoHash String    @unique
  descricao  String
  expiraEm   DateTime
  usadoEm    DateTime?
  oficinaId  String?   @unique
  oficina    Oficina?  @relation(fields: [oficinaId], references: [id], onUpdate: Restrict)
  criadoEm   DateTime  @default(now())
}
```

- [ ] **Passo 2: migração**

Gerar o SQL com `prisma migrate diff` (o `--create-only` não roda sem terminal interativo), salvar como `prisma/migrations/<AAAAMMDDHHMMSS>_contas_e_acesso/migration.sql`, editar e aplicar com `pnpm --filter @oficinatrack/api exec prisma migrate dev`:
- Antes do `SET NOT NULL` de `Usuario.email` e `Convite.email`, um bloco que **falha alto** se houver nulos (nunca preenche valores inventados):
```sql
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM "Usuario" WHERE "email" IS NULL) OR EXISTS (SELECT 1 FROM "Convite" WHERE "email" IS NULL) THEN
    RAISE EXCEPTION 'Há usuários ou convites sem e-mail; preencha antes de aplicar esta migração';
  END IF;
END $$;
```
- Gatilho de `oficinaId` imutável em `TokenUsuario` (mesma função `impedir_troca_oficina()` da migração `fks_tenant_restritas`):
```sql
CREATE TRIGGER "TokenUsuario_impedir_troca_oficina" BEFORE UPDATE ON "TokenUsuario"
  FOR EACH ROW EXECUTE FUNCTION impedir_troca_oficina();
```
Se `migrate dev` pedir reset, PARAR e reportar BLOCKED.

- [ ] **Passo 3: tenant e mapas**

`modelos-tenant.ts`: adicionar `'TokenUsuario'`. `CodigoPiloto` NÃO entra (global); adicionar comentário: "Models globais (sem `oficinaId`): `CodigoPiloto`".
`relacoes-tenant.ts`: `Oficina` ganha `tokensUsuario: 'TokenUsuario'` e `codigoPiloto: 'CodigoPiloto'`; `Usuario` ganha `tokens: 'TokenUsuario'`; nova entrada `TokenUsuario: { oficina: 'Oficina', usuario: 'Usuario' }`. `CRIACAO_ANINHADA_PERMITIDA`: `Usuario` inclui `'tokens'`; `TokenUsuario: new Set()`. Os testes de sincronia (`extensao-tenant.spec.ts`) devem continuar passando sem ajuste de lógica — se o teste do mapa exigir que `codigoPiloto` (alvo global) não esteja no mapa, siga o teste e registre no relatório.

`prisma.service.ts`, depois da classe:
```ts
export type Db = PrismaService['db'];
/** Cliente recebido dentro de `db.$transaction(async (tx) => …)`. */
export type Tx = Parameters<Parameters<Db['$transaction']>[0]>[0];
```
Se o TypeScript não resolver `Tx` pela sobrecarga de `$transaction`, usar `Parameters<Extract<Db['$transaction'], (fn: (tx: any) => any, ...a: any[]) => any>>[0] extends (tx: infer T) => any ? T : never` e registrar.

- [ ] **Passo 4: testes (e2e)**

`test/tenant/contas.e2e-spec.ts`:
```ts
import { randomBytes } from 'node:crypto';
import { iniciar, montarOficina, type Ctx } from '../seguranca/apoio.js';

const sufixo = () => randomBytes(6).toString('hex');

describe('Contas: TokenUsuario e CodigoPiloto', () => {
  let ctx: Ctx;
  beforeAll(async () => { ctx = await iniciar(); });
  afterAll(() => ctx.modulo.close());

  it('TokenUsuario é filtrado por oficina', async () => {
    const a = await montarOficina(ctx, `A-${sufixo()}`);
    const b = await montarOficina(ctx, `B-${sufixo()}`);
    const token = await ctx.tenant.executarComo(a.oficina.id, () =>
      ctx.prisma.db.tokenUsuario.create({
        data: { oficinaId: a.oficina.id, usuarioId: a.usuario.id, tipo: 'CONFIRMAR_EMAIL', tokenHash: sufixo(), expiraEm: new Date(Date.now() + 60_000) },
      }),
    );
    const visto = await ctx.tenant.executarComo(b.oficina.id, () => ctx.prisma.db.tokenUsuario.findUnique({ where: { id: token.id } }));
    expect(visto).toBeNull();
  });

  it('TokenUsuario não aceita usuário de outra oficina (FK composta)', async () => {
    const a = await montarOficina(ctx, `A-${sufixo()}`);
    const b = await montarOficina(ctx, `B-${sufixo()}`);
    await expect(
      ctx.tenant.executarComo(a.oficina.id, () =>
        ctx.prisma.db.tokenUsuario.create({
          data: { oficinaId: a.oficina.id, usuarioId: b.usuario.id, tipo: 'REDEFINIR_SENHA', tokenHash: sufixo(), expiraEm: new Date() },
        }),
      ),
    ).rejects.toMatchObject({ code: 'P2003' });
  });

  it('CodigoPiloto é global: acessível sem tenant e fora de qualquer oficina', async () => {
    // sem tenant: códigos de piloto são do administrador, não de uma oficina
    const codigo = await ctx.tenant.executarSemTenant(() =>
      ctx.prisma.db.codigoPiloto.create({ data: { codigoHash: sufixo(), descricao: 'teste', expiraEm: new Date(Date.now() + 60_000) } }),
    );
    expect(codigo.usadoEm).toBeNull();
  });

  it('Usuario exige e-mail', async () => {
    const a = await montarOficina(ctx, `A-${sufixo()}`);
    await expect(
      ctx.tenant.executarComo(a.oficina.id, () =>
        // @ts-expect-error e-mail agora é obrigatório
        ctx.prisma.db.usuario.create({ data: { oficinaId: a.oficina.id, nome: 'Sem email', senhaHash: 'x', perfil: 'FUNCIONARIO' } }),
      ),
    ).rejects.toThrow();
  });
});
```
Ajustar `montarOficina` (apoio.ts) e `criarUsuario` (fabricas.ts) para preencher `emailConfirmadoEm: new Date()` (os usuários de teste representam contas ativas).

- [ ] **Passo 5: docs, verificação e commit**

Atualizar `docs/04-modelo-dados.md` (novas tabelas, campos, gatilho, `CodigoPiloto` global).
```bash
pnpm --filter @oficinatrack/api test && pnpm --filter @oficinatrack/api typecheck && pnpm lint
git add apps/api docs/04-modelo-dados.md
git commit -m "feat(db): e-mail obrigatorio, tokens de usuario e codigos de piloto"
```

---

### Tarefa 3: Infra da API — configuração, segurança de tokens/senhas e notificações

Agent: `backend-nest`.

**Arquivos:** modificar `src/config/env.ts` (+spec), `test/env-teste.ts`, `apps/api/.env.example`, `apps/api/.env` (local), `docker-compose.yml`, `.github/workflows/ci.yml`, `src/app.module.ts`, `src/configurar-app.ts`, `apps/api/package.json`; criar `src/common/seguranca/tokens.ts` (+spec), `senhas.ts` (+spec), `limites.ts`, `src/modules/notificacoes/*` (+ `modelos-email.spec.ts`).

**Interfaces (produz):**
- `Env` com: `JWT_SEGREDO` (string ≥ 32), `EMAIL_TRANSPORTE` (`'smtp' | 'memoria'`, padrão `smtp`), `SMTP_HOST` (padrão `localhost`), `SMTP_PORTA` (padrão `1025`), `SMTP_USUARIO?`, `SMTP_SENHA?`, `SMTP_SEGURO` (boolean, padrão `false`), `EMAIL_REMETENTE` (padrão `OficinaTrack <nao-responda@oficinatrack.local>`), `URL_APP` (url), `CADASTRO_EXIGE_CODIGO` (boolean, padrão `true`), `FATOR_LIMITES` (int ≥ 1, padrão 1)
- `gerarToken(): { token: string; hash: string }`, `hashToken(token: string): string`
- `hashSenha(senha: string): Promise<string>`, `verificarSenha(senhaHash: string | undefined, senha: string): Promise<boolean>`
- `limite(base: number): () => number` (multiplica por `FATOR_LIMITES`) e `fatorLimites(): number`
- `abstract class EnvioEmail { abstract enviar(msg: MensagemEmail): Promise<void> }`, `type MensagemEmail = { para: string; assunto: string; texto: string; html: string }`
- `EnvioEmailMemoria` com `enviados: MensagemEmail[]` e `ultimoPara(email): MensagemEmail | undefined`
- `abstract class EnvioSms` + `EnvioSmsLog`
- `modelosEmail.confirmarEmail({ nome, link })`, `.redefinirSenha({ nome, link })`, `.convite({ nomeOficina, nomeConvidado, link })` → `{ assunto, texto, html }`
- `NotificacoesModule` (global) exportando `EnvioEmail` e `EnvioSms`

- [ ] **Passo 1: dependências**

```bash
pnpm --filter @oficinatrack/api add @nestjs/jwt@^12.0.2 @node-rs/argon2@^2.2.1 cookie-parser@^1.4.7 nodemailer@^10.0.10 @nestjs/event-emitter@^12.0.1
pnpm --filter @oficinatrack/api add -D @types/cookie-parser @types/nodemailer tsx
```

- [ ] **Passo 2: env (teste → implementação)**

Acrescentar em `env.spec.ts`:
```ts
it('exige JWT_SEGREDO com pelo menos 32 caracteres', () => {
  expect(() => validarEnv({ ...valido, JWT_SEGREDO: 'curto' })).toThrow(/JWT_SEGREDO/);
});
it('converte CADASTRO_EXIGE_CODIGO e SMTP_SEGURO de texto', () => {
  const env = validarEnv({ ...valido, CADASTRO_EXIGE_CODIGO: 'false', SMTP_SEGURO: 'true' });
  expect(env.CADASTRO_EXIGE_CODIGO).toBe(false);
  expect(env.SMTP_SEGURO).toBe(true);
});
```
(`valido` passa a incluir `JWT_SEGREDO: 'x'.repeat(32)` e `URL_APP: 'http://localhost:5173'`.)

No `envSchema`, booleanos de texto com:
```ts
const booleanoTexto = (padrao: boolean) =>
  z.enum(['true', 'false']).default(padrao ? 'true' : 'false').transform((v) => v === 'true');
```
`ENV_TESTE` acrescenta: `JWT_SEGREDO: 'segredo-de-teste-com-mais-de-32-caracteres!!'`, `EMAIL_TRANSPORTE: 'memoria'`, `URL_APP: 'http://localhost:5173'`, `CADASTRO_EXIGE_CODIGO: 'true'`, `FATOR_LIMITES: '100'`. `.env.example` e o `.env` local ganham as mesmas variáveis (JWT com um valor de exemplo e o comentário `# gere com: node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"`). No `ci.yml`, acrescentar ao `env:` `JWT_SEGREDO`, `EMAIL_TRANSPORTE: memoria`, `URL_APP`, `FATOR_LIMITES: '100'`.

- [ ] **Passo 3: tokens e senhas (teste → implementação)**

`src/common/seguranca/tokens.spec.ts`:
```ts
import { gerarToken, hashToken } from './tokens.js';

describe('tokens', () => {
  it('gera 32 bytes em base64url e guarda só o hash sha-256', () => {
    const { token, hash } = gerarToken();
    expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
    expect(hashToken(token)).toBe(hash);
  });
  it('tokens diferentes a cada chamada', () => {
    expect(gerarToken().token).not.toBe(gerarToken().token);
  });
});
```

`src/common/seguranca/tokens.ts`:
```ts
import { createHash, randomBytes } from 'node:crypto';

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export function gerarToken(): { token: string; hash: string } {
  const token = randomBytes(32).toString('base64url');
  return { token, hash: hashToken(token) };
}
```

`src/common/seguranca/senhas.spec.ts`:
```ts
import { hashSenha, verificarSenha } from './senhas.js';

describe('senhas', () => {
  it('hash argon2id que confere só com a senha certa', async () => {
    const hash = await hashSenha('motor-v8-turbo');
    expect(hash.startsWith('$argon2id$')).toBe(true);
    expect(await verificarSenha(hash, 'motor-v8-turbo')).toBe(true);
    expect(await verificarSenha(hash, 'outra-senha')).toBe(false);
  });
  it('sem hash (usuário inexistente) retorna false sem lançar', async () => {
    expect(await verificarSenha(undefined, 'qualquer')).toBe(false);
  });
  it('hash corrompido retorna false', async () => {
    expect(await verificarSenha('nao-e-hash', 'x')).toBe(false);
  });
});
```

`src/common/seguranca/senhas.ts`:
```ts
import { hash, verify } from '@node-rs/argon2';

// Parâmetros mínimos recomendados pela OWASP para argon2id (a lib usa Argon2id por padrão).
const OPCOES = { memoryCost: 19_456, timeCost: 2, parallelism: 1 };

export function hashSenha(senha: string): Promise<string> {
  return hash(senha, OPCOES);
}

let hashFalso: Promise<string> | undefined;

/**
 * Sem hash (usuário não existe) ainda gasta o tempo de uma verificação, para o login
 * não revelar pelo tempo de resposta quais e-mails têm conta.
 */
export async function verificarSenha(senhaHash: string | undefined, senha: string): Promise<boolean> {
  if (!senhaHash) {
    hashFalso ??= hashSenha('senha-falsa-apenas-para-igualar-o-tempo');
    await verify(await hashFalso, senha).catch(() => false);
    return false;
  }
  return verify(senhaHash, senha).catch(() => false);
}
```

`src/common/seguranca/limites.ts`:
```ts
/** Multiplicador dos limites de requisição (testes usam valor alto; produção usa 1). */
export function fatorLimites(): number {
  const fator = Number(process.env.FATOR_LIMITES ?? '1');
  return Number.isInteger(fator) && fator >= 1 ? fator : 1;
}

/** Para `@Throttle({ default: { limit: limite(5), ttl } })`: lido a cada requisição. */
export const limite = (base: number) => () => base * fatorLimites();
```
No `AppModule`, o throttler global passa a `ThrottlerModule.forRoot([{ ttl: 60_000, limit: limite(120) }])`.

- [ ] **Passo 4: notificações (teste → implementação)**

`src/modules/notificacoes/modelos-email.spec.ts`:
```ts
import { modelosEmail } from './modelos-email.js';

describe('modelos de e-mail', () => {
  it('confirmação traz o link no texto e no html e escapa o nome', () => {
    const m = modelosEmail.confirmarEmail({ nome: '<b>Zé</b>', link: 'http://localhost:5173/confirmar-email#abc' });
    expect(m.assunto).toBe('Confirme seu e-mail no OficinaTrack');
    expect(m.texto).toContain('http://localhost:5173/confirmar-email#abc');
    expect(m.html).toContain('href="http://localhost:5173/confirmar-email#abc"');
    expect(m.html).toContain('&lt;b&gt;Zé&lt;/b&gt;');
    expect(m.html).not.toContain('<b>Zé</b>');
  });
  it('convite cita a oficina', () => {
    const m = modelosEmail.convite({ nomeOficina: 'Oficina do Zé', nomeConvidado: 'Ana', link: 'http://x/convite#t' });
    expect(m.assunto).toBe('Oficina do Zé convidou você para o OficinaTrack');
  });
});
```

`src/modules/notificacoes/modelos-email.ts`:
```ts
type Modelo = { assunto: string; texto: string; html: string };

const escapar = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

function montar(assunto: string, saudacao: string, paragrafo: string, rotuloBotao: string, link: string, rodape: string): Modelo {
  const texto = `${saudacao}\n\n${paragrafo}\n\n${rotuloBotao}: ${link}\n\n${rodape}`;
  const html = `<!doctype html><html lang="pt-BR"><body style="font-family:Arial,sans-serif;color:#1b2220;line-height:1.5">
<p>${escapar(saudacao)}</p><p>${escapar(paragrafo)}</p>
<p><a href="${escapar(link)}" style="display:inline-block;padding:12px 20px;background:#1f4e8c;color:#fff;text-decoration:none;border-radius:8px">${escapar(rotuloBotao)}</a></p>
<p style="font-size:13px;color:#5c6662">${escapar(rodape)}</p></body></html>`;
  return { assunto, texto, html };
}

export const modelosEmail = {
  confirmarEmail: ({ nome, link }: { nome: string; link: string }) =>
    montar('Confirme seu e-mail no OficinaTrack', `Olá, ${nome}!`, 'Falta só confirmar seu e-mail para começar a usar o OficinaTrack.',
      'Confirmar e-mail', link, 'O link vale por 24 horas. Se você não criou esta conta, ignore este e-mail.'),
  redefinirSenha: ({ nome, link }: { nome: string; link: string }) =>
    montar('Redefinição de senha do OficinaTrack', `Olá, ${nome}!`, 'Recebemos um pedido para redefinir sua senha.',
      'Criar nova senha', link, 'O link vale por 1 hora. Se não foi você, ignore este e-mail: sua senha continua a mesma.'),
  convite: ({ nomeOficina, nomeConvidado, link }: { nomeOficina: string; nomeConvidado: string; link: string }) =>
    montar(`${nomeOficina} convidou você para o OficinaTrack`, `Olá, ${nomeConvidado}!`,
      `A ${nomeOficina} convidou você para acompanhar os carros do pátio pelo OficinaTrack.`,
      'Aceitar convite', link, 'O convite vale por 72 horas.'),
};
```

`envio-email.ts`:
```ts
export type MensagemEmail = { para: string; assunto: string; texto: string; html: string };
export abstract class EnvioEmail {
  abstract enviar(mensagem: MensagemEmail): Promise<void>;
}
```

`envio-email-smtp.ts`:
```ts
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import nodemailer, { type Transporter } from 'nodemailer';
import type { Env } from '../../config/env.js';
import { EnvioEmail, type MensagemEmail } from './envio-email.js';

@Injectable()
export class EnvioEmailSmtp extends EnvioEmail {
  private readonly transporte: Transporter;
  private readonly remetente: string;

  constructor(config: ConfigService<Env, true>) {
    super();
    const usuario = config.get('SMTP_USUARIO', { infer: true });
    this.transporte = nodemailer.createTransport({
      host: config.get('SMTP_HOST', { infer: true }),
      port: config.get('SMTP_PORTA', { infer: true }),
      secure: config.get('SMTP_SEGURO', { infer: true }),
      auth: usuario ? { user: usuario, pass: config.get('SMTP_SENHA', { infer: true }) } : undefined,
    });
    this.remetente = config.get('EMAIL_REMETENTE', { infer: true });
  }

  async enviar({ para, assunto, texto, html }: MensagemEmail): Promise<void> {
    await this.transporte.sendMail({ from: this.remetente, to: para, subject: assunto, text: texto, html });
  }
}
```

`envio-email-memoria.ts`:
```ts
import { Injectable } from '@nestjs/common';
import { EnvioEmail, type MensagemEmail } from './envio-email.js';

/** Usado nos testes (EMAIL_TRANSPORTE=memoria): guarda as mensagens em vez de enviar. */
@Injectable()
export class EnvioEmailMemoria extends EnvioEmail {
  readonly enviados: MensagemEmail[] = [];

  async enviar(mensagem: MensagemEmail): Promise<void> {
    this.enviados.push(mensagem);
  }

  ultimoPara(email: string): MensagemEmail | undefined {
    return this.enviados.filter((m) => m.para === email).at(-1);
  }
}
```

`envio-sms.ts`:
```ts
import { Injectable, Logger } from '@nestjs/common';

export abstract class EnvioSms {
  abstract enviar(telefoneE164: string, texto: string): Promise<void>;
}

/** SMS está fora do MVP: só registra que haveria um envio (sem o número nem o texto). */
@Injectable()
export class EnvioSmsLog extends EnvioSms {
  private readonly logger = new Logger('EnvioSms');
  async enviar(): Promise<void> {
    this.logger.log('SMS não enviado: canal desligado no MVP');
  }
}
```

`notificacoes.module.ts`:
```ts
import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from '../../config/env.js';
import { EnvioEmail } from './envio-email.js';
import { EnvioEmailMemoria } from './envio-email-memoria.js';
import { EnvioEmailSmtp } from './envio-email-smtp.js';
import { EnvioSms, EnvioSmsLog } from './envio-sms.js';

@Global()
@Module({
  providers: [
    EnvioEmailMemoria,
    {
      provide: EnvioEmail,
      inject: [ConfigService, EnvioEmailMemoria],
      useFactory: (config: ConfigService<Env, true>, memoria: EnvioEmailMemoria) =>
        config.get('EMAIL_TRANSPORTE', { infer: true }) === 'memoria' ? memoria : new EnvioEmailSmtp(config),
    },
    { provide: EnvioSms, useClass: EnvioSmsLog },
  ],
  exports: [EnvioEmail, EnvioEmailMemoria, EnvioSms],
})
export class NotificacoesModule {}
```
Importar `NotificacoesModule` e `EventEmitterModule.forRoot()` no `AppModule`. Em `configurarApp`, logo depois do `helmet()`: `express.use(cookieParser())`.

`docker-compose.yml`, novo serviço:
```yaml
  mailpit:
    image: axllent/mailpit:v1.27
    ports:
      - "127.0.0.1:1025:1025"
      - "127.0.0.1:8025:8025"
```
(Se a tag não existir, usar a versão estável mais recente publicada e registrar; nunca `latest`.)

- [ ] **Passo 5: verificar e commitar**

```bash
docker compose up -d --wait
pnpm --filter @oficinatrack/api test && pnpm --filter @oficinatrack/api typecheck && pnpm lint && pnpm audit --prod --audit-level high
git add apps/api docker-compose.yml .github/workflows/ci.yml pnpm-lock.yaml
git commit -m "feat(api): config de autenticacao, tokens, senhas argon2id e notificacoes por e-mail"
```

---

### Tarefa 4: Sessão, login e guards

Agent: `backend-nest`. É a base de segurança da sprint.

**Arquivos:** criar `src/modules/oficinas/{oficinas.module.ts,oficinas.service.ts}`, `src/modules/usuarios/{usuarios.module.ts,usuarios.service.ts,eventos.ts}`, `src/modules/auth/{auth.module.ts,auth.controller.ts,auth.service.ts,sessoes.service.ts,limite-tentativas.service.ts,cookie-refresh.ts,decorators.ts,autenticacao.guard.ts,permissao.guard.ts}`; modificar `app.module.ts`, `modules/saude/saude.controller.ts` (`@Publico()`); criar `test/auth/apoio-auth.ts`, `test/auth/sessao.e2e-spec.ts`, `test/auth/guards.e2e-spec.ts`, `test/auth/limites.e2e-spec.ts`.

**Interfaces:**
- Consome: `gerarToken`, `hashToken`, `verificarSenha`, `limite`, `fatorLimites` (Tarefa 3); `Tx`, `Db` (Tarefa 2); `temPermissao`, `loginSchema`, `RespostaSessao`, `UsuarioEu` (Tarefa 1).
- Produz:
  - `@Publico()`, `@ExigePermissao(...permissoes: Permissao[])`, `@UsuarioAtual()`; `type UsuarioAutenticado = { id: string; oficinaId: string; perfil: PerfilUsuario; nome: string; email: string; familiaId: string }`
  - `SessoesService`: `criar(usuario: { id; oficinaId; perfil }, familiaId?: string): Promise<Sessao>`, `renovar(refreshToken: string): Promise<Sessao & { usuarioId: string; oficinaId: string }>`, `revogar(refreshToken: string): Promise<void>`, `revogarTodasDoUsuario(usuarioId: string, excetoFamilia?: string): Promise<void>`; `type Sessao = { accessToken: string; refreshToken: string; refreshExpiraEm: Date; familiaId: string }`
  - `AuthService`: `login(dados: Login): Promise<Sessao & { usuarioId: string; oficinaId: string }>`, `montarEu(usuarioId: string): Promise<UsuarioEu>` (dentro do contexto da oficina)
  - `definirCookieRefresh(res, sessao)`, `limparCookieRefresh(res)`, `COOKIE_REFRESH = 'ot_refresh'`
  - `UsuariosService`: `buscarParaLogin(chave: string)` (chamar sem tenant), `buscarAtivo(id)`, `buscarPorId(id)`, `emailEmUso(email, db?)`, `criarDono(db, dados)`, `marcarEmailConfirmado(id)`, `atualizarSenha(id, senhaHash)` — todos os `find` com `select` que nunca devolve `senhaHash`, exceto `buscarParaLogin`
  - `OficinasService`: `buscarAtual()`, `criar(db, dados)`, `atualizar(dados)`
  - evento `USUARIO_DESATIVADO = 'usuario.desativado'` com `{ oficinaId: string; usuarioId: string }`
  - Endpoints: `POST /auth/login`, `POST /auth/refresh`, `POST /auth/logout`, `GET /auth/eu`

- [ ] **Passo 1: apoio dos testes de autenticação**

`test/auth/apoio-auth.ts`:
```ts
import { randomBytes } from 'node:crypto';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../../src/app.module.js';
import { hashSenha } from '../../src/common/seguranca/senhas.js';
import { TenantContext } from '../../src/common/tenant/tenant-context.js';
import { configurarApp } from '../../src/configurar-app.js';
import { EnvioEmailMemoria } from '../../src/modules/notificacoes/envio-email-memoria.js';
import { PrismaService } from '../../src/prisma/prisma.service.js';

export const ORIGEM = 'http://localhost:5173';
export const SENHA = 'motor-v8-turbo';
export const sufixo = () => randomBytes(6).toString('hex');
export const telefone = () => `+55439${String(Math.floor(Math.random() * 1e8)).padStart(8, '0')}`;

export type App = { app: INestApplication; http: ReturnType<typeof request>; prisma: PrismaService; tenant: TenantContext; emails: EnvioEmailMemoria };

export async function criarApp(): Promise<App> {
  const modulo = await Test.createTestingModule({ imports: [AppModule] }).compile();
  const app = modulo.createNestApplication({ bodyParser: false });
  configurarApp(app);
  await app.init();
  return { app, http: request(app.getHttpServer()), prisma: modulo.get(PrismaService), tenant: modulo.get(TenantContext), emails: modulo.get(EnvioEmailMemoria) };
}

/** Oficina com usuário de e-mail confirmado e senha conhecida, criada direto no banco. */
export async function criarOficinaComUsuario(ctx: App, perfil: 'DONO' | 'FUNCIONARIO' = 'DONO') {
  // sem tenant: a oficina ainda não existe
  const oficina = await ctx.tenant.executarSemTenant(() =>
    ctx.prisma.db.oficina.create({ data: { nome: `Oficina ${sufixo()}`, telefone: telefone(), termosVersao: '2026-09', termosAceitosEm: new Date() } }),
  );
  const usuario = await criarUsuarioNa(ctx, oficina.id, perfil);
  return { oficina, usuario };
}

export async function criarUsuarioNa(ctx: App, oficinaId: string, perfil: 'DONO' | 'FUNCIONARIO', extra: { emailConfirmadoEm?: Date | null; ativo?: boolean } = {}) {
  const senhaHash = await hashSenha(SENHA);
  return ctx.tenant.executarComo(oficinaId, () =>
    ctx.prisma.db.usuario.create({
      data: {
        oficinaId,
        nome: `Usuário ${sufixo()}`,
        email: `u-${sufixo()}@teste.local`,
        telefone: telefone(),
        senhaHash,
        perfil,
        emailConfirmadoEm: extra.emailConfirmadoEm === undefined ? new Date() : extra.emailConfirmadoEm,
        ativo: extra.ativo ?? true,
      },
    }),
  );
}

export function cookieRefresh(res: { headers: Record<string, unknown> }): string {
  const cookies = ([] as string[]).concat((res.headers['set-cookie'] as string[] | string | undefined) ?? []);
  const c = cookies.find((x) => x.startsWith('ot_refresh='));
  if (!c) throw new Error('sem cookie ot_refresh');
  return c.split(';')[0]!;
}

export async function entrar(ctx: App, email: string, senha = SENHA) {
  const res = await ctx.http.post('/api/v1/auth/login').set('Origin', ORIGEM).send({ identificador: email, senha }).expect(200);
  return { accessToken: res.body.accessToken as string, cookie: cookieRefresh(res), corpo: res.body };
}
```
(Supertest: usar `request(app.getHttpServer())` a cada chamada se `http` reaproveitado não funcionar para vários pedidos; ajustar o tipo e registrar.)

- [ ] **Passo 2: testes e2e (falhando)**

`test/auth/sessao.e2e-spec.ts`:
```ts
import { cookieRefresh, criarApp, criarOficinaComUsuario, criarUsuarioNa, entrar, ORIGEM, SENHA, type App } from './apoio-auth.js';

describe('Sessão: login, refresh, logout, eu', () => {
  let ctx: App;
  beforeAll(async () => { ctx = await criarApp(); });
  afterAll(() => ctx.app.close());

  it('login por e-mail com maiúsculas e espaços (Review Focus 2) devolve token, cookie seguro e dados do usuário', async () => {
    const { oficina, usuario } = await criarOficinaComUsuario(ctx);
    const res = await ctx.http.post('/api/v1/auth/login').set('Origin', ORIGEM).send({ identificador: `  ${usuario.email.toUpperCase()} `, senha: SENHA }).expect(200);
    expect(res.body.accessToken).toEqual(expect.any(String));
    expect(res.body.usuario).toMatchObject({ id: usuario.id, perfil: 'DONO', oficina: { id: oficina.id } });
    expect(res.body.usuario.permissoes).toContain('EQUIPE_GERENCIAR');
    const cookie = ([] as string[]).concat(res.headers['set-cookie']).find((c) => c.startsWith('ot_refresh='))!;
    expect(cookie).toMatch(/HttpOnly/i);
    expect(cookie).toMatch(/Secure/i);
    expect(cookie).toMatch(/SameSite=Strict/i);
    expect(cookie).toMatch(/Path=\/api\/v1\/auth/);
  });

  it('login por telefone', async () => {
    const { usuario } = await criarOficinaComUsuario(ctx);
    await ctx.http.post('/api/v1/auth/login').set('Origin', ORIGEM).send({ identificador: usuario.telefone!.replace('+55', ''), senha: SENHA }).expect(200);
  });

  it('senha errada, e-mail inexistente e usuário inativo dão a mesma resposta', async () => {
    const { oficina, usuario } = await criarOficinaComUsuario(ctx);
    const inativo = await criarUsuarioNa(ctx, oficina.id, 'FUNCIONARIO', { ativo: false });
    const respostas = await Promise.all([
      ctx.http.post('/api/v1/auth/login').send({ identificador: usuario.email, senha: 'errada-errada' }),
      ctx.http.post('/api/v1/auth/login').send({ identificador: 'ninguem-aqui@teste.local', senha: SENHA }),
      ctx.http.post('/api/v1/auth/login').send({ identificador: inativo.email, senha: SENHA }),
    ]);
    for (const r of respostas) {
      expect(r.status).toBe(401);
      expect(r.body).toEqual({ statusCode: 401, code: 'CREDENCIAIS_INVALIDAS', message: 'E-mail/telefone ou senha inválidos' });
    }
  });

  it('e-mail não confirmado com senha certa → 403 EMAIL_NAO_CONFIRMADO', async () => {
    const { oficina } = await criarOficinaComUsuario(ctx);
    const pendente = await criarUsuarioNa(ctx, oficina.id, 'DONO', { emailConfirmadoEm: null });
    const r = await ctx.http.post('/api/v1/auth/login').send({ identificador: pendente.email, senha: SENHA }).expect(403);
    expect(r.body.code).toBe('EMAIL_NAO_CONFIRMADO');
  });

  it('GET /auth/eu com o token de acesso', async () => {
    const { usuario } = await criarOficinaComUsuario(ctx);
    const { accessToken } = await entrar(ctx, usuario.email);
    const r = await ctx.http.get('/api/v1/auth/eu').set('Authorization', `Bearer ${accessToken}`).expect(200);
    expect(r.body).toMatchObject({ id: usuario.id, email: usuario.email });
    expect(r.body).not.toHaveProperty('senhaHash');
  });

  it('refresh gira o token: novo cookie funciona, o antigo não', async () => {
    const { usuario } = await criarOficinaComUsuario(ctx);
    const { cookie } = await entrar(ctx, usuario.email);
    const r1 = await ctx.http.post('/api/v1/auth/refresh').set('Origin', ORIGEM).set('Cookie', cookie).expect(200);
    const novo = cookieRefresh(r1);
    expect(novo).not.toBe(cookie);
    await ctx.http.post('/api/v1/auth/refresh').set('Origin', ORIGEM).set('Cookie', novo).expect(200);
  });

  it('refresh concorrente (duas abas) não derruba a sessão (Review Focus 1)', async () => {
    const { usuario } = await criarOficinaComUsuario(ctx);
    const { cookie } = await entrar(ctx, usuario.email);
    const [a, b] = await Promise.all([
      ctx.http.post('/api/v1/auth/refresh').set('Origin', ORIGEM).set('Cookie', cookie),
      ctx.http.post('/api/v1/auth/refresh').set('Origin', ORIGEM).set('Cookie', cookie),
    ]);
    const vencedor = [a, b].find((r) => r.status === 200)!;
    expect(vencedor).toBeDefined();
    // a família continua viva: o cookie novo do vencedor segue renovando
    await ctx.http.post('/api/v1/auth/refresh').set('Origin', ORIGEM).set('Cookie', cookieRefresh(vencedor)).expect(200);
  });

  it('reuso de refresh antigo depois da tolerância revoga a família inteira', async () => {
    const { usuario } = await criarOficinaComUsuario(ctx);
    const { cookie } = await entrar(ctx, usuario.email);
    const r1 = await ctx.http.post('/api/v1/auth/refresh').set('Origin', ORIGEM).set('Cookie', cookie).expect(200);
    const novo = cookieRefresh(r1);
    // envelhece a rotação para além dos 10 s de tolerância
    await ctx.tenant.executarComo(usuario.oficinaId, () =>
      ctx.prisma.db.refreshToken.updateMany({ where: { usuarioId: usuario.id, substituidoEm: { not: null } }, data: { substituidoEm: new Date(Date.now() - 60_000) } }),
    );
    const reuso = await ctx.http.post('/api/v1/auth/refresh').set('Origin', ORIGEM).set('Cookie', cookie).expect(401);
    expect(reuso.body.code).toBe('SESSAO_INVALIDA');
    await ctx.http.post('/api/v1/auth/refresh').set('Origin', ORIGEM).set('Cookie', novo).expect(401);
  });

  it('refresh sem Origin ou com Origin de outro site → 403', async () => {
    const { usuario } = await criarOficinaComUsuario(ctx);
    const { cookie } = await entrar(ctx, usuario.email);
    await ctx.http.post('/api/v1/auth/refresh').set('Cookie', cookie).expect(403);
    await ctx.http.post('/api/v1/auth/refresh').set('Origin', 'https://golpe.example').set('Cookie', cookie).expect(403);
  });

  it('logout revoga o refresh e limpa o cookie', async () => {
    const { usuario } = await criarOficinaComUsuario(ctx);
    const { cookie } = await entrar(ctx, usuario.email);
    const r = await ctx.http.post('/api/v1/auth/logout').set('Origin', ORIGEM).set('Cookie', cookie).expect(204);
    expect(([] as string[]).concat(r.headers['set-cookie']).join(';')).toMatch(/ot_refresh=;/);
    await ctx.http.post('/api/v1/auth/refresh').set('Origin', ORIGEM).set('Cookie', cookie).expect(401);
  });

  it('refresh de usuário desativado → 401 (Review Focus 4)', async () => {
    const { oficina } = await criarOficinaComUsuario(ctx);
    const func = await criarUsuarioNa(ctx, oficina.id, 'FUNCIONARIO');
    const { cookie } = await entrar(ctx, func.email);
    await ctx.tenant.executarComo(oficina.id, () => ctx.prisma.db.usuario.update({ where: { id: func.id }, data: { ativo: false } }));
    await ctx.http.post('/api/v1/auth/refresh').set('Origin', ORIGEM).set('Cookie', cookie).expect(401);
  });
});
```

`test/auth/guards.e2e-spec.ts`:
```ts
import { criarApp, criarOficinaComUsuario, criarUsuarioNa, entrar, type App } from './apoio-auth.js';

describe('Guards globais', () => {
  let ctx: App;
  beforeAll(async () => { ctx = await criarApp(); });
  afterAll(() => ctx.app.close());

  it('rota sem @Publico exige login (negação por padrão)', async () => {
    const r = await ctx.http.get('/api/v1/auth/eu').expect(401);
    expect(r.body.code).toBe('NAO_AUTENTICADO');
  });

  it('token inválido, adulterado ou assinado com outro segredo → 401', async () => {
    const { usuario } = await criarOficinaComUsuario(ctx);
    const { accessToken } = await entrar(ctx, usuario.email);
    const [cab, corpo] = accessToken.split('.');
    const adulterado = `${cab}.${corpo}.assinatura-falsa`;
    await ctx.http.get('/api/v1/auth/eu').set('Authorization', `Bearer ${adulterado}`).expect(401);
    await ctx.http.get('/api/v1/auth/eu').set('Authorization', 'Bearer lixo').expect(401);
  });

  it('usuário desativado perde acesso na próxima chamada (Review Focus 4)', async () => {
    const { oficina } = await criarOficinaComUsuario(ctx);
    const func = await criarUsuarioNa(ctx, oficina.id, 'FUNCIONARIO');
    const { accessToken } = await entrar(ctx, func.email);
    await ctx.tenant.executarComo(oficina.id, () => ctx.prisma.db.usuario.update({ where: { id: func.id }, data: { ativo: false } }));
    await ctx.http.get('/api/v1/auth/eu').set('Authorization', `Bearer ${accessToken}`).expect(401);
  });

  it('saúde continua pública', async () => {
    await ctx.http.get('/api/v1/saude').expect(200);
  });
});
```
(O 403 por permissão é testado na Tarefa 7, onde existem as rotas de DONO.)

`test/auth/limites.e2e-spec.ts` (arquivo próprio: roda com `FATOR_LIMITES=1`):
```ts
process.env.FATOR_LIMITES = '1';
const { criarApp, criarOficinaComUsuario } = await import('./apoio-auth.js');

describe('Limites de tentativa de login', () => {
  it('5 senhas erradas para o mesmo e-mail bloqueiam a 6ª tentativa, mesmo com a senha certa', async () => {
    const ctx = await criarApp();
    try {
      const { usuario } = await criarOficinaComUsuario(ctx);
      for (let i = 0; i < 5; i++) {
        await ctx.http.post('/api/v1/auth/login').send({ identificador: usuario.email, senha: 'errada-errada' }).expect((r) => expect([401, 429]).toContain(r.status));
      }
      const r = await ctx.http.post('/api/v1/auth/login').send({ identificador: usuario.email, senha: 'motor-v8-turbo' });
      expect(r.status).toBe(429);
      expect(['MUITAS_TENTATIVAS', 'MUITAS_REQUISICOES']).toContain(r.body.code);
    } finally {
      await ctx.app.close();
    }
  });
});
```
Se o `vitest.config.e2e.ts` definir `FATOR_LIMITES` via `test.env` de um jeito que sobrescreva o `process.env` depois do import, ajustar para o teste ler o fator 1 (por exemplo, `vi.stubEnv` antes do `import` dinâmico) e registrar.

Rodar os três arquivos → FALHA.

- [ ] **Passo 3: `UsuariosService`, `OficinasService` e evento**

`src/modules/usuarios/eventos.ts`:
```ts
export const USUARIO_DESATIVADO = 'usuario.desativado';
export type UsuarioDesativado = { oficinaId: string; usuarioId: string };
```

`src/modules/usuarios/usuarios.service.ts` (métodos desta tarefa; a Tarefa 7 acrescenta `listar` e `alterar`):
```ts
import { Injectable } from '@nestjs/common';
import type { PerfilUsuario } from '@oficinatrack/shared';
import { PrismaService, type Db, type Tx } from '../../prisma/prisma.service.js';

export const CAMPOS_PUBLICOS = {
  id: true, oficinaId: true, nome: true, email: true, telefone: true, perfil: true, ativo: true, emailConfirmadoEm: true, criadoEm: true,
} as const;

@Injectable()
export class UsuariosService {
  constructor(private readonly prisma: PrismaService) {}

  /** Chamar dentro de `executarSemTenant`: e-mail e telefone são únicos no sistema. Único método que devolve `senhaHash`. */
  buscarParaLogin(chave: string) {
    return this.prisma.db.usuario.findUnique({ where: chave.includes('@') ? { email: chave } : { telefone: chave } });
  }

  buscarAtivo(id: string) {
    return this.prisma.db.usuario.findFirst({ where: { id, ativo: true }, select: CAMPOS_PUBLICOS });
  }

  buscarPorId(id: string) {
    return this.prisma.db.usuario.findUnique({ where: { id }, select: CAMPOS_PUBLICOS });
  }

  async emailEmUso(email: string, db: Db | Tx = this.prisma.db): Promise<boolean> {
    return (await db.usuario.count({ where: { email } })) > 0;
  }

  async telefoneEmUso(telefone: string, db: Db | Tx = this.prisma.db): Promise<boolean> {
    return (await db.usuario.count({ where: { telefone } })) > 0;
  }

  criarDono(db: Db | Tx, dados: { oficinaId: string; nome: string; email: string; senhaHash: string }) {
    return db.usuario.create({ data: { ...dados, perfil: 'DONO' as PerfilUsuario }, select: CAMPOS_PUBLICOS });
  }

  marcarEmailConfirmado(id: string) {
    return this.prisma.db.usuario.updateMany({ where: { id, emailConfirmadoEm: null }, data: { emailConfirmadoEm: new Date() } });
  }

  atualizarSenha(id: string, senhaHash: string) {
    return this.prisma.db.usuario.update({ where: { id }, data: { senhaHash }, select: { id: true } });
  }

  buscarSenhaHash(id: string) {
    return this.prisma.db.usuario.findUnique({ where: { id }, select: { senhaHash: true } });
  }
}
```
Os `count` sem tenant (`emailEmUso`, `telefoneEmUso`) são chamados pelo chamador dentro de `executarSemTenant` quando a unicidade é global; documentar no JSDoc.

`src/modules/oficinas/oficinas.service.ts`:
```ts
import { Injectable } from '@nestjs/common';
import type { DadosOficinaValidos } from '@oficinatrack/shared';
import { VERSAO_TERMOS } from '@oficinatrack/shared';
import { PrismaService, type Db, type Tx } from '../../prisma/prisma.service.js';

const CAMPOS = { id: true, nome: true, telefone: true, endereco: true, cidade: true, uf: true, documento: true } as const;

@Injectable()
export class OficinasService {
  constructor(private readonly prisma: PrismaService) {}

  /** Oficina do contexto atual (a extensão filtra `Oficina` por id). */
  buscarAtual() {
    return this.prisma.db.oficina.findFirstOrThrow({ select: CAMPOS });
  }

  criar(db: Db | Tx, dados: DadosOficinaValidos) {
    return db.oficina.create({ data: { ...dados, termosVersao: VERSAO_TERMOS, termosAceitosEm: new Date() }, select: CAMPOS });
  }

  async atualizar(dados: DadosOficinaValidos) {
    const atual = await this.buscarAtual();
    return this.prisma.db.oficina.update({
      where: { id: atual.id },
      data: { ...dados, endereco: dados.endereco ?? null, cidade: dados.cidade ?? null, uf: dados.uf ?? null, documento: dados.documento ?? null },
      select: CAMPOS,
    });
  }
}
```
`OficinasModule` e `UsuariosModule` exportam os services.

- [ ] **Passo 4: decorators, guards, sessões e login**

`src/modules/auth/decorators.ts`:
```ts
import { createParamDecorator, type ExecutionContext, SetMetadata } from '@nestjs/common';
import type { PerfilUsuario, Permissao } from '@oficinatrack/shared';

export const CHAVE_PUBLICO = 'rota-publica';
export const CHAVE_PERMISSOES = 'permissoes-exigidas';

/** Libera a rota do guard de autenticação. Toda rota sem isto exige login. */
export const Publico = () => SetMetadata(CHAVE_PUBLICO, true);
export const ExigePermissao = (...permissoes: Permissao[]) => SetMetadata(CHAVE_PERMISSOES, permissoes);

export type UsuarioAutenticado = { id: string; oficinaId: string; perfil: PerfilUsuario; nome: string; email: string; familiaId: string };
export type RequisicaoAutenticada = { usuario?: UsuarioAutenticado };

export const UsuarioAtual = createParamDecorator(
  (_dado: unknown, ctx: ExecutionContext): UsuarioAutenticado => ctx.switchToHttp().getRequest<RequisicaoAutenticada>().usuario!,
);
```

`src/modules/auth/autenticacao.guard.ts`:
```ts
import { type CanActivate, type ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import type { Request } from 'express';
import type { PerfilUsuario } from '@oficinatrack/shared';
import { ErroNegocio } from '../../common/erros/erro-negocio.js';
import { TenantContext } from '../../common/tenant/tenant-context.js';
import { UsuariosService } from '../usuarios/usuarios.service.js';
import { CHAVE_PUBLICO, type RequisicaoAutenticada } from './decorators.js';

export type PayloadAcesso = { sub: string; oficinaId: string; perfil: PerfilUsuario; fam: string };
export const naoAutenticado = () => new ErroNegocio(401, 'NAO_AUTENTICADO', 'Faça login para continuar');

@Injectable()
export class AutenticacaoGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwt: JwtService,
    private readonly tenant: TenantContext,
    private readonly usuarios: UsuariosService,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    if (this.reflector.getAllAndOverride<boolean>(CHAVE_PUBLICO, [ctx.getHandler(), ctx.getClass()])) return true;
    const req = ctx.switchToHttp().getRequest<Request & RequisicaoAutenticada>();
    const [tipo, token] = (req.headers.authorization ?? '').split(' ');
    if (tipo !== 'Bearer' || !token) throw naoAutenticado();

    let payload: PayloadAcesso;
    try {
      payload = await this.jwt.verifyAsync<PayloadAcesso>(token, { algorithms: ['HS256'] });
    } catch {
      throw naoAutenticado();
    }

    this.tenant.definirOficina(payload.oficinaId);
    // perfil e "ativo" vêm do banco a cada requisição: desativar ou trocar perfil vale na hora
    const usuario = await this.usuarios.buscarAtivo(payload.sub);
    if (!usuario || !usuario.emailConfirmadoEm) throw naoAutenticado();
    req.usuario = { id: usuario.id, oficinaId: usuario.oficinaId, perfil: usuario.perfil, nome: usuario.nome, email: usuario.email, familiaId: payload.fam };
    return true;
  }
}
```

`src/modules/auth/permissao.guard.ts`:
```ts
import { type CanActivate, type ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { temPermissao, type Permissao } from '@oficinatrack/shared';
import { ErroNegocio } from '../../common/erros/erro-negocio.js';
import { naoAutenticado } from './autenticacao.guard.js';
import { CHAVE_PERMISSOES, type RequisicaoAutenticada } from './decorators.js';

@Injectable()
export class PermissaoGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(ctx: ExecutionContext): boolean {
    const exigidas = this.reflector.getAllAndOverride<Permissao[] | undefined>(CHAVE_PERMISSOES, [ctx.getHandler(), ctx.getClass()]);
    if (!exigidas?.length) return true;
    const usuario = ctx.switchToHttp().getRequest<RequisicaoAutenticada>().usuario;
    if (!usuario) throw naoAutenticado();
    if (!exigidas.every((p) => temPermissao(usuario.perfil, p))) {
      throw new ErroNegocio(403, 'SEM_PERMISSAO', 'Você não tem permissão para esta ação');
    }
    return true;
  }
}
```

`src/modules/auth/limite-tentativas.service.ts`:
```ts
import { Injectable } from '@nestjs/common';
import { ErroNegocio } from '../../common/erros/erro-negocio.js';
import { fatorLimites } from '../../common/seguranca/limites.js';

const MAX_FALHAS = 5;
const JANELA_MS = 15 * 60_000;

/**
 * Falhas de login por identificador (e-mail/telefone normalizado), em memória.
 * Complementa o limite por IP do throttler. Uma instância da API no MVP; com várias,
 * mover para o Postgres ou Redis (registrado no docs/06).
 */
@Injectable()
export class LimiteTentativasService {
  private readonly falhas = new Map<string, { total: number; inicio: number }>();

  verificar(chave: string): void {
    const registro = this.falhas.get(chave);
    if (!registro) return;
    if (Date.now() - registro.inicio > JANELA_MS) {
      this.falhas.delete(chave);
      return;
    }
    if (registro.total >= MAX_FALHAS * fatorLimites()) {
      throw new ErroNegocio(429, 'MUITAS_TENTATIVAS', 'Muitas tentativas. Tente de novo em alguns minutos');
    }
  }

  registrarFalha(chave: string): void {
    const agora = Date.now();
    const registro = this.falhas.get(chave);
    if (!registro || agora - registro.inicio > JANELA_MS) this.falhas.set(chave, { total: 1, inicio: agora });
    else registro.total += 1;
    if (this.falhas.size > 10_000) this.limparVencidos(agora);
  }

  limpar(chave: string): void {
    this.falhas.delete(chave);
  }

  private limparVencidos(agora: number): void {
    for (const [chave, r] of this.falhas) if (agora - r.inicio > JANELA_MS) this.falhas.delete(chave);
  }
}
```

`src/modules/auth/cookie-refresh.ts`:
```ts
import type { Response } from 'express';

export const COOKIE_REFRESH = 'ot_refresh';
const OPCOES = { httpOnly: true, secure: true, sameSite: 'strict' as const, path: '/api/v1/auth' };

export function definirCookieRefresh(res: Response, sessao: { refreshToken: string; refreshExpiraEm: Date }): void {
  res.cookie(COOKIE_REFRESH, sessao.refreshToken, { ...OPCOES, expires: sessao.refreshExpiraEm });
}

export function limparCookieRefresh(res: Response): void {
  res.clearCookie(COOKIE_REFRESH, OPCOES);
}
```

`src/modules/auth/sessoes.service.ts`:
```ts
import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { JwtService } from '@nestjs/jwt';
import type { PerfilUsuario } from '@oficinatrack/shared';
import { ErroNegocio } from '../../common/erros/erro-negocio.js';
import { gerarToken, hashToken } from '../../common/seguranca/tokens.js';
import { TenantContext } from '../../common/tenant/tenant-context.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { USUARIO_DESATIVADO, type UsuarioDesativado } from '../usuarios/eventos.js';
import { UsuariosService } from '../usuarios/usuarios.service.js';
import type { PayloadAcesso } from './autenticacao.guard.js';

const DURACAO_REFRESH_MS = 30 * 24 * 60 * 60 * 1000;
/** Duas abas renovando juntas: o perdedor recebe 401 sem derrubar a família. */
const TOLERANCIA_CONCORRENCIA_MS = 10_000;

export type Sessao = { accessToken: string; refreshToken: string; refreshExpiraEm: Date; familiaId: string };
const sessaoInvalida = () => new ErroNegocio(401, 'SESSAO_INVALIDA', 'Sua sessão expirou. Entre de novo');

@Injectable()
export class SessoesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenant: TenantContext,
    private readonly jwt: JwtService,
    private readonly usuarios: UsuariosService,
  ) {}

  /** Chamar dentro do contexto da oficina do usuário. */
  async criar(usuario: { id: string; oficinaId: string; perfil: PerfilUsuario }, familiaId: string = randomUUID()): Promise<Sessao> {
    const { token, hash } = gerarToken();
    const refreshExpiraEm = new Date(Date.now() + DURACAO_REFRESH_MS);
    await this.prisma.db.refreshToken.create({
      data: { oficinaId: usuario.oficinaId, usuarioId: usuario.id, familiaId, tokenHash: hash, expiraEm: refreshExpiraEm },
    });
    const payload: PayloadAcesso = { sub: usuario.id, oficinaId: usuario.oficinaId, perfil: usuario.perfil, fam: familiaId };
    return { accessToken: await this.jwt.signAsync(payload), refreshToken: token, refreshExpiraEm, familiaId };
  }

  async renovar(refreshToken: string): Promise<Sessao & { usuarioId: string; oficinaId: string }> {
    // sem tenant: o refresh chega só com o cookie; a oficina vem do registro achado pelo hash
    const registro = await this.tenant.executarSemTenant(() =>
      this.prisma.db.refreshToken.findUnique({ where: { tokenHash: hashToken(refreshToken) } }),
    );
    if (!registro) throw sessaoInvalida();

    return this.tenant.executarComo(registro.oficinaId, async () => {
      const agora = Date.now();
      if (registro.substituidoEm) {
        if (agora - registro.substituidoEm.getTime() > TOLERANCIA_CONCORRENCIA_MS) await this.revogarFamilia(registro.familiaId);
        throw sessaoInvalida();
      }
      if (registro.revogadoEm || registro.expiraEm.getTime() <= agora) throw sessaoInvalida();

      const usuario = await this.usuarios.buscarAtivo(registro.usuarioId);
      if (!usuario) {
        await this.revogarFamilia(registro.familiaId);
        throw sessaoInvalida();
      }
      const marcado = await this.prisma.db.refreshToken.updateMany({
        where: { id: registro.id, substituidoEm: null, revogadoEm: null },
        data: { substituidoEm: new Date() },
      });
      if (marcado.count !== 1) throw sessaoInvalida();
      const sessao = await this.criar(usuario, registro.familiaId);
      return { ...sessao, usuarioId: usuario.id, oficinaId: usuario.oficinaId };
    });
  }

  async revogar(refreshToken: string): Promise<void> {
    // sem tenant: logout chega só com o cookie
    const registro = await this.tenant.executarSemTenant(() =>
      this.prisma.db.refreshToken.findUnique({ where: { tokenHash: hashToken(refreshToken) }, select: { oficinaId: true, familiaId: true } }),
    );
    if (!registro) return;
    await this.tenant.executarComo(registro.oficinaId, () => this.revogarFamilia(registro.familiaId));
  }

  /** Chamar dentro do contexto da oficina. */
  async revogarTodasDoUsuario(usuarioId: string, excetoFamilia?: string): Promise<void> {
    await this.prisma.db.refreshToken.updateMany({
      where: { usuarioId, revogadoEm: null, ...(excetoFamilia ? { familiaId: { not: excetoFamilia } } : {}) },
      data: { revogadoEm: new Date() },
    });
  }

  @OnEvent(USUARIO_DESATIVADO, { async: true, promisify: true })
  async aoDesativarUsuario({ oficinaId, usuarioId }: UsuarioDesativado): Promise<void> {
    await this.tenant.executarComo(oficinaId, () => this.revogarTodasDoUsuario(usuarioId));
  }

  private async revogarFamilia(familiaId: string): Promise<void> {
    await this.prisma.db.refreshToken.updateMany({ where: { familiaId, revogadoEm: null }, data: { revogadoEm: new Date() } });
  }
}
```

`src/modules/auth/auth.service.ts` (métodos desta tarefa; Tarefas 5 e 6 acrescentam):
```ts
import { Injectable } from '@nestjs/common';
import { normalizarEmail, normalizarTelefone, PERMISSOES_POR_PERFIL, type Login, type UsuarioEu } from '@oficinatrack/shared';
import { ErroNegocio } from '../../common/erros/erro-negocio.js';
import { verificarSenha } from '../../common/seguranca/senhas.js';
import { TenantContext } from '../../common/tenant/tenant-context.js';
import { OficinasService } from '../oficinas/oficinas.service.js';
import { UsuariosService } from '../usuarios/usuarios.service.js';
import { LimiteTentativasService } from './limite-tentativas.service.js';
import { SessoesService, type Sessao } from './sessoes.service.js';

const credenciaisInvalidas = () => new ErroNegocio(401, 'CREDENCIAIS_INVALIDAS', 'E-mail/telefone ou senha inválidos');

/** E-mail normalizado ou telefone em E.164; o que não for nenhum dos dois vira texto normalizado (não acha ninguém). */
export function normalizarIdentificador(identificador: string): string {
  if (identificador.includes('@')) return normalizarEmail(identificador);
  return normalizarTelefone(identificador) ?? identificador.trim().toLowerCase();
}

@Injectable()
export class AuthService {
  constructor(
    private readonly tenant: TenantContext,
    private readonly usuarios: UsuariosService,
    private readonly oficinas: OficinasService,
    private readonly sessoes: SessoesService,
    private readonly limites: LimiteTentativasService,
  ) {}

  async login({ identificador, senha }: Login): Promise<Sessao & { usuarioId: string; oficinaId: string }> {
    const chave = normalizarIdentificador(identificador);
    this.limites.verificar(chave);
    // sem tenant: o login acontece antes de saber a oficina; e-mail e telefone são únicos no sistema
    const usuario = await this.tenant.executarSemTenant(() => this.usuarios.buscarParaLogin(chave));
    const senhaConfere = await verificarSenha(usuario?.senhaHash, senha);
    if (!usuario || !senhaConfere || !usuario.ativo) {
      this.limites.registrarFalha(chave);
      throw credenciaisInvalidas();
    }
    this.limites.limpar(chave);
    if (!usuario.emailConfirmadoEm) throw new ErroNegocio(403, 'EMAIL_NAO_CONFIRMADO', 'Confirme seu e-mail para entrar');
    const sessao = await this.tenant.executarComo(usuario.oficinaId, () => this.sessoes.criar(usuario));
    return { ...sessao, usuarioId: usuario.id, oficinaId: usuario.oficinaId };
  }

  /** Chamar dentro do contexto da oficina do usuário. */
  async montarEu(usuarioId: string): Promise<UsuarioEu> {
    const usuario = await this.usuarios.buscarPorId(usuarioId);
    if (!usuario) throw credenciaisInvalidas();
    const oficina = await this.oficinas.buscarAtual();
    return {
      id: usuario.id,
      nome: usuario.nome,
      email: usuario.email,
      perfil: usuario.perfil,
      permissoes: [...PERMISSOES_POR_PERFIL[usuario.perfil]],
      oficina: { id: oficina.id, nome: oficina.nome },
    };
  }
}
```

`src/modules/auth/auth.controller.ts` (rotas desta tarefa):
```ts
import { Body, Controller, Get, HttpCode, Post, Req, Res } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { loginSchema, type Login, type RespostaSessao, type UsuarioEu } from '@oficinatrack/shared';
import { ErroNegocio } from '../../common/erros/erro-negocio.js';
import { limite } from '../../common/seguranca/limites.js';
import { TenantContext } from '../../common/tenant/tenant-context.js';
import { ZodValidationPipe } from '../../common/validacao/zod-validation.pipe.js';
import type { Env } from '../../config/env.js';
import { AuthService } from './auth.service.js';
import { COOKIE_REFRESH, definirCookieRefresh, limparCookieRefresh } from './cookie-refresh.js';
import { Publico, UsuarioAtual, type UsuarioAutenticado } from './decorators.js';
import { SessoesService } from './sessoes.service.js';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly sessoes: SessoesService,
    private readonly tenant: TenantContext,
    private readonly config: ConfigService<Env, true>,
  ) {}

  @Publico()
  @Post('login')
  @HttpCode(200)
  @Throttle({ default: { limit: limite(5), ttl: 60_000 } })
  async login(@Body(new ZodValidationPipe(loginSchema)) dados: Login, @Res({ passthrough: true }) res: Response): Promise<RespostaSessao> {
    const sessao = await this.auth.login(dados);
    definirCookieRefresh(res, sessao);
    return this.resposta(sessao);
  }

  @Publico()
  @Post('refresh')
  @HttpCode(200)
  @Throttle({ default: { limit: limite(30), ttl: 60_000 } })
  async refresh(@Req() req: Request, @Res({ passthrough: true }) res: Response): Promise<RespostaSessao> {
    this.exigirOrigem(req);
    const token = req.cookies?.[COOKIE_REFRESH] as string | undefined;
    if (!token) throw new ErroNegocio(401, 'SESSAO_INVALIDA', 'Sua sessão expirou. Entre de novo');
    try {
      const sessao = await this.sessoes.renovar(token);
      definirCookieRefresh(res, sessao);
      return await this.resposta(sessao);
    } catch (erro) {
      limparCookieRefresh(res);
      throw erro;
    }
  }

  @Publico()
  @Post('logout')
  @HttpCode(204)
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response): Promise<void> {
    this.exigirOrigem(req);
    const token = req.cookies?.[COOKIE_REFRESH] as string | undefined;
    if (token) await this.sessoes.revogar(token);
    limparCookieRefresh(res);
  }

  @Get('eu')
  eu(@UsuarioAtual() usuario: UsuarioAutenticado): Promise<UsuarioEu> {
    return this.auth.montarEu(usuario.id);
  }

  private async resposta(sessao: { accessToken: string; usuarioId: string; oficinaId: string }): Promise<RespostaSessao> {
    const usuario = await this.tenant.executarComo(sessao.oficinaId, () => this.auth.montarEu(sessao.usuarioId));
    return { accessToken: sessao.accessToken, usuario };
  }

  /** Rotas que agem pelo cookie conferem a origem (defesa extra além do SameSite=Strict). */
  private exigirOrigem(req: Request): void {
    if (req.headers.origin !== this.config.get('CORS_ORIGEM', { infer: true })) {
      throw new ErroNegocio(403, 'SEM_PERMISSAO', 'Origem não permitida');
    }
  }
}
```

`src/modules/auth/auth.module.ts`:
```ts
import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import type { Env } from '../../config/env.js';
import { OficinasModule } from '../oficinas/oficinas.module.js';
import { UsuariosModule } from '../usuarios/usuarios.module.js';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import { AutenticacaoGuard } from './autenticacao.guard.js';
import { LimiteTentativasService } from './limite-tentativas.service.js';
import { PermissaoGuard } from './permissao.guard.js';
import { SessoesService } from './sessoes.service.js';

@Module({
  imports: [
    UsuariosModule,
    OficinasModule,
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>) => ({
        secret: config.get('JWT_SEGREDO', { infer: true }),
        signOptions: { expiresIn: '15m', algorithm: 'HS256' },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    SessoesService,
    LimiteTentativasService,
    { provide: APP_GUARD, useClass: AutenticacaoGuard },
    { provide: APP_GUARD, useClass: PermissaoGuard },
  ],
  exports: [SessoesService, AuthService],
})
export class AuthModule {}
```
No `AppModule`: importar `AuthModule`, `OficinasModule`, `UsuariosModule`. Marcar `SaudeController` com `@Publico()`.

- [ ] **Passo 5: verificar e commitar**

```bash
pnpm --filter @oficinatrack/api test && pnpm --filter @oficinatrack/api typecheck && pnpm lint
git add apps/api
git commit -m "feat(auth): login, sessao com refresh rotativo, guards de autenticacao e permissao"
```

---

### Tarefa 5: Cadastro com código de piloto e confirmação de e-mail

Agent: `backend-nest`.

**Arquivos:** criar `src/modules/auth/{tokens-usuario.service.ts,codigos-piloto.service.ts,cadastro.service.ts}`, `src/scripts/codigo-piloto.ts`; modificar `auth.controller.ts`, `auth.module.ts`, `apps/api/package.json` (script), `CLAUDE.md` (comando); criar `test/auth/cadastro.e2e-spec.ts`.

**Interfaces:**
- Produz:
  - `TokensUsuarioService`: `criar(db, usuario: { id; oficinaId }, tipo: TipoTokenUsuario): Promise<string>` (invalida os anteriores não usados do mesmo tipo, devolve o token em claro), `consumir(token: string, tipo): Promise<{ usuarioId: string; oficinaId: string }>` (chamar sem contexto; lança `TOKEN_INVALIDO`)
  - `CodigosPilotoService`: `gerar(descricao: string, validadeDias = 30): Promise<string>`, `consumir(tx, codigo: string, oficinaId: string): Promise<void>` (lança `CODIGO_PILOTO_INVALIDO`)
  - `CadastroService`: `cadastrar(dados: Cadastro): Promise<void>`, `confirmarEmail(token): Promise<Sessao & { usuarioId; oficinaId }>`, `reenviarConfirmacao(email): Promise<void>`
  - Endpoints: `POST /auth/cadastro` (201 `{ mensagem }`), `POST /auth/confirmar-email` (200 `RespostaSessao` + cookie), `POST /auth/reenviar-confirmacao` (200 `{ mensagem }`)
  - Links: `${URL_APP}/confirmar-email#<token>` (token no fragmento: não vai para servidor nem para `Referer`)
  - Script: `pnpm --filter @oficinatrack/api codigo-piloto "<descrição>"`

- [ ] **Passo 1: testes e2e (falhando)**

`test/auth/cadastro.e2e-spec.ts`:
```ts
import { CodigosPilotoService } from '../../src/modules/auth/codigos-piloto.service.js';
import { cookieRefresh, criarApp, ORIGEM, sufixo, telefone, type App } from './apoio-auth.js';

const tokenDoLink = (texto: string) => /#([A-Za-z0-9_-]{43})/.exec(texto)?.[1];

describe('Cadastro e confirmação de e-mail', () => {
  let ctx: App;
  let codigos: CodigosPilotoService;
  beforeAll(async () => { ctx = await criarApp(); codigos = ctx.app.get(CodigosPilotoService); });
  afterAll(() => ctx.app.close());

  const dados = (codigoPiloto: string, email = `dono-${sufixo()}@teste.local`) => ({
    codigoPiloto,
    oficina: { nome: 'Oficina do Zé', telefone: telefone(), cidade: 'Ribeirão do Pinhal', uf: 'PR' },
    dono: { nome: 'José', email, senha: 'motor-v8-turbo' },
    aceiteTermos: true,
  });

  it('fluxo completo: cadastro → e-mail → confirmar → sessão', async () => {
    const codigo = await codigos.gerar('teste');
    const email = `Dono-${sufixo()}@Teste.Local`;
    await ctx.http.post('/api/v1/auth/cadastro').send(dados(codigo, email)).expect(201);

    // antes de confirmar, o login é recusado com EMAIL_NAO_CONFIRMADO
    const antes = await ctx.http.post('/api/v1/auth/login').send({ identificador: email, senha: 'motor-v8-turbo' }).expect(403);
    expect(antes.body.code).toBe('EMAIL_NAO_CONFIRMADO');

    const mensagem = ctx.emails.ultimoPara(email.toLowerCase());
    expect(mensagem?.assunto).toBe('Confirme seu e-mail no OficinaTrack');
    const token = tokenDoLink(mensagem!.texto)!;
    expect(mensagem!.texto).toContain(`http://localhost:5173/confirmar-email#${token}`);

    const r = await ctx.http.post('/api/v1/auth/confirmar-email').set('Origin', ORIGEM).send({ token }).expect(200);
    expect(r.body.usuario).toMatchObject({ perfil: 'DONO', email: email.toLowerCase(), oficina: { nome: 'Oficina do Zé' } });
    expect(cookieRefresh(r)).toMatch(/^ot_refresh=/);

    // token de uso único
    const reuso = await ctx.http.post('/api/v1/auth/confirmar-email').set('Origin', ORIGEM).send({ token }).expect(400);
    expect(reuso.body.code).toBe('TOKEN_INVALIDO');
  });

  it('código de piloto é de uso único', async () => {
    const codigo = await codigos.gerar('teste');
    await ctx.http.post('/api/v1/auth/cadastro').send(dados(codigo)).expect(201);
    const r = await ctx.http.post('/api/v1/auth/cadastro').send(dados(codigo)).expect(400);
    expect(r.body.code).toBe('CODIGO_PILOTO_INVALIDO');
  });

  it('código inexistente → 400 e nada é criado', async () => {
    const email = `nada-${sufixo()}@teste.local`;
    await ctx.http.post('/api/v1/auth/cadastro').send(dados('XXXX-XXXX-XXXX', email)).expect(400);
    // sem tenant: conferência global de que o e-mail não virou conta
    const total = await ctx.tenant.executarSemTenant(() => ctx.prisma.db.usuario.count({ where: { email } }));
    expect(total).toBe(0);
  });

  it('e-mail já cadastrado → 409 e o código NÃO é consumido', async () => {
    const email = `repetido-${sufixo()}@teste.local`;
    await ctx.http.post('/api/v1/auth/cadastro').send(dados(await codigos.gerar('a'), email)).expect(201);
    const codigo = await codigos.gerar('b');
    const r = await ctx.http.post('/api/v1/auth/cadastro').send(dados(codigo, email)).expect(409);
    expect(r.body.code).toBe('EMAIL_JA_CADASTRADO');
    await ctx.http.post('/api/v1/auth/cadastro').send(dados(codigo)).expect(201);
  });

  it('reenviar confirmação invalida o link anterior e responde igual para e-mail desconhecido', async () => {
    const email = `reenvio-${sufixo()}@teste.local`;
    await ctx.http.post('/api/v1/auth/cadastro').send(dados(await codigos.gerar('c'), email)).expect(201);
    const primeiro = tokenDoLink(ctx.emails.ultimoPara(email)!.texto)!;
    const r1 = await ctx.http.post('/api/v1/auth/reenviar-confirmacao').send({ email }).expect(200);
    const r2 = await ctx.http.post('/api/v1/auth/reenviar-confirmacao').send({ email: `ninguem-${sufixo()}@teste.local` }).expect(200);
    expect(r1.body).toEqual(r2.body);
    const segundo = tokenDoLink(ctx.emails.ultimoPara(email)!.texto)!;
    expect(segundo).not.toBe(primeiro);
    await ctx.http.post('/api/v1/auth/confirmar-email').set('Origin', ORIGEM).send({ token: primeiro }).expect(400);
    await ctx.http.post('/api/v1/auth/confirmar-email').set('Origin', ORIGEM).send({ token: segundo }).expect(200);
  });

  it('senha comum e termos não aceitos são recusados pelo schema', async () => {
    const codigo = await codigos.gerar('d');
    const base = dados(codigo);
    await ctx.http.post('/api/v1/auth/cadastro').send({ ...base, dono: { ...base.dono, senha: '12345678' } }).expect(400);
    await ctx.http.post('/api/v1/auth/cadastro').send({ ...base, aceiteTermos: false }).expect(400);
  });
});
```

- [ ] **Passo 2: implementação**

`tokens-usuario.service.ts`:
```ts
import { Injectable } from '@nestjs/common';
import { ErroNegocio } from '../../common/erros/erro-negocio.js';
import { gerarToken, hashToken } from '../../common/seguranca/tokens.js';
import { TenantContext } from '../../common/tenant/tenant-context.js';
import type { TipoTokenUsuario } from '../../generated/prisma/client.js';
import { PrismaService, type Db, type Tx } from '../../prisma/prisma.service.js';

const VALIDADE_MS: Record<TipoTokenUsuario, number> = {
  CONFIRMAR_EMAIL: 24 * 60 * 60 * 1000,
  REDEFINIR_SENHA: 60 * 60 * 1000,
};
export const tokenInvalido = () => new ErroNegocio(400, 'TOKEN_INVALIDO', 'Link inválido ou expirado. Peça um novo');

@Injectable()
export class TokensUsuarioService {
  constructor(private readonly prisma: PrismaService, private readonly tenant: TenantContext) {}

  /** Invalida os tokens anteriores do mesmo tipo e cria um novo. Devolve o token em claro (vai só no e-mail). */
  async criar(db: Db | Tx, usuario: { id: string; oficinaId: string }, tipo: TipoTokenUsuario): Promise<string> {
    await db.tokenUsuario.updateMany({ where: { usuarioId: usuario.id, tipo, usadoEm: null }, data: { usadoEm: new Date() } });
    const { token, hash } = gerarToken();
    await db.tokenUsuario.create({
      data: { oficinaId: usuario.oficinaId, usuarioId: usuario.id, tipo, tokenHash: hash, expiraEm: new Date(Date.now() + VALIDADE_MS[tipo]) },
    });
    return token;
  }

  /** Mesmo erro para inexistente, expirado, usado ou de outro tipo. */
  async consumir(token: string, tipo: TipoTokenUsuario): Promise<{ usuarioId: string; oficinaId: string }> {
    // sem tenant: o link chega só com o token; a oficina vem do registro achado pelo hash
    const registro = await this.tenant.executarSemTenant(() =>
      this.prisma.db.tokenUsuario.findUnique({ where: { tokenHash: hashToken(token) } }),
    );
    if (!registro || registro.tipo !== tipo || registro.usadoEm || registro.expiraEm.getTime() <= Date.now()) throw tokenInvalido();
    const marcado = await this.tenant.executarComo(registro.oficinaId, () =>
      this.prisma.db.tokenUsuario.updateMany({ where: { id: registro.id, usadoEm: null }, data: { usadoEm: new Date() } }),
    );
    if (marcado.count !== 1) throw tokenInvalido();
    return { usuarioId: registro.usuarioId, oficinaId: registro.oficinaId };
  }
}
```

`codigos-piloto.service.ts`:
```ts
import { randomInt } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { ErroNegocio } from '../../common/erros/erro-negocio.js';
import { hashToken } from '../../common/seguranca/tokens.js';
import { TenantContext } from '../../common/tenant/tenant-context.js';
import { PrismaService, type Tx } from '../../prisma/prisma.service.js';

// sem 0/O, 1/I/L: o código é digitado à mão pelo dono
const ALFABETO = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const normalizar = (codigo: string) => codigo.toUpperCase().replace(/[^A-Z0-9]/g, '');
const invalido = () => new ErroNegocio(400, 'CODIGO_PILOTO_INVALIDO', 'Código de acesso inválido ou já usado');

@Injectable()
export class CodigosPilotoService {
  constructor(private readonly prisma: PrismaService, private readonly tenant: TenantContext) {}

  /** Gera um código no formato XXXX-XXXX-XXXX; o banco guarda só o hash. */
  async gerar(descricao: string, validadeDias = 30): Promise<string> {
    const bruto = Array.from({ length: 12 }, () => ALFABETO[randomInt(ALFABETO.length)]).join('');
    const codigo = `${bruto.slice(0, 4)}-${bruto.slice(4, 8)}-${bruto.slice(8)}`;
    // sem tenant: CodigoPiloto é global (do administrador), não pertence a uma oficina
    await this.tenant.executarSemTenant(() =>
      this.prisma.db.codigoPiloto.create({
        data: { codigoHash: hashToken(bruto), descricao, expiraEm: new Date(Date.now() + validadeDias * 86_400_000) },
      }),
    );
    return codigo;
  }

  /** Dentro da transação do cadastro (sem tenant). Atômico: dois cadastros com o mesmo código não passam. */
  async consumir(tx: Tx, codigo: string | undefined, oficinaId: string): Promise<void> {
    if (!codigo) throw invalido();
    const marcado = await tx.codigoPiloto.updateMany({
      where: { codigoHash: hashToken(normalizar(codigo)), usadoEm: null, expiraEm: { gt: new Date() } },
      data: { usadoEm: new Date(), oficinaId },
    });
    if (marcado.count !== 1) throw invalido();
  }
}
```

`cadastro.service.ts`:
```ts
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Cadastro } from '@oficinatrack/shared';
import { ErroNegocio } from '../../common/erros/erro-negocio.js';
import { hashSenha } from '../../common/seguranca/senhas.js';
import { TenantContext } from '../../common/tenant/tenant-context.js';
import type { Env } from '../../config/env.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { EnvioEmail } from '../notificacoes/envio-email.js';
import { modelosEmail } from '../notificacoes/modelos-email.js';
import { OficinasService } from '../oficinas/oficinas.service.js';
import { UsuariosService } from '../usuarios/usuarios.service.js';
import { CodigosPilotoService } from './codigos-piloto.service.js';
import { SessoesService } from './sessoes.service.js';
import { TokensUsuarioService } from './tokens-usuario.service.js';

@Injectable()
export class CadastroService {
  private readonly logger = new Logger(CadastroService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly tenant: TenantContext,
    private readonly config: ConfigService<Env, true>,
    private readonly oficinas: OficinasService,
    private readonly usuarios: UsuariosService,
    private readonly codigos: CodigosPilotoService,
    private readonly tokens: TokensUsuarioService,
    private readonly sessoes: SessoesService,
    private readonly email: EnvioEmail,
  ) {}

  async cadastrar(dados: Cadastro): Promise<void> {
    const senhaHash = await hashSenha(dados.dono.senha);
    const exigeCodigo = this.config.get('CADASTRO_EXIGE_CODIGO', { infer: true });
    // sem tenant: a oficina ainda não existe; tudo numa transação (código, oficina, dono, token)
    const { usuario, token } = await this.tenant.executarSemTenant(() =>
      this.prisma.db.$transaction(async (tx) => {
        const oficina = await this.oficinas.criar(tx, dados.oficina);
        // o código é conferido antes do e-mail: sem código válido, ninguém descobre se um e-mail tem conta
        if (exigeCodigo) await this.codigos.consumir(tx, dados.codigoPiloto, oficina.id);
        if (await this.usuarios.emailEmUso(dados.dono.email, tx)) {
          throw new ErroNegocio(409, 'EMAIL_JA_CADASTRADO', 'Este e-mail já tem uma conta. Entre ou recupere a senha');
        }
        const usuario = await this.usuarios.criarDono(tx, { oficinaId: oficina.id, nome: dados.dono.nome, email: dados.dono.email, senhaHash });
        const token = await this.tokens.criar(tx, usuario, 'CONFIRMAR_EMAIL');
        return { usuario, token };
      }),
    );
    await this.enviarConfirmacao(usuario, token);
  }

  async confirmarEmail(token: string) {
    const { usuarioId, oficinaId } = await this.tokens.consumir(token, 'CONFIRMAR_EMAIL');
    return this.tenant.executarComo(oficinaId, async () => {
      await this.usuarios.marcarEmailConfirmado(usuarioId);
      const usuario = await this.usuarios.buscarAtivo(usuarioId);
      if (!usuario) throw new ErroNegocio(400, 'TOKEN_INVALIDO', 'Link inválido ou expirado. Peça um novo');
      const sessao = await this.sessoes.criar(usuario);
      return { ...sessao, usuarioId: usuario.id, oficinaId };
    });
  }

  /** Resposta idêntica exista ou não a conta; envio sem `await` para o tempo não revelar nada. */
  async reenviarConfirmacao(email: string): Promise<void> {
    // sem tenant: a busca é pelo e-mail, único no sistema, antes de saber a oficina
    const usuario = await this.tenant.executarSemTenant(() => this.usuarios.buscarParaLogin(email));
    if (!usuario || usuario.emailConfirmadoEm || !usuario.ativo) return;
    const token = await this.tenant.executarComo(usuario.oficinaId, () => this.tokens.criar(this.prisma.db, usuario, 'CONFIRMAR_EMAIL'));
    void this.enviarConfirmacao(usuario, token);
  }

  private async enviarConfirmacao(usuario: { nome: string; email: string }, token: string): Promise<void> {
    const link = `${this.config.get('URL_APP', { infer: true })}/confirmar-email#${token}`;
    try {
      await this.email.enviar({ para: usuario.email, ...modelosEmail.confirmarEmail({ nome: usuario.nome, link }) });
    } catch (erro) {
      this.logger.error(`Falha ao enviar e-mail de confirmação: ${(erro as Error).name}`);
    }
  }
}
```
Atenção à ordem: criar a oficina antes de consumir o código é necessário porque o código guarda `oficinaId`; como tudo está na mesma transação, um código inválido desfaz a oficina.

No `AuthController`:
```ts
@Publico()
@Post('cadastro')
@Throttle({ default: { limit: limite(5), ttl: 3_600_000 } })
async cadastro(@Body(new ZodValidationPipe(cadastroSchema)) dados: Cadastro) {
  await this.cadastroService.cadastrar(dados);
  return { mensagem: 'Enviamos um link de confirmação para o seu e-mail' };
}

@Publico()
@Post('confirmar-email')
@HttpCode(200)
@Throttle({ default: { limit: limite(10), ttl: 60_000 } })
async confirmarEmail(@Body(new ZodValidationPipe(tokenApenasSchema)) { token }: { token: string }, @Res({ passthrough: true }) res: Response): Promise<RespostaSessao> {
  const sessao = await this.cadastroService.confirmarEmail(token);
  definirCookieRefresh(res, sessao);
  return this.resposta(sessao);
}

@Publico()
@Post('reenviar-confirmacao')
@HttpCode(200)
@Throttle({ default: { limit: limite(3), ttl: 3_600_000 } })
async reenviarConfirmacao(@Body(new ZodValidationPipe(emailApenasSchema)) { email }: { email: string }) {
  await this.cadastroService.reenviarConfirmacao(email);
  return { mensagem: 'Se houver uma conta aguardando confirmação com este e-mail, enviamos um novo link' };
}
```
Registrar `CadastroService`, `TokensUsuarioService`, `CodigosPilotoService` no `AuthModule` (exportar `TokensUsuarioService` e `CodigosPilotoService`).

`src/scripts/codigo-piloto.ts`:
```ts
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module.js';
import { CodigosPilotoService } from '../modules/auth/codigos-piloto.service.js';

const descricao = process.argv.slice(2).join(' ').trim();
if (!descricao) {
  process.stderr.write('Uso: pnpm --filter @oficinatrack/api codigo-piloto "Oficina do Zé - Ribeirão do Pinhal"\n');
  process.exit(1);
}
const app = await NestFactory.createApplicationContext(AppModule, { logger: new Logger() });
try {
  const codigo = await app.get(CodigosPilotoService).gerar(descricao);
  // saída única do código em claro: o banco guarda só o hash
  process.stdout.write(`Código de piloto para "${descricao}": ${codigo}\nVálido por 30 dias, uso único.\n`);
} finally {
  await app.close();
}
```
`package.json` da API: `"codigo-piloto": "tsx src/scripts/codigo-piloto.ts"`. Se `tsx` não lidar com os decorators do Nest, usar `nest build` + `node dist/scripts/codigo-piloto.js` e registrar. O teste `regras-proibidas.spec.ts` proíbe `console.log`; por isso `process.stdout.write`.

- [ ] **Passo 3: verificar e commitar**

```bash
pnpm --filter @oficinatrack/api test && pnpm --filter @oficinatrack/api typecheck && pnpm lint
pnpm --filter @oficinatrack/api codigo-piloto "Teste manual"   # confere que imprime um código
git add apps/api CLAUDE.md
git commit -m "feat(auth): cadastro com codigo de piloto e confirmacao de e-mail"
```

---

### Tarefa 6: Senha — esqueci, redefinir e trocar

Agent: `backend-nest`.

**Arquivos:** modificar `auth.service.ts`, `auth.controller.ts`; criar `test/auth/senha.e2e-spec.ts`.

**Interfaces (produz):** `AuthService.esqueciSenha(email)`, `AuthService.redefinirSenha(token, senha)`, `AuthService.trocarSenha(usuario: UsuarioAutenticado, senhaAtual, novaSenha)`; endpoints `POST /auth/esqueci-senha` (200 `{ mensagem }`), `POST /auth/redefinir-senha` (200 `{ mensagem }`), `PATCH /auth/senha` (204). Link: `${URL_APP}/redefinir-senha#<token>`.

- [ ] **Passo 1: testes e2e (falhando)**

`test/auth/senha.e2e-spec.ts`:
```ts
import { criarApp, criarOficinaComUsuario, criarUsuarioNa, entrar, ORIGEM, SENHA, sufixo, type App } from './apoio-auth.js';

const tokenDoLink = (texto: string) => /#([A-Za-z0-9_-]{43})/.exec(texto)?.[1];

describe('Senha', () => {
  let ctx: App;
  beforeAll(async () => { ctx = await criarApp(); });
  afterAll(() => ctx.app.close());

  it('esqueci a senha responde igual para e-mail existente e inexistente', async () => {
    const { usuario } = await criarOficinaComUsuario(ctx);
    const [existe, naoExiste] = await Promise.all([
      ctx.http.post('/api/v1/auth/esqueci-senha').send({ email: usuario.email }),
      ctx.http.post('/api/v1/auth/esqueci-senha').send({ email: `ninguem-${sufixo()}@teste.local` }),
    ]);
    expect(existe.status).toBe(200);
    expect(existe.body).toEqual(naoExiste.body);
  });

  it('redefinir troca a senha, derruba todas as sessões e o link é de uso único', async () => {
    const { usuario } = await criarOficinaComUsuario(ctx);
    const { cookie } = await entrar(ctx, usuario.email);
    await ctx.http.post('/api/v1/auth/esqueci-senha').send({ email: usuario.email.toUpperCase() }).expect(200);
    const mensagem = ctx.emails.ultimoPara(usuario.email)!;
    expect(mensagem.texto).toContain('/redefinir-senha#');
    const token = tokenDoLink(mensagem.texto)!;

    await ctx.http.post('/api/v1/auth/redefinir-senha').send({ token, senha: 'nova-senha-do-ze' }).expect(200);
    await ctx.http.post('/api/v1/auth/refresh').set('Origin', ORIGEM).set('Cookie', cookie).expect(401);
    await ctx.http.post('/api/v1/auth/login').send({ identificador: usuario.email, senha: SENHA }).expect(401);
    await entrar(ctx, usuario.email, 'nova-senha-do-ze');
    const reuso = await ctx.http.post('/api/v1/auth/redefinir-senha').send({ token, senha: 'outra-senha-boa' }).expect(400);
    expect(reuso.body.code).toBe('TOKEN_INVALIDO');
  });

  it('redefinir com token de confirmação de e-mail não funciona (tipo errado)', async () => {
    const { usuario } = await criarOficinaComUsuario(ctx);
    const tokens = ctx.app.get((await import('../../src/modules/auth/tokens-usuario.service.js')).TokensUsuarioService);
    const token = await ctx.tenant.executarComo(usuario.oficinaId, () => tokens.criar(ctx.prisma.db, usuario, 'CONFIRMAR_EMAIL'));
    await ctx.http.post('/api/v1/auth/redefinir-senha').send({ token, senha: 'nova-senha-do-ze' }).expect(400);
  });

  it('trocar senha exige a atual e derruba só os outros aparelhos', async () => {
    const { oficina } = await criarOficinaComUsuario(ctx);
    const func = await criarUsuarioNa(ctx, oficina.id, 'FUNCIONARIO');
    const celular = await entrar(ctx, func.email);
    const computador = await entrar(ctx, func.email);

    const errada = await ctx.http.patch('/api/v1/auth/senha').set('Authorization', `Bearer ${celular.accessToken}`).send({ senhaAtual: 'nao-e-essa', novaSenha: 'nova-senha-do-ze' }).expect(400);
    expect(errada.body.code).toBe('SENHA_ATUAL_INCORRETA');

    await ctx.http.patch('/api/v1/auth/senha').set('Authorization', `Bearer ${celular.accessToken}`).send({ senhaAtual: SENHA, novaSenha: 'nova-senha-do-ze' }).expect(204);
    await ctx.http.post('/api/v1/auth/refresh').set('Origin', ORIGEM).set('Cookie', computador.cookie).expect(401);
    await ctx.http.post('/api/v1/auth/refresh').set('Origin', ORIGEM).set('Cookie', celular.cookie).expect(200);
  });

  it('e-mail de usuário inativo não recebe link', async () => {
    const { oficina } = await criarOficinaComUsuario(ctx);
    const inativo = await criarUsuarioNa(ctx, oficina.id, 'FUNCIONARIO', { ativo: false });
    await ctx.http.post('/api/v1/auth/esqueci-senha').send({ email: inativo.email }).expect(200);
    expect(ctx.emails.ultimoPara(inativo.email)).toBeUndefined();
  });
});
```

- [ ] **Passo 2: implementação**

Em `AuthService` (injetar `TokensUsuarioService`, `EnvioEmail`, `ConfigService`, `PrismaService`):
```ts
async esqueciSenha(email: string): Promise<void> {
  // sem tenant: a busca é pelo e-mail, único no sistema, antes de saber a oficina
  const usuario = await this.tenant.executarSemTenant(() => this.usuarios.buscarParaLogin(email));
  if (!usuario || !usuario.ativo) return;
  const token = await this.tenant.executarComo(usuario.oficinaId, () => this.tokens.criar(this.prisma.db, usuario, 'REDEFINIR_SENHA'));
  const link = `${this.config.get('URL_APP', { infer: true })}/redefinir-senha#${token}`;
  // sem await: o tempo de resposta não pode revelar se a conta existe
  void this.email
    .enviar({ para: usuario.email, ...modelosEmail.redefinirSenha({ nome: usuario.nome, link }) })
    .catch((erro: Error) => this.logger.error(`Falha ao enviar e-mail de redefinição: ${erro.name}`));
}

async redefinirSenha(token: string, senha: string): Promise<void> {
  const { usuarioId, oficinaId } = await this.tokens.consumir(token, 'REDEFINIR_SENHA');
  const senhaHash = await hashSenha(senha);
  await this.tenant.executarComo(oficinaId, async () => {
    await this.usuarios.atualizarSenha(usuarioId, senhaHash);
    await this.usuarios.marcarEmailConfirmado(usuarioId); // o link provou a posse do e-mail
    await this.sessoes.revogarTodasDoUsuario(usuarioId);
  });
}

/** Dentro da requisição autenticada (contexto já definido pelo guard). */
async trocarSenha(usuario: UsuarioAutenticado, senhaAtual: string, novaSenha: string): Promise<void> {
  const atual = await this.usuarios.buscarSenhaHash(usuario.id);
  if (!(await verificarSenha(atual?.senhaHash, senhaAtual))) {
    throw new ErroNegocio(400, 'SENHA_ATUAL_INCORRETA', 'A senha atual não confere');
  }
  await this.usuarios.atualizarSenha(usuario.id, await hashSenha(novaSenha));
  await this.sessoes.revogarTodasDoUsuario(usuario.id, usuario.familiaId);
}
```
No controller:
```ts
@Publico()
@Post('esqueci-senha')
@HttpCode(200)
@Throttle({ default: { limit: limite(3), ttl: 3_600_000 } })
async esqueciSenha(@Body(new ZodValidationPipe(emailApenasSchema)) { email }: { email: string }) {
  await this.auth.esqueciSenha(email);
  return { mensagem: 'Se houver uma conta com este e-mail, enviamos um link para criar uma nova senha' };
}

@Publico()
@Post('redefinir-senha')
@HttpCode(200)
@Throttle({ default: { limit: limite(10), ttl: 60_000 } })
async redefinirSenha(@Body(new ZodValidationPipe(redefinirSenhaSchema)) { token, senha }: { token: string; senha: string }) {
  await this.auth.redefinirSenha(token, senha);
  return { mensagem: 'Senha alterada. Entre com a nova senha' };
}

@Patch('senha')
@HttpCode(204)
async trocarSenha(@UsuarioAtual() usuario: UsuarioAutenticado, @Body(new ZodValidationPipe(trocarSenhaSchema)) d: { senhaAtual: string; novaSenha: string }): Promise<void> {
  await this.auth.trocarSenha(usuario, d.senhaAtual, d.novaSenha);
}
```
O access token dos outros aparelhos continua válido por até 15 min após a troca (o refresh já foi revogado); registrar em `docs/06-seguranca.md`.

- [ ] **Passo 3: verificar e commitar**

```bash
pnpm --filter @oficinatrack/api test && pnpm --filter @oficinatrack/api typecheck && pnpm lint
git add apps/api
git commit -m "feat(auth): esqueci, redefinir e trocar senha"
```

---

### Tarefa 7: Oficina e equipe

Agent: `backend-nest`.

**Arquivos:** criar `src/modules/oficinas/oficinas.controller.ts`, `src/modules/usuarios/usuarios.controller.ts`; modificar `usuarios.service.ts`, módulos; criar `test/auth/equipe.e2e-spec.ts`.

**Interfaces (produz):** `GET /oficinas/atual` (logado) → `DadosOficina`; `PATCH /oficinas/atual` (`OFICINA_EDITAR`, body `oficinaDadosSchema`) → `DadosOficina`; `GET /usuarios` (`EQUIPE_GERENCIAR`) → `MembroEquipe[]` ordenado por nome; `PATCH /usuarios/:id` (`EQUIPE_GERENCIAR`, body `alterarUsuarioSchema`) → `MembroEquipe`. `UsuariosService.listar()`, `UsuariosService.alterar(id, dados, ator: UsuarioAutenticado)`.

- [ ] **Passo 1: testes e2e (falhando)**

`test/auth/equipe.e2e-spec.ts`:
```ts
import { UsuariosService } from '../../src/modules/usuarios/usuarios.service.js';
import { criarApp, criarOficinaComUsuario, criarUsuarioNa, entrar, ORIGEM, type App } from './apoio-auth.js';

describe('Oficina e equipe', () => {
  let ctx: App;
  beforeAll(async () => { ctx = await criarApp(); });
  afterAll(() => ctx.app.close());
  const auth = (t: string) => ({ Authorization: `Bearer ${t}` });

  it('DONO edita a oficina; FUNCIONARIO recebe 403', async () => {
    const { oficina, usuario: dono } = await criarOficinaComUsuario(ctx);
    const func = await criarUsuarioNa(ctx, oficina.id, 'FUNCIONARIO');
    const d = await entrar(ctx, dono.email);
    const f = await entrar(ctx, func.email);
    const r = await ctx.http.patch('/api/v1/oficinas/atual').set(auth(d.accessToken)).send({ nome: 'Oficina Nova', telefone: '43988887777', uf: 'PR', documento: '' }).expect(200);
    expect(r.body).toMatchObject({ id: oficina.id, nome: 'Oficina Nova', telefone: '+5543988887777', documento: null });
    await ctx.http.get('/api/v1/oficinas/atual').set(auth(f.accessToken)).expect(200);
    const negado = await ctx.http.patch('/api/v1/oficinas/atual').set(auth(f.accessToken)).send({ nome: 'x', telefone: '43988887777' }).expect(403);
    expect(negado.body.code).toBe('SEM_PERMISSAO');
    await ctx.http.get('/api/v1/usuarios').set(auth(f.accessToken)).expect(403);
  });

  it('isolamento: dono de A não vê nem altera usuário de B (404)', async () => {
    const a = await criarOficinaComUsuario(ctx);
    const b = await criarOficinaComUsuario(ctx);
    const funcB = await criarUsuarioNa(ctx, b.oficina.id, 'FUNCIONARIO');
    const donoA = await entrar(ctx, a.usuario.email);
    const lista = await ctx.http.get('/api/v1/usuarios').set(auth(donoA.accessToken)).expect(200);
    expect(lista.body.map((u: { id: string }) => u.id)).toEqual([a.usuario.id]);
    await ctx.http.patch(`/api/v1/usuarios/${funcB.id}`).set(auth(donoA.accessToken)).send({ ativo: false }).expect(404);
    const intacto = await ctx.tenant.executarComo(b.oficina.id, () => ctx.prisma.db.usuario.findUnique({ where: { id: funcB.id } }));
    expect(intacto?.ativo).toBe(true);
    expect(lista.body[0]).not.toHaveProperty('senhaHash');
  });

  it('desativar derruba acesso e sessão na hora; reativar devolve o login (Review Focus 4)', async () => {
    const { oficina, usuario: dono } = await criarOficinaComUsuario(ctx);
    const func = await criarUsuarioNa(ctx, oficina.id, 'FUNCIONARIO');
    const d = await entrar(ctx, dono.email);
    const f = await entrar(ctx, func.email);
    await ctx.http.patch(`/api/v1/usuarios/${func.id}`).set(auth(d.accessToken)).send({ ativo: false }).expect(200);
    await ctx.http.get('/api/v1/auth/eu').set(auth(f.accessToken)).expect(401);
    await ctx.http.post('/api/v1/auth/refresh').set('Origin', ORIGEM).set('Cookie', f.cookie).expect(401);
    await ctx.http.patch(`/api/v1/usuarios/${func.id}`).set(auth(d.accessToken)).send({ ativo: true }).expect(200);
    await entrar(ctx, func.email);
  });

  it('não pode alterar a si mesmo nem deixar a oficina sem DONO ativo (Review Focus 5)', async () => {
    const { oficina, usuario: dono1 } = await criarOficinaComUsuario(ctx);
    const dono2 = await criarUsuarioNa(ctx, oficina.id, 'DONO');
    const d1 = await entrar(ctx, dono1.email);
    const si = await ctx.http.patch(`/api/v1/usuarios/${dono1.id}`).set(auth(d1.accessToken)).send({ perfil: 'FUNCIONARIO' }).expect(422);
    expect(si.body.code).toBe('ACAO_NAO_PERMITIDA_EM_SI_MESMO');
    // rebaixar o dono2 é permitido (dono1 continua DONO)
    await ctx.http.patch(`/api/v1/usuarios/${dono2.id}`).set(auth(d1.accessToken)).send({ perfil: 'FUNCIONARIO' }).expect(200);
    // dono2 volta a ser DONO e dono1 é desativado por ele: continua havendo um DONO ativo
    await ctx.http.patch(`/api/v1/usuarios/${dono2.id}`).set(auth(d1.accessToken)).send({ perfil: 'DONO' }).expect(200);
    const d2 = await entrar(ctx, dono2.email);
    await ctx.http.patch(`/api/v1/usuarios/${dono1.id}`).set(auth(d2.accessToken)).send({ ativo: false }).expect(200);
  });

  // Pela HTTP, hoje só um DONO ativo gerencia a equipe, e ele não pode alterar a si mesmo:
  // sempre sobra ele. A regra ULTIMO_DONO protege perfis futuros com EQUIPE_GERENCIAR que
  // não sejam DONO; por isso é testada direto no service, com um "ator" que não é DONO.
  it('ULTIMO_DONO: o service recusa rebaixar ou desativar o único DONO ativo', async () => {
    const { oficina, usuario: dono } = await criarOficinaComUsuario(ctx);
    const ator = await criarUsuarioNa(ctx, oficina.id, 'FUNCIONARIO');
    const usuarios = ctx.app.get(UsuariosService);
    for (const dados of [{ perfil: 'FUNCIONARIO' as const }, { ativo: false }]) {
      await expect(
        ctx.tenant.executarComo(oficina.id, () => usuarios.alterar(dono.id, dados, { id: ator.id, oficinaId: oficina.id })),
      ).rejects.toMatchObject({ code: 'ULTIMO_DONO' });
    }
    const intacto = await ctx.tenant.executarComo(oficina.id, () => ctx.prisma.db.usuario.findUnique({ where: { id: dono.id } }));
    expect(intacto).toMatchObject({ perfil: 'DONO', ativo: true });
  });
});
```

- [ ] **Passo 2: implementação**

`UsuariosService` (acrescentar; injetar `EventEmitter2`):
```ts
listar() {
  return this.prisma.db.usuario.findMany({ orderBy: { nome: 'asc' }, select: CAMPOS_PUBLICOS });
}

/** Na requisição autenticada. Regras: não altera a si mesmo; sempre sobra um DONO ativo. */
async alterar(id: string, dados: { perfil?: PerfilUsuario; ativo?: boolean }, ator: { id: string; oficinaId: string }) {
  if (id === ator.id) throw new ErroNegocio(422, 'ACAO_NAO_PERMITIDA_EM_SI_MESMO', 'Você não pode alterar o próprio perfil ou se desativar');
  const alvo = await this.prisma.db.usuario.findUniqueOrThrow({ where: { id }, select: CAMPOS_PUBLICOS });
  const deixaDeSerDonoAtivo = alvo.perfil === 'DONO' && alvo.ativo && (dados.perfil === 'FUNCIONARIO' || dados.ativo === false);
  if (deixaDeSerDonoAtivo) {
    const outros = await this.prisma.db.usuario.count({ where: { perfil: 'DONO', ativo: true, id: { not: id } } });
    if (outros === 0) throw new ErroNegocio(422, 'ULTIMO_DONO', 'A oficina precisa de pelo menos um dono ativo');
  }
  const atualizado = await this.prisma.db.usuario.update({ where: { id }, data: dados, select: CAMPOS_PUBLICOS });
  if (alvo.ativo && dados.ativo === false) {
    await this.eventos.emitAsync(USUARIO_DESATIVADO, { oficinaId: ator.oficinaId, usuarioId: id } satisfies UsuarioDesativado);
  }
  return atualizado;
}
```
(`findUniqueOrThrow` de outra oficina gera P2025 → 404 pelo filtro. Converter `criadoEm` para ISO na resposta do controller.)

`usuarios.controller.ts`:
```ts
@Controller('usuarios')
export class UsuariosController {
  constructor(private readonly usuarios: UsuariosService) {}

  @Get()
  @ExigePermissao('EQUIPE_GERENCIAR')
  async listar(): Promise<MembroEquipe[]> {
    return (await this.usuarios.listar()).map(paraMembro);
  }

  @Patch(':id')
  @ExigePermissao('EQUIPE_GERENCIAR')
  async alterar(@Param('id') id: string, @Body(new ZodValidationPipe(alterarUsuarioSchema)) dados: { perfil?: PerfilUsuario; ativo?: boolean }, @UsuarioAtual() ator: UsuarioAutenticado): Promise<MembroEquipe> {
    return paraMembro(await this.usuarios.alterar(id, dados, ator));
  }
}

const paraMembro = (u: { id: string; nome: string; email: string; telefone: string | null; perfil: PerfilUsuario; ativo: boolean; criadoEm: Date }): MembroEquipe => ({
  id: u.id, nome: u.nome, email: u.email, telefone: u.telefone, perfil: u.perfil, ativo: u.ativo, criadoEm: u.criadoEm.toISOString(),
});
```
Os decorators (`ExigePermissao`, `UsuarioAtual`) vêm de `modules/auth/decorators.ts`, que não tem dependências de serviço; importar esse arquivo em `usuarios` não cria dependência de módulo.

`oficinas.controller.ts`:
```ts
@Controller('oficinas')
export class OficinasController {
  constructor(private readonly oficinas: OficinasService) {}

  @Get('atual')
  buscar(): Promise<DadosOficina> {
    return this.oficinas.buscarAtual();
  }

  @Patch('atual')
  @ExigePermissao('OFICINA_EDITAR')
  atualizar(@Body(new ZodValidationPipe(oficinaDadosSchema)) dados: DadosOficinaValidos): Promise<DadosOficina> {
    return this.oficinas.atualizar(dados);
  }
}
```

- [ ] **Passo 3: verificar e commitar**

```bash
pnpm --filter @oficinatrack/api test && pnpm --filter @oficinatrack/api typecheck && pnpm lint
git add apps/api
git commit -m "feat(equipe): dados da oficina e gestao da equipe com regras do dono"
```

---

### Tarefa 8: Convites

Agent: `backend-nest`.

**Arquivos:** criar `src/modules/usuarios/{convites.service.ts,convites.controller.ts}`, `src/modules/auth/convites-publico.controller.ts`; modificar módulos; criar `test/auth/convites.e2e-spec.ts`.

**Interfaces (produz):**
- `ConvitesService`: `criar(dados, criadoPor: UsuarioAutenticado): Promise<ConviteCriado>`, `listarPendentes(): Promise<ConvitePendente[]>`, `reenviar(id): Promise<ConviteCriado>`, `cancelar(id): Promise<void>`, `consultar(token): Promise<{ nomeOficina; nome; email; telefone }>`, `aceitar(dados): Promise<{ id; oficinaId; perfil }>`
- Endpoints: `GET /convites`, `POST /convites` (201 `ConviteCriado`), `POST /convites/:id/reenviar` (200 `ConviteCriado`), `DELETE /convites/:id` (204) — todos `EQUIPE_GERENCIAR`; `POST /convites/consultar` (público, 200), `POST /convites/aceitar` (público, 200 `RespostaSessao` + cookie)
- Link: `${URL_APP}/convite#<token>`; validade 72 h

- [ ] **Passo 1: testes e2e (falhando)**

`test/auth/convites.e2e-spec.ts`:
```ts
import { cookieRefresh, criarApp, criarOficinaComUsuario, criarUsuarioNa, entrar, ORIGEM, sufixo, type App } from './apoio-auth.js';

const tokenDoLink = (texto: string) => /#([A-Za-z0-9_-]{43})/.exec(texto)?.[1];

describe('Convites', () => {
  let ctx: App;
  beforeAll(async () => { ctx = await criarApp(); });
  afterAll(() => ctx.app.close());
  const auth = (t: string) => ({ Authorization: `Bearer ${t}` });

  it('fluxo completo: convidar → e-mail + link → consultar → aceitar → sessão de FUNCIONARIO', async () => {
    const { oficina, usuario: dono } = await criarOficinaComUsuario(ctx);
    const d = await entrar(ctx, dono.email);
    const email = `Mec-${sufixo()}@Teste.Local`;
    const criado = await ctx.http.post('/api/v1/convites').set(auth(d.accessToken)).send({ nome: 'Mecânico', email, telefone: '(43) 99999-1111' }).expect(201);
    expect(criado.body.convite).toMatchObject({ email: email.toLowerCase(), perfil: 'FUNCIONARIO', telefone: '+5543999991111' });
    expect(criado.body.link).toMatch(/^http:\/\/localhost:5173\/convite#[A-Za-z0-9_-]{43}$/);
    const mensagem = ctx.emails.ultimoPara(email.toLowerCase())!;
    const token = tokenDoLink(mensagem.texto)!;
    expect(criado.body.link.endsWith(token)).toBe(true);

    const info = await ctx.http.post('/api/v1/convites/consultar').send({ token }).expect(200);
    expect(info.body).toMatchObject({ nomeOficina: oficina.nome, nome: 'Mecânico', email: email.toLowerCase() });

    const r = await ctx.http.post('/api/v1/convites/aceitar').set('Origin', ORIGEM).send({ token, senha: 'chave-de-roda-12' }).expect(200);
    expect(r.body.usuario).toMatchObject({ perfil: 'FUNCIONARIO', oficina: { id: oficina.id } });
    expect(cookieRefresh(r)).toMatch(/^ot_refresh=/);
    await entrar(ctx, email, 'chave-de-roda-12');
    await ctx.http.post('/api/v1/convites/aceitar').set('Origin', ORIGEM).send({ token, senha: 'outra-senha-boa' }).expect(400);
  });

  it('e-mail que já tem conta → 409 EMAIL_JA_CADASTRADO', async () => {
    const { usuario: dono } = await criarOficinaComUsuario(ctx);
    const outra = await criarOficinaComUsuario(ctx);
    const d = await entrar(ctx, dono.email);
    const r = await ctx.http.post('/api/v1/convites').set(auth(d.accessToken)).send({ nome: 'X', email: outra.usuario.email }).expect(409);
    expect(r.body.code).toBe('EMAIL_JA_CADASTRADO');
  });

  it('reenviar invalida o link antigo; cancelar invalida o convite', async () => {
    const { usuario: dono } = await criarOficinaComUsuario(ctx);
    const d = await entrar(ctx, dono.email);
    const email = `mec-${sufixo()}@teste.local`;
    const c = await ctx.http.post('/api/v1/convites').set(auth(d.accessToken)).send({ nome: 'Mec', email }).expect(201);
    const antigo = tokenDoLink(c.body.link)!;
    const r = await ctx.http.post(`/api/v1/convites/${c.body.convite.id}/reenviar`).set(auth(d.accessToken)).expect(200);
    await ctx.http.post('/api/v1/convites/consultar').send({ token: antigo }).expect(400);
    const novo = tokenDoLink(r.body.link)!;
    await ctx.http.delete(`/api/v1/convites/${c.body.convite.id}`).set(auth(d.accessToken)).expect(204);
    await ctx.http.post('/api/v1/convites/consultar').send({ token: novo }).expect(400);
  });

  it('convite expirado → TOKEN_INVALIDO', async () => {
    const { oficina, usuario: dono } = await criarOficinaComUsuario(ctx);
    const d = await entrar(ctx, dono.email);
    const c = await ctx.http.post('/api/v1/convites').set(auth(d.accessToken)).send({ nome: 'Mec', email: `exp-${sufixo()}@teste.local` }).expect(201);
    await ctx.tenant.executarComo(oficina.id, () => ctx.prisma.db.convite.update({ where: { id: c.body.convite.id }, data: { expiraEm: new Date(Date.now() - 1000) } }));
    const r = await ctx.http.post('/api/v1/convites/consultar').send({ token: tokenDoLink(c.body.link)! }).expect(400);
    expect(r.body.code).toBe('TOKEN_INVALIDO');
  });

  it('isolamento: dono de A não lista, reenvia nem cancela convite de B (404); FUNCIONARIO → 403', async () => {
    const a = await criarOficinaComUsuario(ctx);
    const b = await criarOficinaComUsuario(ctx);
    const dA = await entrar(ctx, a.usuario.email);
    const dB = await entrar(ctx, b.usuario.email);
    const cB = await ctx.http.post('/api/v1/convites').set(auth(dB.accessToken)).send({ nome: 'Mec', email: `iso-${sufixo()}@teste.local` }).expect(201);
    const lista = await ctx.http.get('/api/v1/convites').set(auth(dA.accessToken)).expect(200);
    expect(lista.body.find((c: { id: string }) => c.id === cB.body.convite.id)).toBeUndefined();
    await ctx.http.post(`/api/v1/convites/${cB.body.convite.id}/reenviar`).set(auth(dA.accessToken)).expect(404);
    await ctx.http.delete(`/api/v1/convites/${cB.body.convite.id}`).set(auth(dA.accessToken)).expect(404);
    const func = await criarUsuarioNa(ctx, a.oficina.id, 'FUNCIONARIO');
    const f = await entrar(ctx, func.email);
    await ctx.http.post('/api/v1/convites').set(auth(f.accessToken)).send({ nome: 'X', email: `f-${sufixo()}@teste.local` }).expect(403);
  });

  it('aceitar com telefone já usado por outra conta → 409 TELEFONE_JA_CADASTRADO e o convite continua válido', async () => {
    const { usuario: dono } = await criarOficinaComUsuario(ctx);
    const d = await entrar(ctx, dono.email);
    const c = await ctx.http.post('/api/v1/convites').set(auth(d.accessToken)).send({ nome: 'Mec', email: `tel-${sufixo()}@teste.local` }).expect(201);
    const token = tokenDoLink(c.body.link)!;
    const r = await ctx.http.post('/api/v1/convites/aceitar').set('Origin', ORIGEM).send({ token, senha: 'chave-de-roda-12', telefone: dono.telefone }).expect(409);
    expect(r.body.code).toBe('TELEFONE_JA_CADASTRADO');
    await ctx.http.post('/api/v1/convites/aceitar').set('Origin', ORIGEM).send({ token, senha: 'chave-de-roda-12' }).expect(200);
  });
});
```

- [ ] **Passo 2: implementação**

`convites.service.ts` (em `usuarios`; injeta `PrismaService`, `TenantContext`, `ConfigService`, `EnvioEmail`, `OficinasService`, `UsuariosService`):
```ts
const VALIDADE_CONVITE_MS = 72 * 60 * 60 * 1000;
const CAMPOS = { id: true, nome: true, email: true, telefone: true, perfil: true, expiraEm: true, criadoEm: true } as const;

@Injectable()
export class ConvitesService {
  private readonly logger = new Logger(ConvitesService.name);
  constructor(/* dependências acima */) {}

  async criar(dados: { nome: string; email: string; telefone?: string; perfil: PerfilUsuario }, criadoPor: { id: string; oficinaId: string }): Promise<ConviteCriado> {
    // sem tenant: e-mail é único no sistema inteiro (a conta pode estar em outra oficina)
    if (await this.tenant.executarSemTenant(() => this.usuarios.emailEmUso(dados.email))) {
      throw new ErroNegocio(409, 'EMAIL_JA_CADASTRADO', 'Este e-mail já tem uma conta no OficinaTrack');
    }
    // um convite pendente por e-mail na oficina: o novo substitui o antigo
    await this.prisma.db.convite.deleteMany({ where: { email: dados.email, usadoEm: null } });
    const { token, hash } = gerarToken();
    const convite = await this.prisma.db.convite.create({
      data: { oficinaId: criadoPor.oficinaId, criadoPorId: criadoPor.id, nome: dados.nome, email: dados.email, telefone: dados.telefone ?? null, perfil: dados.perfil, tokenHash: hash, expiraEm: new Date(Date.now() + VALIDADE_CONVITE_MS) },
      select: CAMPOS,
    });
    return this.enviar(convite, token);
  }

  async listarPendentes(): Promise<ConvitePendente[]> {
    const lista = await this.prisma.db.convite.findMany({ where: { usadoEm: null, expiraEm: { gt: new Date() } }, orderBy: { criadoEm: 'desc' }, select: CAMPOS });
    return lista.map(paraPendente);
  }

  async reenviar(id: string): Promise<ConviteCriado> {
    const { token, hash } = gerarToken();
    const convite = await this.prisma.db.convite.update({
      where: { id, usadoEm: null },
      data: { tokenHash: hash, expiraEm: new Date(Date.now() + VALIDADE_CONVITE_MS) },
      select: CAMPOS,
    });
    return this.enviar(convite, token);
  }

  async cancelar(id: string): Promise<void> {
    await this.prisma.db.convite.delete({ where: { id, usadoEm: null } });
  }

  async consultar(token: string) {
    const convite = await this.buscarValido(token);
    return this.tenant.executarComo(convite.oficinaId, async () => {
      const oficina = await this.oficinas.buscarAtual();
      return { nomeOficina: oficina.nome, nome: convite.nome, email: convite.email, telefone: convite.telefone };
    });
  }

  async aceitar({ token, senha, nome, telefone }: { token: string; senha: string; nome?: string; telefone?: string }) {
    const convite = await this.buscarValido(token);
    const senhaHash = await hashSenha(senha);
    const telefoneFinal = telefone ?? convite.telefone ?? null;
    // sem tenant: telefone e e-mail são únicos no sistema inteiro
    if (telefoneFinal && (await this.tenant.executarSemTenant(() => this.usuarios.telefoneEmUso(telefoneFinal)))) {
      throw new ErroNegocio(409, 'TELEFONE_JA_CADASTRADO', 'Este telefone já está em outra conta');
    }
    return this.tenant.executarComo(convite.oficinaId, () =>
      this.prisma.db.$transaction(async (tx) => {
        const marcado = await tx.convite.updateMany({ where: { id: convite.id, usadoEm: null }, data: { usadoEm: new Date() } });
        if (marcado.count !== 1) throw tokenInvalido();
        return tx.usuario.create({
          data: { oficinaId: convite.oficinaId, nome: nome ?? convite.nome, email: convite.email, telefone: telefoneFinal, senhaHash, perfil: convite.perfil, emailConfirmadoEm: new Date() },
          select: { id: true, oficinaId: true, perfil: true },
        });
      }),
    );
  }

  private async buscarValido(token: string) {
    // sem tenant: o link chega só com o token; a oficina vem do convite achado pelo hash
    const convite = await this.tenant.executarSemTenant(() => this.prisma.db.convite.findUnique({ where: { tokenHash: hashToken(token) } }));
    if (!convite || convite.usadoEm || convite.expiraEm.getTime() <= Date.now()) throw tokenInvalido();
    return convite;
  }

  private async enviar(convite: Parameters<typeof paraPendente>[0], token: string): Promise<ConviteCriado> {
    const link = `${this.config.get('URL_APP', { infer: true })}/convite#${token}`;
    const oficina = await this.oficinas.buscarAtual();
    try {
      await this.email.enviar({ para: convite.email, ...modelosEmail.convite({ nomeOficina: oficina.nome, nomeConvidado: convite.nome, link }) });
    } catch (erro) {
      this.logger.error(`Falha ao enviar e-mail de convite: ${(erro as Error).name}`);
    }
    return { convite: paraPendente(convite), link };
  }
}
```
(`tokenInvalido` vem de um utilitário comum: mover a função de `tokens-usuario.service.ts` para `src/common/erros/erros-auth.ts` para `usuarios` e `auth` usarem sem dependência cruzada; `paraPendente` converte datas para ISO.) Race de aceite com o mesmo e-mail em duas oficinas: o `@unique` do e-mail gera P2002 → 409 `CONFLITO` pelo filtro (aceitável).

`convites.controller.ts` (em `usuarios`, rotas de DONO) e `convites-publico.controller.ts` (em `auth`, `@Controller('convites')` com `consultar` e `aceitar` — este último cria a sessão com `SessoesService.criar` dentro de `executarComo(usuario.oficinaId)`, define o cookie e confere `Origin`). Limites: `consultar` e `aceitar` com `limite(10)` por minuto.

- [ ] **Passo 3: verificar e commitar**

```bash
pnpm --filter @oficinatrack/api test && pnpm --filter @oficinatrack/api typecheck && pnpm lint
git add apps/api
git commit -m "feat(equipe): convites por e-mail e whatsapp com aceite publico"
```

---

### Tarefa 9: Front — identidade visual, sessão e telas públicas

Agent: `frontend-react`.

**Arquivos:** modificar `apps/web/src/index.css`, `lib/api.ts` (+spec), `app/router.tsx`, `main.tsx`, `pages/inicio.tsx` (remover; a raiz redireciona); criar `lib/sessao.ts`, `features/auth/**`, `components/campo-formulario.tsx`, componentes shadcn `input`, `label`, `card`, `alert`, `checkbox`, `select`.

**Interfaces:**
- Consome: endpoints das Tarefas 4–6 e 8; schemas e tipos de `@oficinatrack/shared`.
- Produz:
  - `lib/sessao.ts`: `obterToken(): string | null`, `definirToken(t: string | null)`, `aoMudarSessao(fn): () => void`, `renovarSessao(): Promise<RespostaSessao | null>` (uma única renovação em andamento compartilhada; tenta de novo uma vez após 800 ms se a primeira falhar com 401 — Review Focus 1)
  - `api()` envia `Authorization: Bearer` quando há token; em 401 de rota que não é `/auth/*`, chama `renovarSessao()` uma vez e repete; se falhar, `definirToken(null)` e relança
  - `AuthProvider` + `useAuth(): { estado: 'carregando' | 'anonimo' | 'autenticado'; usuario: UsuarioEu | null; entrar(r: RespostaSessao): void; sair(): Promise<void>; recarregar(): Promise<void> }`
  - `usePermissao(p: Permissao): boolean`
  - `<RotaProtegida permissao?>` (anônimo → `/entrar`; sem permissão → `/painel`)
  - Rotas públicas: `/entrar`, `/cadastro`, `/verifique-seu-email`, `/confirmar-email`, `/esqueci-senha`, `/redefinir-senha`, `/convite`; `/` redireciona para `/painel` ou `/entrar`

- [ ] **Passo 1: dependências e identidade visual**

```bash
pnpm --filter @oficinatrack/web add react-hook-form@^7.88.0 @hookform/resolvers@^5.9.1 @fontsource/barlow @fontsource/barlow-condensed
pnpm --filter @oficinatrack/web exec shadcn add input label card alert checkbox select
```
Identidade (mesma linguagem da página de visitas que o usuário já conhece — "macacão e amarelo de segurança"): em `index.css`, depois do `@import "tailwindcss"`, importar `@fontsource/barlow/400.css`, `/500.css`, `/600.css` e `@fontsource/barlow-condensed/600.css`, `/700.css`, e definir os tokens do shadcn:
```css
:root {
  --background: #eef0ec;
  --foreground: #1b2220;
  --card: #ffffff;
  --card-foreground: #1b2220;
  --primary: #1f4e8c;           /* azul macacão */
  --primary-foreground: #ffffff;
  --secondary: #dfe7f3;
  --secondary-foreground: #1f4e8c;
  --accent: #e3a91b;            /* amarelo segurança: destaque, nunca texto sobre branco */
  --accent-foreground: #1b2220;
  --muted: #e4e8e3;
  --muted-foreground: #5c6662;
  --destructive: #b3362b;
  --border: #d3d8d3;
  --input: #d3d8d3;
  --ring: #1f4e8c;
  --radius: 0.625rem;
  --font-sans: "Barlow", system-ui, sans-serif;
  --font-display: "Barlow Condensed", "Arial Narrow", sans-serif;
}
```
Mais a variante escura em `@media (prefers-color-scheme: dark)` com os mesmos nomes (`--background: #111614; --card: #1a201e; --foreground: #e5e9e4; --primary: #7fa6e0; --primary-foreground: #0e1a2b; --muted-foreground: #9aa49f; --border: #2e3633`). Títulos de tela usam `font-display uppercase tracking-wide`. Botões e campos com altura mínima de 44px (`h-11`). Mapear os tokens no `@theme inline` que o shadcn gerou (ajustar os nomes existentes, sem duplicar).

- [ ] **Passo 2: sessão no cliente (teste → implementação)**

`lib/api.spec.ts`, acrescentar:
```ts
import { definirToken } from './sessao';

describe('api com sessão', () => {
  afterEach(() => { vi.unstubAllGlobals(); definirToken(null); });
  const json = (corpo: unknown, status = 200) => new Response(JSON.stringify(corpo), { status });

  it('envia o token de acesso', async () => {
    definirToken('tok-1');
    const fetchMock = vi.fn<(u: string, i?: RequestInit) => Promise<Response>>().mockResolvedValue(json({ ok: true }));
    vi.stubGlobal('fetch', fetchMock);
    await api('/oficinas/atual');
    expect(new Headers(fetchMock.mock.calls[0]![1]!.headers).get('Authorization')).toBe('Bearer tok-1');
  });

  it('em 401 renova uma vez e repete a chamada', async () => {
    definirToken('velho');
    const fetchMock = vi.fn<(u: string, i?: RequestInit) => Promise<Response>>()
      .mockResolvedValueOnce(json({ statusCode: 401, code: 'NAO_AUTENTICADO', message: 'x' }, 401))
      .mockResolvedValueOnce(json({ accessToken: 'novo', usuario: { id: 'u' } }))
      .mockResolvedValueOnce(json({ ok: true }));
    vi.stubGlobal('fetch', fetchMock);
    await expect(api('/oficinas/atual')).resolves.toEqual({ ok: true });
    expect(fetchMock.mock.calls[1]![0]).toBe('/api/v1/auth/refresh');
    expect(new Headers(fetchMock.mock.calls[2]![1]!.headers).get('Authorization')).toBe('Bearer novo');
  });

  it('duas chamadas com 401 ao mesmo tempo compartilham uma renovação só', async () => {
    definirToken('velho');
    let refreshes = 0;
    vi.stubGlobal('fetch', vi.fn(async (u: string, i?: RequestInit) => {
      if (u === '/api/v1/auth/refresh') { refreshes++; return json({ accessToken: 'novo', usuario: { id: 'u' } }); }
      return new Headers(i?.headers).get('Authorization') === 'Bearer novo' ? json({ ok: true }) : json({ code: 'NAO_AUTENTICADO' }, 401);
    }));
    await Promise.all([api('/a'), api('/b')]);
    expect(refreshes).toBe(1);
  });

  it('renovação que falha limpa a sessão e relança 401', async () => {
    definirToken('velho');
    vi.stubGlobal('fetch', vi.fn(async () => json({ statusCode: 401, code: 'SESSAO_INVALIDA', message: 'x' }, 401)));
    await expect(api('/oficinas/atual')).rejects.toMatchObject({ statusCode: 401 });
    expect(obterToken()).toBeNull();
  });
});
```

`lib/sessao.ts`:
```ts
import type { RespostaSessao } from '@oficinatrack/shared';

let token: string | null = null;
const ouvintes = new Set<(t: string | null) => void>();
let renovacao: Promise<RespostaSessao | null> | null = null;

export const obterToken = () => token;

export function definirToken(novo: string | null): void {
  token = novo;
  for (const fn of ouvintes) fn(novo);
}

export function aoMudarSessao(fn: (t: string | null) => void): () => void {
  ouvintes.add(fn);
  return () => ouvintes.delete(fn);
}

async function pedirRefresh(): Promise<Response> {
  return fetch('/api/v1/auth/refresh', { method: 'POST', credentials: 'include' });
}

/** Uma renovação por vez; se outra aba acabou de girar o cookie, a primeira tentativa perde e a segunda acerta. */
export function renovarSessao(): Promise<RespostaSessao | null> {
  renovacao ??= (async () => {
    try {
      let r = await pedirRefresh();
      if (r.status === 401) {
        await new Promise((ok) => setTimeout(ok, 800));
        r = await pedirRefresh();
      }
      if (!r.ok) { definirToken(null); return null; }
      const sessao = (await r.json()) as RespostaSessao;
      definirToken(sessao.accessToken);
      return sessao;
    } catch {
      definirToken(null);
      return null;
    } finally {
      renovacao = null;
    }
  })();
  return renovacao;
}
```
Nos testes do `lib/api.spec.ts`, o atraso de 800 ms entra só quando o primeiro refresh dá 401; o caso "renovação que falha" deve usar `vi.useFakeTimers()` + `vi.advanceTimersByTimeAsync(800)` ou aceitar os 800 ms — escolher fake timers.

`lib/api.ts` (substitui a função atual mantendo `ErroApi`):
```ts
export async function api<T>(caminho: string, init?: RequestInit, jaRenovou = false): Promise<T> {
  const headers = new Headers(init?.headers);
  if (typeof init?.body === 'string' && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
  const atual = obterToken();
  if (atual) headers.set('Authorization', `Bearer ${atual}`);
  const resposta = await fetch(`/api/v1${caminho}`, { ...init, credentials: 'include', headers });
  if (resposta.status === 401 && !jaRenovou && !caminho.startsWith('/auth/')) {
    const sessao = await renovarSessao();
    if (sessao) return api<T>(caminho, init, true);
  }
  const corpo: unknown = resposta.status === 204 ? undefined : await resposta.json().catch(() => undefined);
  if (!resposta.ok) {
    const erro = (corpo ?? {}) as CorpoErro;
    throw new ErroApi(resposta.status, erro.code ?? 'ERRO_DESCONHECIDO', erro.message ?? 'Não foi possível completar a ação. Tente de novo.', erro.details);
  }
  return corpo as T;
}
```

`features/auth/contexto/auth-provider.tsx`:
```tsx
import type { Permissao, RespostaSessao, UsuarioEu } from '@oficinatrack/shared';
import { createContext, useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { aoMudarSessao, definirToken, renovarSessao } from '@/lib/sessao';

export type EstadoAuth = 'carregando' | 'anonimo' | 'autenticado';
export type ValorAuth = {
  estado: EstadoAuth;
  usuario: UsuarioEu | null;
  entrar: (r: RespostaSessao) => void;
  sair: () => Promise<void>;
  recarregar: () => Promise<void>;
  tem: (p: Permissao) => boolean;
};
export const ContextoAuth = createContext<ValorAuth | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [usuario, setUsuario] = useState<UsuarioEu | null>(null);
  const [estado, setEstado] = useState<EstadoAuth>('carregando');
  const cliente = useQueryClient();

  useEffect(() => {
    let ativo = true;
    void renovarSessao().then((s) => {
      if (!ativo) return;
      setUsuario(s?.usuario ?? null);
      setEstado(s ? 'autenticado' : 'anonimo');
    });
    const parar = aoMudarSessao((t) => {
      if (t === null) { setUsuario(null); setEstado('anonimo'); cliente.clear(); }
    });
    return () => { ativo = false; parar(); };
  }, [cliente]);

  const entrar = useCallback((r: RespostaSessao) => {
    definirToken(r.accessToken);
    setUsuario(r.usuario);
    setEstado('autenticado');
  }, []);

  const sair = useCallback(async () => {
    await api('/auth/logout', { method: 'POST' }).catch(() => undefined);
    definirToken(null);
  }, []);

  const recarregar = useCallback(async () => {
    setUsuario(await api<UsuarioEu>('/auth/eu'));
  }, []);

  const valor = useMemo<ValorAuth>(
    () => ({ estado, usuario, entrar, sair, recarregar, tem: (p) => usuario?.permissoes.includes(p) ?? false }),
    [estado, usuario, entrar, sair, recarregar],
  );
  return <ContextoAuth.Provider value={valor}>{children}</ContextoAuth.Provider>;
}
```
`use-auth.ts` (`useContext` com erro se fora do provider) e `hooks/use-permissao.ts` (`useAuth().tem(p)`). `components/rota-protegida.tsx`: `carregando` → tela cheia com `role="status"` "Carregando…"; `anonimo` → `<Navigate to="/entrar" replace state={{ de: location.pathname }} />`; `permissao` ausente → `<Navigate to="/painel" replace />`.

- [ ] **Passo 3: telas públicas (testes → implementação)**

Padrão de formulário (`components/campo-formulario.tsx`): `Label` + `Input` `h-11` + mensagem de erro com `role="alert"` e `aria-describedby`. Todas as telas públicas: card centralizado, `max-w-md`, `px-4`, título em `font-display`, logo textual "OficinaTrack", estados de envio (botão desabilitado + "Enviando…") e erro da API em `Alert` com a `message` recebida.

Telas e comportamento exato:

| Rota | Campos e ações | Sucesso | Erros tratados |
|---|---|---|---|
| `/entrar` | "E-mail ou telefone", "Senha", Entrar; links "Esqueci a senha" e "Criar conta da oficina" | `entrar(resposta)` e vai para `state.de` ou `/painel` | `CREDENCIAIS_INVALIDAS` (mensagem da API); `EMAIL_NAO_CONFIRMADO` → vai para `/verifique-seu-email` com o e-mail no `state`; `MUITAS_TENTATIVAS`/`MUITAS_REQUISICOES` → mensagem da API |
| `/cadastro` | Código de acesso; Oficina: nome, WhatsApp da oficina, cidade, UF (`select` com `UFS`), endereço, CPF/CNPJ (opcional); Você: nome, e-mail, senha; checkbox "Li e aceito os termos de uso"; Criar conta | vai para `/verifique-seu-email` com o e-mail | `CODIGO_PILOTO_INVALIDO` no campo código; `EMAIL_JA_CADASTRADO` no campo e-mail com link para Entrar; `VALIDACAO_FALHOU` → `details` nos campos |
| `/verifique-seu-email` | texto "Enviamos um link para **{email}**. Abra seu e-mail e clique em Confirmar."; botão "Reenviar e-mail" (desabilitado por 60 s após clicar) | mensagem da API | 429 → mensagem |
| `/confirmar-email` | lê o token de `location.hash`; mostra "Confirmar meu e-mail" (**nada é enviado ao abrir** — Review Focus 3) | `entrar(resposta)` e `/painel` | `TOKEN_INVALIDO` → mensagem + link para `/verifique-seu-email` |
| `/esqueci-senha` | E-mail; Enviar link | mostra a `mensagem` da API (sempre a mesma) | 429 |
| `/redefinir-senha` | token do hash; Nova senha, Repetir senha (igualdade validada no front) | mensagem + botão para `/entrar` | `TOKEN_INVALIDO` → link para `/esqueci-senha` |
| `/convite` | token do hash; ao abrir mostra só "Você recebeu um convite" e o botão "Ver convite" (consultar só depois do clique — Review Focus 3); depois mostra oficina, nome (editável), e-mail (somente leitura), WhatsApp (opcional), senha; Aceitar | `entrar(resposta)` e `/painel` | `TOKEN_INVALIDO`; `TELEFONE_JA_CADASTRADO` no campo |

Em todas as rotas públicas com token, pôr `<meta name="referrer" content="no-referrer">` (via `useEffect` que adiciona/remove a tag) e limpar o hash da URL depois de ler o token (`history.replaceState(null, '', location.pathname)`).

Testes obrigatórios (`features/auth/pages/*.spec.tsx`, com `fetch` mockado e `MemoryRouter`):
```tsx
it('confirmar e-mail não chama a API ao abrir o link (Review Focus 3)', async () => {
  const fetchMock = vi.fn();
  vi.stubGlobal('fetch', fetchMock);
  window.history.replaceState(null, '', '/confirmar-email#' + 'a'.repeat(43));
  renderizar(<ConfirmarEmail />);
  expect(await screen.findByRole('button', { name: 'Confirmar meu e-mail' })).toBeInTheDocument();
  expect(fetchMock).not.toHaveBeenCalled();
});

it('convite só consulta a API depois do clique em "Ver convite"', async () => { /* mesmo padrão */ });

it('entrar com EMAIL_NAO_CONFIRMADO leva para /verifique-seu-email', async () => { /* mock 403 */ });

it('cadastro mostra CODIGO_PILOTO_INVALIDO no campo do código', async () => { /* mock 400 */ });

it('cadastro valida no front a senha comum antes de enviar', async () => { /* digita 12345678, espera mensagem "muito comum", fetch não chamado */ });
```
(Escrever cada teste completo, com `renderizar` = `QueryClientProvider` + `AuthProvider` + `MemoryRouter`; o `AuthProvider` chama `/auth/refresh` ao montar — o mock de fetch responde 401 para esse caminho.)

Rotas (`app/router.tsx`): públicas acima; `/painel/*` dentro de `<RotaProtegida>` (layout vem na Tarefa 10; nesta tarefa, `/painel` mostra um placeholder "Painel" com o nome do usuário e botão Sair); `/` → `<Navigate>` conforme `useAuth().estado`. `main.tsx`: `AuthProvider` dentro do `QueryClientProvider`.

- [ ] **Passo 4: verificar e commitar**

```bash
pnpm --filter @oficinatrack/web test && pnpm --filter @oficinatrack/web typecheck && pnpm --filter @oficinatrack/web build && pnpm lint
```
Manual (Mailpit em `http://localhost:8025`): `pnpm --filter @oficinatrack/api codigo-piloto "Manual"`, `pnpm dev`, cadastrar em 360px, abrir o e-mail no Mailpit, confirmar, sair e entrar de novo, fechar e reabrir a aba (continua logado). Se não houver navegador disponível, dizer isso no relatório.
```bash
git add apps/web pnpm-lock.yaml
git commit -m "feat(web): identidade visual, sessao e telas de cadastro, login, confirmacao, senha e convite"
```

---

### Tarefa 10: Front — painel, equipe, oficina e minha conta

Agent: `frontend-react`.

**Arquivos:** criar `features/painel/{layout-painel.tsx,pages/inicio-painel.tsx}`, `features/equipe/{api/*.ts,pages/equipe.tsx,components/*.tsx}` (+specs), `features/oficina/{api/*.ts,pages/oficina.tsx}` (+spec), `features/conta/{api/*.ts,pages/minha-conta.tsx}` (+spec); modificar `app/router.tsx`.

**Interfaces:** consome `GET/PATCH /oficinas/atual`, `GET/PATCH /usuarios`, `GET/POST/DELETE /convites`, `POST /convites/:id/reenviar`, `PATCH /auth/senha`; `usePermissao`.

- [ ] **Passo 1: layout**

`layout-painel.tsx`: barra superior fixa (`top: env(safe-area-inset-top)`) com o nome da oficina (`usuario.oficina.nome`, truncado) e botão de menu (`Sheet` do shadcn, lado direito) com: Pátio (`/painel`, texto "Em breve: quadro do pátio" na página inicial), Equipe (`/painel/equipe`, só com `EQUIPE_GERENCIAR`), Oficina (`/painel/oficina`, só com `OFICINA_EDITAR`), Minha conta (`/painel/conta`), Sair. Em telas ≥ 1024px, o menu vira uma coluna lateral fixa. `<Outlet />` no conteúdo, `max-w-3xl`, `px-4`. Teste: FUNCIONARIO não vê "Equipe" nem "Oficina"; DONO vê.

- [ ] **Passo 2: equipe**

Hooks: `useEquipe()` (`GET /usuarios`), `useConvites()` (`GET /convites`), `useConvidar()`, `useAlterarUsuario()`, `useReenviarConvite()`, `useCancelarConvite()` — mutações invalidam `['equipe']` e `['convites']`.

Tela `/painel/equipe`:
- Lista de membros em cartões (nome, e-mail, perfil em `Badge`, "Inativo" em cinza). Ações por membro (menu "…"): "Tornar dono" / "Tornar funcionário", "Desativar" / "Reativar". Ações escondidas no próprio usuário. Desativar pede confirmação num `AlertDialog` ("{nome} perde o acesso na hora"). Erros `ULTIMO_DONO`/`ACAO_NAO_PERMITIDA_EM_SI_MESMO` → toast/alert com a mensagem da API.
- Seção "Convites pendentes": nome, e-mail, expira em (formatado `America/Sao_Paulo`), ações Reenviar, WhatsApp, Cancelar.
- Botão "Convidar" abre formulário (nome, e-mail, WhatsApp opcional, perfil): ao criar, mostra o link com botões "Enviar pelo WhatsApp" e "Copiar link". WhatsApp: `https://wa.me/{telefone sem +}?text={encodeURIComponent(msg)}` quando há telefone, senão `https://wa.me/?text=…`; mensagem: `Olá, {nome}! A {oficina} convidou você para usar o OficinaTrack. Crie sua senha por este link (vale 72 horas): {link}`. Reenviar também devolve o link novo e mostra os mesmos botões.
- Estados: carregando (skeleton), vazio ("Só você por aqui. Convide sua equipe."), erro com "Tentar de novo".

Testes: convite criado mostra link de WhatsApp com texto codificado; erro `EMAIL_JA_CADASTRADO` aparece no campo e-mail; ações não aparecem no próprio usuário.

- [ ] **Passo 3: oficina e minha conta**

`/painel/oficina`: formulário com `oficinaDadosSchema` preenchido por `GET /oficinas/atual`; Salvar → `PATCH`; sucesso "Dados salvos"; recarrega `useAuth().recarregar()` para atualizar o nome na barra.
`/painel/conta`: nome e e-mail (somente leitura) e "Trocar senha" (senha atual, nova, repetir; `trocarSenhaSchema` + igualdade no front); sucesso "Senha alterada. Os outros aparelhos vão precisar entrar de novo."; `SENHA_ATUAL_INCORRETA` no campo.
Testes: oficina salva e atualiza a barra; troca de senha mostra erro no campo certo.

- [ ] **Passo 4: verificar e commitar**

```bash
pnpm --filter @oficinatrack/web test && pnpm --filter @oficinatrack/web typecheck && pnpm --filter @oficinatrack/web build && pnpm lint
git add apps/web pnpm-lock.yaml
git commit -m "feat(web): painel, equipe com convites, dados da oficina e minha conta"
```

---

### Tarefa 11: Docs, CI e fechamento

**Arquivos:** `docs/02-escopo-mvp.md`, `docs/03-arquitetura.md`, `docs/04-modelo-dados.md`, `docs/06-seguranca.md`, `CLAUDE.md`, `README.md`, `.github/workflows/ci.yml`.

- [ ] **Passo 1: docs**
  - `02`: e-mail de autenticação no MVP (confirmação, redefinição, convite); e-mail obrigatório para todo usuário; confirmação bloqueia o acesso do dono; cadastro por código de piloto (`CADASTRO_EXIGE_CODIGO`); perfis com permissões; SMS continua fora; logo na Sprint 6; trocar e-mail fora.
  - `03`: módulos `auth`/`oficinas`/`usuarios`/`notificacoes`; guards globais (nega por padrão; perfil e ativo lidos do banco a cada requisição); sessão (JWT 15 min em memória, refresh opaco rotativo em cookie, tolerância de 10 s, reuso revoga família); tokens de link no fragmento da URL; Mailpit; `FATOR_LIMITES`; limites em memória (uma instância).
  - `04`: conferir que está igual ao schema.
  - `06`: T3/T4 com os controles implementados; D7 (sem criptografia de CPF/CNPJ, rever antes de produção); enumeração aceita no convite e no cadastro com código; `CodigoPiloto` global; access token vale até 15 min após troca de senha/desativação (o guard confere `ativo`, então desativação é imediata; troca de senha não); limites de login em memória.
  - `CLAUDE.md`: Mailpit (`http://localhost:8025`), `pnpm --filter @oficinatrack/api codigo-piloto "<descrição>"`, novas variáveis.
- [ ] **Passo 2:** CI com as variáveis novas (se a Tarefa 3 já fez, só conferir) e `pnpm lint && pnpm typecheck && pnpm test && pnpm audit --prod --audit-level high` limpos.
- [ ] **Passo 3:** commit `docs: sprint 2 conta e acesso` e `graphify update .`.
- [ ] **Passo 4:** revisão final da branch (`revisor`), auditoria `seguranca` (relatório `docs/auditorias/AAAA-MM-DD-sprint-2.md`, foco T3, T4, T7, T8 e LGPD), rodada única de correções, verificação completa e decisão do usuário sobre a branch (skill `superpowers:finishing-a-development-branch`).

---

## Autorrevisão

- **Cobertura da spec:** D1 (T5 código, `CADASTRO_EXIGE_CODIGO` em T3/T5), D2 (T3 notificações, SMS como interface), D3 (T2 e-mail obrigatório; T6 esqueci para todos; T8 aceite confirma e-mail), D4 (T4 login 403, T5 fluxo), D5 (T3/T4), D6 (T3 SMTP/Mailpit), D7 (T11 docs), D8 (T1 permissões, T4 guard, T9/T10 `usePermissao`). Fluxos 1–10: T5 (1, 2, 10), T4 (3, 4), T6 (5, 8), T8 (6), T7 (7, 9). Endpoints: todos os 17 em T4–T8. Telas: T9 (públicas), T10 (logadas). Testes da seção 5: distribuídos por T4–T8, front em T9/T10. Docs: T11.
- **Mudança consciente em relação à spec:** tokens de link no **fragmento** (`#`) em vez de no caminho: não chegam ao servidor do front nem ao `Referer`; mantida a meta `no-referrer`. Registrado em T11 (`03`).
- **Review Focus:** 1 → T4 (refresh concorrente) + T9 (retry com 800 ms); 2 → T1 + T4; 3 → T9; 4 → T4 + T7; 5 → T7.
- **Consistência de nomes:** `Sessao`, `SessoesService.criar/renovar/revogar/revogarTodasDoUsuario`, `UsuarioAutenticado.familiaId` (claim `fam`), `TokensUsuarioService.criar(db, usuario, tipo)/consumir(token, tipo)`, `CodigosPilotoService.gerar/consumir`, `UsuariosService.buscarParaLogin/buscarAtivo/buscarPorId/emailEmUso/telefoneEmUso/criarDono/marcarEmailConfirmado/atualizarSenha/buscarSenhaHash/listar/alterar`, `OficinasService.buscarAtual/criar/atualizar`, `ExigePermissao`, `Publico`, `UsuarioAtual` usados igual em todas as tarefas.
