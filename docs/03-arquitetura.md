# 03 — Arquitetura

## Decisão principal: monólito modular (não microsserviços)

Dev solo + orçamento baixo. Microsserviços multiplicam deploy, bancos, observabilidade e custo sem resolver nenhum problema que temos hoje.

Usamos **um backend NestJS dividido em módulos de domínio isolados**. Regras:

- Cada módulo expõe um *service* público; outros módulos só conversam por ele (nunca acessam o repositório/tabelas de outro módulo diretamente).
- Comunicação assíncrona entre módulos via `@nestjs/event-emitter` (ex.: `os.status_alterado` → módulo de notificações).
- Se um módulo precisar escalar sozinho no futuro, ele já tem fronteira clara para virar serviço.
- **Coordenação entre módulos (Sprint 3):** `clientes`, `veiculos` e `ordens-servico` são módulos separados; `OrdensServicoService.abrir()` (abertura rápida da OS, D1/D4) usa os *services* públicos de `ClientesService`, `VeiculosService`, `OficinasService` e `UsuariosService` dentro de uma única transação — mesmo padrão do cadastro da Sprint 2, cada service aceita um `tx`/`db` opcional. Nenhum service consulta ou grava tabela de outro módulo direto; ler campos de outro módulo por `select` de relação (ex.: a ficha do cliente trazendo seus veículos, o resumo da OS trazendo cliente/veículo/responsável) é permitido, escrever não. `GET /veiculos/consulta` mora no `OrdensServicoModule` (não no `VeiculosModule`), porque a resposta inclui a OS em aberto do veículo (D4) e `veiculos` não pode depender de `ordens-servico` sem criar dependência circular; a rota funciona porque `OrdensServicoModule` é registrado antes de `VeiculosModule` no `AppModule`, então `GET /veiculos/consulta` (estática) vence `GET /veiculos/:id`.

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
│   │   │       ├── auth/             # cadastro, login, sessão, senha
│   │   │       ├── oficinas/
│   │   │       ├── usuarios/         # equipe e convites
│   │   │       ├── clientes/         # ficha, alterar, busca (Sprint 3)
│   │   │       ├── veiculos/         # ficha, alterar, busca (Sprint 3)
│   │   │       ├── busca/            # GET /busca — placa, telefone ou nome (Sprint 3)
│   │   │       ├── ordens-servico/   # abertura (D1/D4), status, eventos (notas/atualizações), checklist
│   │   │       ├── orcamentos/
│   │   │       ├── arquivos/         # URLs pré-assinadas R2
│   │   │       ├── portal-cliente/   # endpoints públicos por token
│   │   │       └── notificacoes/     # e-mail (Sprint 2) e SMS (interface, sem implementação)
│   │   ├── prisma/schema.prisma
│   │   └── test/
│   └── web/                    # React (painel da oficina + portal do cliente)
│       └── src/
│           ├── app/            # providers, router
│           ├── features/
│           │   ├── auth/
│           │   ├── patio/
│           │   ├── os/               # início, abrir OS, ficha da OS (Sprint 3)
│           │   ├── busca/            # Sprint 3
│           │   ├── clientes/         # ficha do cliente (Sprint 3)
│           │   ├── veiculos/         # ficha do veículo (Sprint 3)
│           │   ├── orcamentos/
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
- **Escrita por relação é proibida.** Services gravam FKs escalares (`clienteId`, `responsavelId: null`); proibido connect/disconnect/set e escrita aninhada exceto create em filho com FK composta. A extensão recusa com `TenantViolacaoError` (500, falha fechada), em `data` de `create*`/`update*`/`upsert.create`/`upsert.update`: a chave `oficina`; `connect`, `connectOrCreate`, `set`, `disconnect`, `update`, `updateMany`, `upsert`, `delete`, `deleteMany` aninhados; e `create`/`createMany` aninhados em relação cujo filho não aponta de volta por FK composta (inclusive todas as relações a partir de `Oficina`). O `create` aninhado permitido é validado recursivamente com as mesmas regras. As relações são reconhecidas pelo nome do campo (`apps/api/src/prisma/relacoes-tenant.ts`, com teste que compara com o `schema.prisma`), nunca pelo formato do valor (há campos Json como `itens`/`avarias`).
- **Três camadas de isolamento:** (1) extensão do Prisma (filtro, `oficinaId` forçado, escrita por relação recusada); (2) FKs compostas `(oficinaId, xId)` em toda relação entre tabelas da oficina, com `ON UPDATE RESTRICT`; (3) trigger `impedir_troca_oficina()` que torna o `oficinaId` imutável em toda tabela com tenant.
- **`definirOficina()`** (guard da Sprint 2) só pode ser chamado uma vez por requisição, dentro de um contexto CLS ativo e nunca dentro de `executarSemTenant` (lança erro). Para "entrar" numa oficina a partir de um fluxo sem tenant (ex.: aceite de convite), use `executarComo`.
- **`$queryRaw`/`$executeRaw` não passam pela extensão**: todo SQL cru precisa filtrar `oficinaId` à mão e entrar na lista revisada do teste `test/seguranca/padroes-codigo.e2e-spec.ts`. Uso permitido de referência: `ConvitesService.aceitar` (`apps/api/src/modules/usuarios/convites.service.ts`) lê o criador do convite com `SELECT "ativo", "perfil" FROM "Usuario" WHERE "id" = ... AND "oficinaId" = ... FOR UPDATE` dentro da transação do aceite — trava a linha do criador até o commit, para uma desativação/rebaixamento simultâneo não deixar passar um convite `DONO` de quem já perdeu a permissão.
- Todo módulo tem **teste de isolamento**: usuário da oficina A tenta ler/alterar recurso da oficina B → 404.
- Futuro opcional: Row Level Security no Postgres como quarta camada.

