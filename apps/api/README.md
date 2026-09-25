# @oficinatrack/api

API do OficinaTrack: backend NestJS (ESM) que atende o painel da oficina e o portal do
cliente. Monólito modular — cada módulo de domínio (`src/modules/*`) expõe um *service*
público; nenhum módulo acessa tabelas de outro diretamente. Detalhes de arquitetura em
`../../docs/03-arquitetura.md`.

## Rodando localmente

Veja os comandos completos (instalação, banco, dev, testes) na raiz do monorepo, em
`../../CLAUDE.md`, seção **Comandos**. Resumo:

```bash
pnpm install
cp apps/api/.env.example apps/api/.env
docker compose up -d --wait                       # sobe o Postgres na raiz do repo
pnpm --filter @oficinatrack/api prisma:migrate     # aplica as migrações
pnpm --filter @oficinatrack/api dev                # nest start --watch, porta 3333
```

## Testes

```bash
pnpm --filter @oficinatrack/api test        # unidade (vitest.config.ts) + e2e (vitest.config.e2e.ts)
pnpm --filter @oficinatrack/api test:watch  # modo watch
pnpm --filter @oficinatrack/api test:cov    # cobertura
```

Os testes e2e precisam do Postgres rodando (`docker compose up -d --wait`) e usam o banco
`oficinatrack_test`. O banco de teste **não é resetado** entre execuções (o `globalSetup`
só roda `prisma migrate deploy`); por isso cada teste cria e faz asserção apenas sobre os
próprios registros.

## Schema e migrações

- Schema Prisma: `prisma/schema.prisma`.
- Migrações: `prisma/migrations/`.
- Configuração de conexão (Prisma 7): `prisma.config.ts` (não no bloco `datasource` do schema).
- Client gerado: `src/generated/prisma` (não versionado, gerado por `prisma generate`).
