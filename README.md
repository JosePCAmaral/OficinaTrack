# OficinaTrack

SaaS para oficinas mecânicas pequenas/médias do interior (PR/SP): painel da oficina
(gestão de pátio, ordens de serviço, orçamentos) e portal do cliente (acompanhamento por
link, sem senha).

Monorepo pnpm:

- `apps/api` — backend NestJS + Prisma + PostgreSQL (`@oficinatrack/api`).
- `apps/web` — frontend React + Vite + Tailwind + shadcn/ui (`@oficinatrack/web`), painel
  e portal do cliente no mesmo app.
- `packages/shared` — schemas Zod, enums e utilitários (placa, telefone, dinheiro)
  compartilhados entre API e front.

Documentação de produto e arquitetura em `docs/`; instruções para trabalhar no projeto em
`CLAUDE.md`.

## Comandos

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

A API sobe na porta `3333` por padrão (`PORT` em `apps/api/.env`); o servidor de dev do
Vite (`apps/web`) faz proxy de `/api` para `http://localhost:3333`.