## Autenticação e sessão (Sprint 2)

- **Guard global de autenticação, negação por padrão** (`AutenticacaoGuard`): rotas públicas precisam do decorator `@Publico()`. O guard valida o JWT (`HS256`), chama `tenant.definirOficina(oficinaId)` e busca **perfil e `ativo` no banco a cada requisição** — desativar um usuário ou trocar seu perfil vale na próxima chamada, sem esperar o access token expirar. O usuário atual fica disponível por `@UsuarioAtual()`.
- **Guard de permissões** (`PermissaoGuard`) roda depois do de autenticação; endpoints declaram permissões (`@ExigePermissao('EQUIPE_GERENCIAR')`), nunca perfis, para caber perfis futuros sem mexer nas rotas.
- **Sessão:** access token JWT de 15 min (payload `sub`, `oficinaId`, `perfil`, `fam`), guardado só na memória do front. Refresh token opaco em cookie `httpOnly; Secure; SameSite=Strict; Path=/api/v1/auth`, 30 dias, rotativo (mesma `familiaId` a cada renovação); reuso de um token já rotacionado revoga a família inteira.
- **Tolerância de concorrência de 10 s na rotação do refresh:** duas abas (ou app e navegador) renovando a sessão ao mesmo tempo não derrubam a família nem deslogam o usuário. A rotação (marcar `substituidoEm` + criar o próximo token) roda numa transação que também reconfere se a família já foi revogada por outra requisição concorrente; quem perde a corrida recebe `401 SESSAO_INVALIDA` **sem o controller apagar o cookie de refresh** (apagar apagaria, numa corrida real, o cookie novo que a requisição vencedora acabou de gravar no navegador).
- **Cliente da API (`apps/web/src/lib/sessao.ts`):** uma única renovação em voo por vez, compartilhada entre chamadas simultâneas; se `/auth/refresh` responder `401`, tenta de novo uma vez após 800 ms (dá tempo da rotação concorrente da outra aba terminar) antes de desistir. Só limpa a sessão (chama `definirToken(null)`) quando o refresh responde `401` de verdade; erro de rede, 5xx ou 429 apenas devolvem `null`. Rotas públicas de auth/convite (`/auth/login`, `/auth/cadastro`, `/convites/aceitar`, etc.) nunca disparam essa renovação — um 401 nelas é credencial/token inválido, não sessão expirada.
- **Tokens de link (confirmar e-mail, redefinir senha, aceitar convite) viajam no fragmento da URL** (`https://app.../confirmar-email#<token>`), nunca em query string: o fragmento não é enviado ao servidor por navegadores nem aparece em logs de acesso. O front lê `location.hash` uma única vez, limpa o hash com `history.replaceState` e as telas de link (Confirmar e-mail, Redefinir senha, Aceitar convite) só chamam a API **depois de um clique explícito do usuário** — protege contra pré-visualização/antivírus do provedor de e-mail que abre o link sozinho e consumiria o token.
- **Limites em memória, uma única instância:** `LimiteTentativasService` conta falhas de login por identificador (e-mail/telefone normalizado) em `Map`, complementando o limite por IP do `@nestjs/throttler`. Com mais de uma instância da API, mover para Postgres/Redis (ver `docs/06-seguranca.md`). O fator de multiplicação dos limites (`FATOR_LIMITES`, padrão `1`) é lido a cada verificação — em testes/CI sobe para `100` para não travar suítes que fazem muitas chamadas.

