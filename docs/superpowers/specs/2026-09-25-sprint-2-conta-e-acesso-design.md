# Sprint 2 — Conta e acesso: especificação

**Data:** 25/09/2026 · **Épico:** A (`docs/02-escopo-mvp.md`) · **Branch:** `sprint-2` (a partir de `sprint-1`)

## Objetivo

Permitir que uma oficina piloto crie a conta, que o dono monte a equipe e que todos entrem pelo celular e continuem logados, com a autenticação seguindo o `docs/06-seguranca.md` (T3 e T4) e o isolamento entre oficinas da Sprint 1.

## Decisões tomadas com o usuário

| # | Decisão |
|---|---|
| D1 | Cadastro de oficina **fechado durante o piloto**: exige um código de piloto gerado pelo administrador. Controlado por `CADASTRO_EXIGE_CODIGO` (padrão `true`). |
| D2 | **E-mail transacional entra no MVP** (confirmação de e-mail, redefinição de senha, convite). SMS continua fora do MVP; o canal existe como interface sem implementação real. |
| D3 | **E-mail obrigatório para todo usuário** (dono e funcionário). Todos redefinem a própria senha por e-mail. |
| D4 | O **dono só acessa o painel depois de confirmar o e-mail**. |
| D5 | Autenticação própria em NestJS (`@nestjs/jwt`, argon2id, refresh token rotativo no nosso banco). Sem Passport e sem provedor terceirizado. |
| D6 | E-mail por **SMTP** (nodemailer). Dev: Mailpit. Produção: SMTP de Resend, SES ou Brevo, trocado só por variável de ambiente. |
| D7 | **Sem criptografia campo a campo** de CPF/CNPJ por enquanto; proteção por criptografia em repouso do provedor. Reavaliar antes de produção (registrado no `06-seguranca.md`). |
| D8 | Perfis `DONO` (administrador) e `FUNCIONARIO`, com **permissões por perfil**, para permitir perfis futuros (FINANCEIRO, PATIO) sem mexer em telas e endpoints. |

## 1. Dados e perfis

### Mudanças no schema (uma migração)

| Tabela | Mudança |
|---|---|
| `Usuario` | `email String @unique` passa a ser **obrigatório**; novo `emailConfirmadoEm DateTime?`; `telefone` continua opcional e único (login alternativo). |
| `Convite` | `email` obrigatório. |
| `TokenUsuario` (nova, com tenant) | `id`, `oficinaId`, `usuarioId` (FK composta `(oficinaId, usuarioId)`), `tipo` (`CONFIRMAR_EMAIL` \| `REDEFINIR_SENHA`), `tokenHash @unique`, `expiraEm`, `usadoEm?`, `criadoEm`; índice `(oficinaId, usuarioId)`. Entra em `MODELOS_COM_TENANT`, no mapa de relações e no gatilho de `oficinaId` imutável. |
| `CodigoPiloto` (nova, **global**, sem tenant) | `id`, `codigoHash @unique`, `descricao`, `expiraEm`, `usadoEm?`, `oficinaId?` (quem usou), `criadoEm`. Fica fora de `MODELOS_COM_TENANT`; documentar como model global, igual a regra de tokens. |

- E-mail sempre normalizado por `normalizarEmail()` em `packages/shared` (trim + minúsculas), com `emailSchema` Zod.
- Validades: confirmar e-mail 24 h; redefinir senha 1 h; convite 72 h; código de piloto 30 dias.
- Todos os tokens: 32 bytes de `crypto.randomBytes`, base64url; banco guarda só o SHA-256.

### Perfis e permissões (`packages/shared/src/permissoes.ts`)

```ts
PERMISSOES_POR_PERFIL = {
  DONO: [todas],
  FUNCIONARIO: [operação: CLIENTES_*, VEICULOS_*, OS_*, PATIO_*, ORCAMENTOS_*],
}
```

- Nesta sprint as permissões usadas são `EQUIPE_GERENCIAR` e `OFICINA_EDITAR` (só DONO). As de operação ficam declaradas para as próximas sprints.
- Endpoints declaram permissões (`@Permissao('EQUIPE_GERENCIAR')`), nunca perfis. Front esconde ações pelo mesmo mapa (`usePermissao`).
- Sem permissão → **403** `SEM_PERMISSAO`. Recurso de outra oficina → **404**.

## 2. Fluxos

