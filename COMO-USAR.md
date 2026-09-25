# Como usar este pacote no Claude Code

1. Crie a pasta do projeto e copie para ela tudo deste pacote (`CLAUDE.md`, `docs/`, `.claude/`).
   A pasta `.claude` começa com ponto e pode ficar oculta no explorador de arquivos.
2. Rode `git init` e abra o Claude Code na pasta.
3. Confira os agents com `/agents`.
4. Faça **uma sprint por vez** (veja `docs/05-roadmap.md`). Prompt sugerido para começar:

```
Leia o CLAUDE.md e todos os arquivos em docs/. Vamos executar a Sprint 1 (Fundação) do roadmap.
Antes de escrever código, entre em plan mode e me mostre o plano: estrutura do monorepo,
dependências, docker-compose, extensão Prisma de tenant e o teste de isolamento.
Use o subagent arquiteto-dados para o schema e o backend-nest para a API.
Ao final, rode os testes e chame o subagent revisor.
```

Para as próximas sprints:

```
Sprint N do roadmap: implemente as histórias X1, X2 e X3 do docs/02-escopo-mvp.md.
Planeje primeiro. Fluxo: arquiteto-dados (se precisar) → backend-nest → frontend-react → qa-testes → revisor.
```

Ao fechar cada sprint (e antes de todo deploy):

```
Use o subagent seguranca para auditar a Sprint N (escopo: git diff desde a tag sprint-N-1).
Depois, corrija os achados Críticos e Altos com o backend-nest/frontend-react e rode a auditoria de novo.
```

## Dicas

- Crie uma tag git ao final de cada sprint (`git tag sprint-1`). O agent de segurança usa isso para saber o que mudou.

- Commit ao final de cada história que passar no revisor. Assim é fácil voltar atrás.
- Quando uma decisão mudar (ex.: novo status no kanban), atualize o doc em `docs/` **primeiro** e depois peça a implementação.
- Mantenha o `CLAUDE.md` curto; detalhes ficam em `docs/`.
- Se o contexto ficar grande, use `/clear` entre histórias; os docs garantem que nada se perde.