## Notificações e Mailpit

- Interface `EnvioEmail` com adaptador SMTP (`nodemailer`); em dev/teste, `EMAIL_TRANSPORTE=memoria` usa um adaptador que só guarda as mensagens (usado pelos testes) — SMTP real fica atrás da variável `EMAIL_TRANSPORTE=smtp`.
- **Mailpit** roda via `docker-compose.yml` (`axllent/mailpit`) em `127.0.0.1:1025` (SMTP) e `127.0.0.1:8025` (caixa de entrada web) — abra `http://localhost:8025` para ver os e-mails de confirmação/redefinição/convite enviados em desenvolvimento.
- Envio sempre **depois do commit** da transação; falha de envio só registra log (sem dados pessoais) e nunca desfaz a operação — o usuário pode pedir reenvio.

## Portal do cliente (acesso por link)

1. O usuário da oficina clica "Enviar ao cliente" → API cria/renova um `AcessoCliente` com token aleatório (32 bytes, base64url) e salva só o **hash SHA-256**.
2. API devolve a URL `https://app.../c/<token>` e o texto da mensagem; o front abre `https://wa.me/55DDDNUMERO?text=...`.
3. O cliente abre o link → front chama `GET /portal/:token/...` → API busca o hash, valida expiração/revogação e retorna **apenas** dados do cliente daquela oficina, com eventos `visivelCliente = true` **e** `retiradoEm = null` (atualização retirada nunca volta ao portal). As OS listadas são as de `OrdemServico.clienteId` do dono do token — nunca filtrar por `Veiculo.clienteId`, porque depois de uma transferência (D1) o novo dono veria o histórico do anterior.
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

## Decisões confirmadas na Sprint 1 (fundação)