1. **Cadastro** (`/cadastro`): código de piloto + oficina (nome, telefone, cidade, UF, endereço, CPF/CNPJ opcional) + dono (nome, e-mail, senha) + aceite dos termos (versão atual em constante `VERSAO_TERMOS`). Numa transação: valida o código (existe, não usado, não expirado), cria `Oficina`, cria `Usuario` DONO, marca o código como usado, cria `TokenUsuario` CONFIRMAR_EMAIL. Depois do commit, envia o e-mail. Resposta 201 sem sessão. Logo fica para a Sprint 6.
2. **Confirmar e-mail**: token válido → `emailConfirmadoEm = agora`, token usado, e **cria sessão** (o link prova a posse do e-mail). "Reenviar confirmação" gera um token novo e invalida os anteriores do mesmo tipo.
3. **Login** com e-mail ou telefone + senha. Erro genérico `CREDENCIAIS_INVALIDAS`. Com senha correta e e-mail não confirmado → 403 `EMAIL_NAO_CONFIRMADO` (só depois de validar a senha). Usuário inativo → mesmo erro genérico. Tempo de resposta equivalente quando o usuário não existe (hash de senha falso) para não revelar contas.
4. **Sessão**:
   - Access token JWT de 15 min (payload: `sub`, `oficinaId`, `perfil`), guardado só na memória do front.
   - Refresh token opaco em cookie `httpOnly; Secure; SameSite=Strict; Path=/api/v1/auth`, 30 dias, **rotativo** (cada uso gera outro, mesma `familiaId`).
   - Refresh revogado ou já usado reapresentado → revoga **a família inteira** e responde 401.
   - Logout revoga o token atual e apaga o cookie.
5. **Esqueci a senha**: resposta sempre igual (`200`, mesma mensagem, mesmo tempo aproximado) exista ou não a conta. Token 1 h. Redefinir: nova senha, token usado, `emailConfirmadoEm` preenchido se vazio, **todas as sessões do usuário revogadas**.
6. **Convite**: DONO informa nome, e-mail, telefone opcional e perfil (padrão FUNCIONARIO). E-mail enviado; resposta traz a URL para o botão "Enviar pelo WhatsApp" (`wa.me` com texto via `encodeURIComponent`). Aceite: consulta o convite (nome da oficina e do convidado), funcionário define senha (e ajusta nome/telefone) → cria `Usuario` com `emailConfirmadoEm = agora`, convite usado, sessão criada. Dono lista pendentes, reenvia (novo token, antigo invalidado) e cancela. E-mail que já tem conta → 409 `EMAIL_JA_CADASTRADO` (risco de enumeração aceito no piloto; registrado no `06`).
7. **Equipe** (DONO): listar; desativar (revoga todas as sessões do usuário); reativar; mudar perfil. Proibido mudar o próprio perfil ou se desativar; a oficina mantém pelo menos um DONO ativo (`ULTIMO_DONO`).
8. **Minha conta**: trocar senha exige a atual e revoga as sessões dos outros aparelhos. Trocar e-mail: fora da sprint.
9. **Oficina** (DONO): editar dados (mesmos campos do cadastro, sem código e sem termos).
10. **Código de piloto**: `pnpm --filter @oficinatrack/api codigo-piloto "<descrição>"` gera o código, grava o hash e imprime o código uma única vez.

## 3. API e segurança

### Módulos
`auth` (cadastro, login, sessão, senha), `oficinas`, `usuarios` (equipe e convites), `notificacoes` (e-mail e SMS). Comunicação só por service público.

### Endpoints (`/api/v1`)

| Método e rota | Acesso |
|---|---|
| `POST /auth/cadastro` | público |
| `POST /auth/confirmar-email`, `POST /auth/reenviar-confirmacao` | público |
| `POST /auth/login`, `POST /auth/refresh`, `POST /auth/logout` | público (refresh/logout usam o cookie) |
| `POST /auth/esqueci-senha`, `POST /auth/redefinir-senha` | público |
| `GET /auth/eu` | logado (usuário, oficina, perfil, permissões) |
| `PATCH /auth/senha` | logado |
| `GET /oficinas/atual`, `PATCH /oficinas/atual` | GET logado; PATCH `OFICINA_EDITAR` |
| `GET /usuarios`, `PATCH /usuarios/:id` | `EQUIPE_GERENCIAR` |
| `GET /convites`, `POST /convites`, `POST /convites/:id/reenviar`, `DELETE /convites/:id` | `EQUIPE_GERENCIAR` |
| `POST /convites/consultar`, `POST /convites/aceitar` | público |

### Controles
- **Guard global de autenticação, negação por padrão**; rotas públicas com `@Publico()`. O guard valida o JWT, confere no banco que o usuário existe e está ativo, e chama `tenant.definirOficina(oficinaId)`; o usuário atual fica disponível por `@UsuarioAtual()`.
- **Guard de permissões** depois do de autenticação.
- Tokens de link (confirmar, redefinir, convite) viajam **no corpo**, nunca na URL da API. Páginas do front que recebem esses links: `Referrer-Policy: no-referrer` via meta tag.
- `POST /auth/refresh` também confere o cabeçalho `Origin` contra `CORS_ORIGEM`.
- **Limites** (`@nestjs/throttler`, por rota): login 5/min por IP e por identificador, com atraso progressivo; cadastro 5/h por IP; esqueci-senha e reenviar-confirmação 3/h; convites públicos 10/min.
- **Senha**: `senhaSchema` em `packages/shared` (8–128 caracteres, recusa lista de senhas comuns embutida); argon2id via `@node-rs/argon2`.
- **`executarSemTenant`** apenas em: login, refresh, confirmar e-mail, reenviar confirmação, esqueci/redefinir senha, consultar/aceitar convite e cadastro; cada uso com comentário. Depois de achar o registro, o código passa a agir com `executarComo(registro.oficinaId, …)`.
- Logs nunca contêm e-mail, telefone, senha, tokens ou cookies completos.

