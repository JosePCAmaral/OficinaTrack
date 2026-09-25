# OficinaTrack — instruções para o Claude Code

SaaS para oficinas mecânicas pequenas/médias do interior (PR/SP). Dois lados:
**painel da oficina** (web + mobile) e **portal do cliente** (PWA por link, sem senha).

Antes de qualquer tarefa, leia o doc relevante em `docs/`:

- `docs/01-visao-produto.md`: problema, público, princípios
- `docs/02-escopo-mvp.md`: histórias, critérios de aceite, o que está FORA do MVP
- `docs/03-arquitetura.md`: stack, estrutura de pastas, multi-tenancy, portal, uploads
- `docs/04-modelo-dados.md`: schema Prisma e regras de dados
- `docs/05-roadmap.md`: ordem das sprints
- `docs/06-seguranca.md`: modelo de ameaças e controles obrigatórios (leia ao mexer em auth, portal, uploads ou permissões)

## Stack

pnpm monorepo · `apps/api` NestJS + Prisma + PostgreSQL · `apps/web` React + Vite + TS + Tailwind + shadcn/ui + TanStack Query · `packages/shared` schemas Zod, enums e utilitários · Cloudflare R2 (MinIO local).

## Regras inegociáveis

1. **Monólito modular.** Nada de microsserviços. Um módulo não acessa tabelas de outro, só o service público ou eventos (`@nestjs/event-emitter`).
2. **Multi-tenancy:** `oficinaId` vem SEMPRE do JWT via tenant context, nunca do body/query/params. Toda tabela da oficina é filtrada pela extensão do Prisma. Todo endpoint novo precisa de **teste de isolamento** (oficina A não enxerga/altera dados da oficina B → 404).
3. **Dinheiro em centavos (Int).** Nunca float.
4. **Placa e telefone sempre normalizados** pelas funções de `packages/shared` (placa maiúscula sem hífen; telefone E.164).
5. **Status da OS só muda por `OrdensServicoService.alterarStatus()`**, que cria o `EventoOS` na mesma transação.
6. **Portal do cliente** só retorna dados do cliente dono do token, eventos/fotos com `visivelCliente = true`, e nunca `observacoes` internas.
7. **Tokens** (refresh e acesso do cliente) são guardados só como hash SHA-256.
8. **Escopo:** se a tarefa pedir algo listado em "Fora do MVP" no `02-escopo-mvp.md`, pare e pergunte.
9. **Mobile-first:** toda tela precisa funcionar em 360px de largura.
10. Validação com schemas Zod de `packages/shared`, reusados no front e no back.

## Convenções

- Nomes de domínio em **português sem acento**, iguais ao schema (`ordemServico`, `alterarStatus`, `criadoEm`). Termos técnicos do framework ficam em inglês (`Controller`, `Service`, `Module`, `dto`).
- Textos da interface em português do Brasil.
- Rotas REST em `/api/v1`, kebab-case, plural (`/ordens-servico/:id/eventos`).
- Erros: `{ statusCode, code, message, details? }` com `code` em SCREAMING_SNAKE_CASE.
- Datas em UTC no banco/API; exibição em `America/Sao_Paulo`.
- Commits no padrão Conventional Commits (`feat(os): ...`).

## Comandos (atualize quando o projeto existir)

```bash
pnpm install
docker compose up -d          # postgres + minio
pnpm --filter api prisma migrate dev
pnpm dev                      # api + web
pnpm test                     # todos os testes
pnpm lint
```

## Subagents disponíveis (`.claude/agents/`)

- `arquiteto-dados`: schema Prisma, migrações, índices, regras de tenant
- `backend-nest`: módulos, endpoints, services e testes da API
- `frontend-react`: telas do painel e do portal do cliente
- `revisor`: revisão de código com foco em segurança, tenant e escopo (use antes de todo commit relevante)
- `qa-testes`: testes e2e e de isolamento, casos de borda
- `seguranca`: auditoria AppSec/LGPD aprofundada, com relatório em `docs/auditorias/`

Fluxo sugerido por história: `arquiteto-dados` (se mexer no banco) → `backend-nest` → `frontend-react` → `qa-testes` → `revisor`.
Ao final de cada sprint, antes de deploy e em mudanças de auth/portal/uploads/permissões/infra: `seguranca`. Achado **Crítico** bloqueia o deploy.
