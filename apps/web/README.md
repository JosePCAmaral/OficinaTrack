# @oficinatrack/web

Frontend do OficinaTrack: React + Vite + TypeScript + Tailwind CSS + shadcn/ui +
TanStack Query. Atende dois públicos no mesmo app, com *code splitting*:

- **Painel da oficina** — telas autenticadas (pátio, ordens de serviço, orçamentos, clientes/veículos).
- **Portal do cliente** — rotas públicas `/c/:token` (PWA, sem senha).

Detalhes de arquitetura em `../../docs/03-arquitetura.md`.

## Rodando localmente

Comandos completos (instalação, banco, dev, testes) na raiz do monorepo, em
`../../CLAUDE.md`, seção **Comandos**. Resumo:

```bash
pnpm install
pnpm --filter @oficinatrack/web dev   # http://localhost:5173, proxy de /api para a API na porta 3000
```

## Testes

```bash
pnpm --filter @oficinatrack/web test
```

## Lint e checagem de tipos

```bash
pnpm --filter @oficinatrack/web build     # tsc -b && vite build
pnpm --filter @oficinatrack/web typecheck # tsc -b --noEmit
pnpm lint                                 # oxlint, na raiz do monorepo
```

## Componentes shadcn/ui

O `shadcn` está fixado em exatamente `3.8.5` nas dependências. Versões `4.x` (inclusive
`latest`) falham com `Could not load the workspace config in .../apps/web` dentro deste
workspace pnpm. Para adicionar um componente, use sempre:

```bash
pnpm --filter @oficinatrack/web exec shadcn add <componente>
```

Nunca `pnpm dlx shadcn@latest ...` — isso baixaria a versão mais recente, que não funciona
neste monorepo.