### Notificações
- Interface `EnvioEmail` com adaptador SMTP (nodemailer); templates em português com HTML e texto puro.
- Envio **depois do commit**; falha é registrada no log (sem dados pessoais) e não desfaz o cadastro; o usuário pode pedir reenvio.
- Interface `EnvioSms` com implementação que só registra no log (SMS fora do MVP).
- Testes usam um adaptador em memória que guarda as mensagens.
- `docker-compose`: serviço `mailpit` em `127.0.0.1:1025` (SMTP) e `127.0.0.1:8025` (caixa de entrada).

### Variáveis de ambiente novas
`JWT_SEGREDO` (≥ 32 caracteres, obrigatória), `SMTP_HOST`, `SMTP_PORTA`, `SMTP_USUARIO`, `SMTP_SENHA`, `EMAIL_REMETENTE`, `URL_APP`, `CADASTRO_EXIGE_CODIGO` (padrão `true`). Todas validadas no `validarEnv`, com exemplo no `.env.example`.

### Erros novos (`code`)
`CREDENCIAIS_INVALIDAS` (401), `EMAIL_NAO_CONFIRMADO` (403), `SEM_PERMISSAO` (403), `NAO_AUTENTICADO` (401), `SESSAO_INVALIDA` (401), `CODIGO_PILOTO_INVALIDO` (400), `TOKEN_INVALIDO` (400, mesma resposta para inexistente, expirado ou usado), `EMAIL_JA_CADASTRADO` (409), `TELEFONE_JA_CADASTRADO` (409), `ULTIMO_DONO` (422), `ACAO_NAO_PERMITIDA_EM_SI_MESMO` (422), `SENHA_ATUAL_INCORRETA` (400).

## 4. Front (`apps/web`)

### Telas
- Públicas: Entrar; Cadastro da oficina; Verifique seu e-mail (com reenviar); Confirmar e-mail; Esqueci a senha; Redefinir senha; Aceitar convite.
- Logadas: estrutura do painel (barra com nome da oficina e menu: Pátio "em breve", Equipe e Oficina conforme permissão, Minha conta, Sair); Equipe (lista, convidar com botão de WhatsApp, pendentes, desativar/reativar, mudar perfil); Oficina (editar); Minha conta (trocar senha).

### Sessão
- `AuthProvider` com o access token em memória; ao abrir o app chama `/auth/refresh`.
- Cliente da API: em 401, uma única renovação compartilhada entre chamadas simultâneas, repete a chamada; se falhar, limpa a sessão e vai para Entrar.
- Rotas protegidas por login e por permissão; `usePermissao()` para esconder ações.

### Formulários e visual
- `react-hook-form` + `zodResolver` com os schemas de `packages/shared`.
- Estados de carregando, vazio e erro em todas as telas; 360px; toques ≥ 44px.
- Identidade visual básica definida nesta sprint com a skill `frontend-design` (cores, tipografia, espaçamentos), registrada para as próximas.

## 5. Testes e verificação
- Unitários: `senhaSchema`, `emailSchema`, mapa de permissões, geração/hash de tokens, rotação e reuso de refresh.
- E2e (API), por endpoint: caso feliz; isolamento (dono de A → 404 em usuários/convites de B); 401 sem login; 403 FUNCIONARIO em rota de DONO; desativar derruba sessão imediatamente; reuso de refresh revoga a família; login 429; esqueci-senha idêntico para e-mail existente e inexistente; flags do cookie; código de piloto de uso único; convite de uso único e expirado; último DONO protegido.
- Front: fluxo de sessão (renovar e repetir, falha leva a Entrar) e formulários principais.
- Fechamento: `revisor`, auditoria `seguranca` (relatório em `docs/auditorias/`), `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm audit --prod`.

## 6. Fora da Sprint 2
Upload da logo (Sprint 6); trocar e-mail; SMS real; login em dois fatores; login social; tela de administração de códigos de piloto; criptografia campo a campo de CPF/CNPJ.

## 7. Docs a atualizar
`02-escopo-mvp.md` (e-mail de autenticação no MVP, e-mail obrigatório, confirmação bloqueante, código de piloto, perfis com permissões); `03-arquitetura.md` (módulos, guards, sessão, notificações, Mailpit); `04-modelo-dados.md` (novas tabelas e campos); `06-seguranca.md` (decisão D7, enumeração no convite, models globais `CodigoPiloto` e tokens); `CLAUDE.md` (Mailpit e comando do código de piloto).
