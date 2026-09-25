# 03 — Arquitetura

## Decisão principal: monólito modular (não microsserviços)

Dev solo + orçamento baixo. Microsserviços multiplicam deploy, bancos, observabilidade e custo sem resolver nenhum problema que temos hoje.

Usamos **um backend NestJS dividido em módulos de domínio isolados**. Regras:

- Cada módulo expõe um *service* público; outros módulos só conversam por ele (nunca acessam o repositório/tabelas de outro módulo diretamente).
- Comunicação assíncrona entre módulos via `@nestjs/event-emitter` (ex.: `os.status_alterado` → módulo de notificações).
- Se um módulo precisar escalar sozinho no futuro, ele já tem fronteira clara para virar serviço.

## Stack

| Camada | Escolha | Motivo |
|---|---|---|
| Monorepo | **pnpm workspaces** (+ Turborepo opcional) | Um repo, tipos compartilhados |
| Backend | **NestJS** (TypeScript) | Estrutura modular, DI, você já conhece |
| ORM | **Prisma** | Schema legível, migrações, tipos gerados |
| Banco | **PostgreSQL** | Relacional, robusto, barato |
| Validação | **Zod** em `packages/shared` (usado no front e no back via pipe) | Um schema só para os dois lados |
| Front | **React + Vite + TypeScript** | Reaproveitável no React Native depois |
| UI | Tailwind CSS + shadcn/ui | Rápido, bonito, mobile-first |
| Estado servidor | TanStack Query | Cache, refetch ao focar, polling fácil |
| Rotas | React Router (ou TanStack Router) | — |
| PWA | `vite-plugin-pwa` | Manifesto + service worker |
| Arquivos | **Cloudflare R2** (compatível com S3) | Barato, sem custo de download |
| Auth oficina | JWT (access 15 min) + refresh token rotativo (cookie httpOnly) | — |
| Auth cliente | Token de acesso por link (hash no banco) | Sem senha |
| Testes | Vitest/Jest + Supertest (API), Playwright (e2e crítico) | — |
| Deploy | 1 VPS com Docker Compose **ou** Railway/Render; banco Neon/Supabase free no início | < R$ 100/mês |

## Estrutura do repositório

```
oficinatrack/
├── apps/
│   ├── api/                    # NestJS
│   │   ├── src/
│   │   │   ├── main.ts
│   │   │   ├── app.module.ts
│   │   │   ├── common/         # guards, interceptors, filtros, decorators, tenant context
│   │   │   ├── prisma/         # PrismaService + extensão de tenant
│   │   │   └── modules/
│   │   │       ├── auth/
│   │   │       ├── oficinas/
│   │   │       ├── usuarios/
│   │   │       ├── clientes/
│   │   │       ├── veiculos/
│   │   │       ├── ordens-servico/   # OS, status, eventos, checklist
│   │   │       ├── orcamentos/
│   │   │       ├── arquivos/         # URLs pré-assinadas R2
│   │   │       ├── portal-cliente/   # endpoints públicos por token
│   │   │       └── notificacoes/     # MVP: gera textos/links wa.me
│   │   ├── prisma/schema.prisma
│   │   └── test/
│   └── web/                    # React (painel da oficina + portal do cliente)
│       └── src/
│           ├── app/            # providers, router
│           ├── features/
│           │   ├── auth/
│           │   ├── patio/
│           │   ├── ordens-servico/
│           │   ├── orcamentos/
│           │   ├── clientes-veiculos/
│           │   └── portal-cliente/   # rotas /c/:token — bundle separado (lazy)
│           ├── components/ui/
│           └── lib/            # api client, utils
├── packages/
│   └── shared/                 # schemas Zod, enums, tipos, formatadores (placa, telefone, dinheiro)
├── docs/
├── docker-compose.yml          # postgres local (+ minio para simular R2)
└── CLAUDE.md
```

> O portal do cliente fica no mesmo app `web` mas em rotas `/c/:token` com *code splitting*, para o cliente baixar só o necessário. Se crescer, vira `apps/cliente` separado sem dor.

## Multi-tenancy (crítico)

- **Banco compartilhado, coluna `oficinaId`** em toda tabela que pertence à oficina.
- O `oficinaId` vem **sempre do token JWT**, nunca do body/query da requisição.
- Um `TenantContext` (AsyncLocalStorage / `nestjs-cls`) guarda o `oficinaId` da requisição.
- Uma **extensão do Prisma** injeta `where: { oficinaId }` automaticamente nos models da oficina e seta `oficinaId` nos creates. Queries sem contexto de tenant nesses models lançam erro.
- Todo módulo tem **teste de isolamento**: usuário da oficina A tenta ler/alterar recurso da oficina B → 404.
- Futuro opcional: Row Level Security no Postgres como segunda camada.

## Portal do cliente (acesso por link)

1. O usuário da oficina clica "Enviar ao cliente" → API cria/renova um `AcessoCliente` com token aleatório (32 bytes, base64url) e salva só o **hash SHA-256**.
2. API devolve a URL `https://app.../c/<token>` e o texto da mensagem; o front abre `https://wa.me/55DDDNUMERO?text=...`.
3. O cliente abre o link → front chama `GET /portal/:token/...` → API busca o hash, valida expiração/revogação e retorna **apenas** dados do cliente daquela oficina, com eventos `visivelCliente = true`.
4. Rate limit nos endpoints do portal (`@nestjs/throttler`).
5. Expiração padrão: 90 dias, renovada a cada novo envio.

## Upload de fotos

1. Front comprime a imagem (`browser-image-compression`).
2. `POST /arquivos/upload-url` → API devolve URL pré-assinada PUT do R2 (chave `oficinas/{oficinaId}/os/{osId}/{uuid}.jpg`).
3. Front envia direto ao R2 e depois confirma `POST /ordens-servico/:id/fotos` com a chave.
4. Para exibir: URL pré-assinada GET de curta duração (bucket privado).

## "Tempo real" no MVP

- TanStack Query com `refetchOnWindowFocus` + `refetchInterval` de 20–30 s no quadro do pátio e no portal.
- Server-Sent Events só depois, se o piloto pedir.

## Padrões de API

- REST, prefixo `/api/v1`.
- Erros no formato `{ statusCode, code, message, details? }`, com `code` estável (ex.: `OS_STATUS_INVALIDO`).
- Paginação por cursor em listas longas.
- Datas em ISO 8601 UTC; o front formata em `America/Sao_Paulo`.
- Dinheiro em **centavos (int)**.
- Documentação automática com `@nestjs/swagger`.

## Segurança e LGPD (mínimo do MVP)

- HTTPS obrigatório, Helmet, CORS restrito ao domínio do front.
- Senhas com argon2.
- Refresh token rotativo e revogável.
- Logs sem dados pessoais (mascarar telefone/CPF).
- Termo de uso + política de privacidade simples; a oficina é a *controladora* dos dados dos clientes dela e nós somos *operadores*.
- Backup diário do banco.