- **NestJS 12 em ESM** (`"type": "module"` em `apps/api/package.json`), não CommonJS.
- **Vitest** em todo o monorepo (API, web e `packages/shared`), não Jest — um único runner para os três pacotes. Na API, `vitest.config.ts` roda os testes de unidade (`src/**/*.spec.ts`, `test/**/*.spec.ts`); `vitest.config.e2e.ts` roda os e2e (`test/**/*.e2e-spec.ts`) e precisa de Postgres.
- **oxlint** como linter único do monorepo (`.oxlintrc.json` na raiz), no lugar de ESLint — checagem rápida e sem configuração pesada, sem regras *type-aware* (`oxlint-tsgolint`) ligadas nesta sprint.
- **Prisma 7**, gerador `prisma-client` (não o antigo `prisma-client-js`, deprecado) com `output = "../src/generated/prisma"` e `moduleFormat = "esm"`, mais o *driver adapter* `@prisma/adapter-pg` — a URL de conexão fica em `apps/api/prisma.config.ts`, não no bloco `datasource` do schema. Detalhes em `docs/04-modelo-dados.md`.
- **FKs compostas `(oficinaId, xId)` → `(oficinaId, id)`** em toda relação entre tabelas da oficina, inclusive as opcionais (`OrdemServico.responsavel`, `EventoOS.autor`, `Foto.evento`, com `ON DELETE NO ACTION`) e `RefreshToken.usuario`: segunda camada de isolamento, a nível de banco, além da extensão de tenant do Prisma — impede que um registro da oficina A referencie um registro da oficina B mesmo que a extensão falhe ou seja contornada. Um `include` a partir dessas relações nunca traz dado de outra oficina.
- **`ON UPDATE RESTRICT`** em toda FK para `Oficina` e em toda FK composta: `id` e `oficinaId` nunca mudam, então o banco bloqueia (em vez de propagar em cascata) qualquer tentativa de troca.
- **Trigger `impedir_troca_oficina()`** (`BEFORE UPDATE` em toda tabela com tenant): lança erro quando `NEW."oficinaId" <> OLD."oficinaId"`. Terceira camada; vale também para SQL cru.
- **`RefreshToken` tem `oficinaId`** e está em `MODELOS_COM_TENANT`. A busca pelo hash no refresh (Sprint 2) roda dentro de `executarSemTenant`, com comentário justificando.
- **`TenantContext.executarSemTenant()`** desliga o filtro automático de `oficinaId`. Uso restrito a: login, refresh de token, aceite de convite, portal do cliente (localizar o registro pelo hash do token antes de haver tenant), seeds e testes. Todo uso precisa de comentário no código justificando o motivo.
- **shadcn/ui fixado em `3.8.5`**: versões `4.x` (inclusive `latest`) falham com `Could not load the workspace config` dentro deste workspace pnpm. Instalar componentes com `pnpm --filter @oficinatrack/web exec shadcn add <componente>`, nunca `pnpm dlx shadcn@latest ...`.
- **Banco de teste não é resetado entre execuções**: o `globalSetup` do Vitest e2e (`apps/api/test/setup-global.ts`) só roda `prisma migrate deploy`, nunca `migrate reset` — o Prisma 7 bloqueia `migrate reset` quando detecta execução por agente de IA sem confirmação humana. Consequência: **todo teste só pode fazer asserções sobre registros que ele mesmo criou**, nunca assumir banco vazio ou contar linhas totais de uma tabela.
- **`executarComo`/`executarSemTenant` fazem `await` da função recebida dentro do `cls.run(...)`**, em vez de só repassar a Promise. Necessário porque as operações do Prisma 7 são *thenables* preguiçosos: só executam de fato no `.then`/`await`. Sem o `await` interno, a consulta rodaria fora do escopo do `AsyncLocalStorage` (já encerrado) e `tenant.oficinaId()` voltaria `undefined`.
- **MinIO adiado para a Sprint 6**: no MVP local não há substituto rodando para o R2; upload de arquivos (Cloudflare R2) só entra nessa sprint, então o `docker-compose.yml` desta fase sobe só Postgres.

## Segurança e LGPD (mínimo do MVP)

- HTTPS obrigatório, Helmet, CORS restrito ao domínio do front.
- Senhas com argon2.
- Refresh token rotativo e revogável.
- Logs sem dados pessoais (mascarar telefone/CPF).
- Termo de uso + política de privacidade simples; a oficina é a *controladora* dos dados dos clientes dela e nós somos *operadores*.
- Backup diário do banco.
- Erros do Prisma vão para o log só com `name`, `code` e `meta.modelName` (a `message` pode trazer os argumentos da consulta). P2002 → 409 `CONFLITO` sem ecoar campos.
- Swagger (`/api/docs`) só com `NODE_ENV=development`.

### Backlog de segurança (definir no deploy)

- **`trust proxy` (pré-requisito de deploy)**: quando a plataforma for escolhida, `app.set('trust proxy', <nº exato de saltos>)`, nunca `true`. Sem isso o throttler vê o IP do proxy (todos no mesmo balde) e os limites por rota da Sprint 2 viram limites da plataforma inteira (5 logins/min, 3 "esqueci a senha"/h, 5 cadastros/h para todos os usuários juntos); com `true`, qualquer um contorna o limite trocando o `X-Forwarded-For`. Testar com `X-Forwarded-For` simulado atrás do proxy. Mais de uma instância → storage compartilhado do throttler.
- **`NODE_ENV=production`** no deploy: ativa a validação de env de produção (segredo JWT forte, `FATOR_LIMITES=1`, `EMAIL_TRANSPORTE=smtp`) e o STARTTLS obrigatório do SMTP. O padrão é `development`.
- **Papel do banco sem superusuário** e **SMTP com TLS** (ver `docs/06-seguranca.md`, T7).
- **CSP do front** no host do `web` (`default-src 'self'; script-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; img-src 'self' blob: data: <R2>; connect-src 'self' <API>`).
- **CI**: fixar as actions por SHA e adicionar `.github/dependabot.yml` (npm + github-actions, semanal).
