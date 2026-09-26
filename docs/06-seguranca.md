# 06 — Segurança e Modelo de Ameaças

Referência do subagent `seguranca`. Mantenha atualizado quando surgir um fluxo novo.

## O que estamos protegendo (ativos)

| Ativo | Por que importa |
|---|---|
| Dados pessoais dos clientes (nome, telefone, e-mail, CPF, placa) | LGPD; vazamento destrói a confiança das oficinas |
| Dados comerciais da oficina (preços, orçamentos, clientes, observações internas) | Concorrente vendo isso = oficina cancela na hora |
| Fotos dos veículos | Podem mostrar placa, documentos, endereço |
| Contas dos usuários da oficina | Acesso a tudo da oficina |
| Links de acesso do cliente | Dão acesso sem senha ao carro e ao orçamento |
| Aprovações de orçamento | Evidência em caso de disputa ("eu não autorizei esse serviço") |

## Superfícies de ataque

1. **API autenticada da oficina** (`/api/v1/*`): JWT + refresh token.
2. **Portal público do cliente** (`/api/v1/portal/:token/*`): acesso só por token no link.
3. **Upload/download de arquivos**: URLs pré-assinadas do R2.
4. **Front web/PWA**: XSS, service worker, armazenamento local.
5. **Infra**: VPS/PaaS, banco, variáveis de ambiente, backups, CI.
6. **Dependências** npm.

## Ameaças principais e controles esperados

### T1 — Uma oficina acessa dados de outra (IDOR entre tenants): **crítico**
- `oficinaId` sempre do JWT via tenant context; nunca de body/query/params.
- Extensão do Prisma filtra automaticamente models com tenant e lança erro sem contexto.
- IDs são `cuid` (não sequenciais), mas **isso não é controle de acesso**.
- Recurso de outra oficina → 404.
- Teste de isolamento obrigatório em todo endpoint.
- Escritas por relação (`connect`, `set`, `connectOrCreate`, `disconnect`, `oficina: { connect }`, update/delete aninhados) não passam pelo filtro de tenant: a extensão recusa em models com tenant e na `Oficina`. Só `create`/`createMany` aninhado em filho com FK composta é permitido. Services gravam FKs escalares (`clienteId`, `responsavelId: null`).
- Toda relação entre models com tenant usa FK composta `(oficinaId, xId)`, inclusive as opcionais: um `include` a partir de FK simples não é filtrado e vazaria o registro de outra oficina.
- `oficinaId` é imutável: `ON UPDATE RESTRICT` nas FKs e trigger `impedir_troca_oficina()` no banco.
- `definirOficina` só uma vez por requisição e nunca dentro de `executarSemTenant` (lança erro); para entrar numa oficina a partir de um fluxo sem tenant, `executarComo`.
- `$queryRaw`/`$executeRaw` não passam pela extensão: filtrar `oficinaId` à mão e registrar o arquivo no teste de padrões de código.

### T2 — Abuso do link do cliente: **alto**
- Token com ≥ 32 bytes aleatórios (`crypto.randomBytes`), base64url; salvo só o SHA-256.
- Expiração (90 dias), revogação pela oficina, `ultimoUsoEm` registrado.
- Token dá acesso só ao cliente dele dentro da oficina dele.
- Rate limit agressivo no portal e resposta idêntica para token inválido/expirado/revogado (não revelar qual).
- Portal não expõe `observacoes`, eventos internos, dados da oficina além de nome/endereço/telefone.
- `Referrer-Policy: no-referrer` e `noindex` nas páginas do portal, para o token não vazar em logs de terceiros ou em buscadores.
- Aprovação do orçamento: idempotente, só em orçamento `ENVIADO` da versão atual, registra IP/user-agent/data.

### T3 — Tomada de conta de usuário da oficina: **alto** (implementado na Sprint 2)
- Senhas com argon2id (`@node-rs/argon2`); política `senhaSchema` (8–128 caracteres, recusa lista de senhas comuns embutida).
- Rate limit por rota (`@nestjs/throttler`, login 5/min por IP) **e** limite por identificador (e-mail/telefone normalizado) em memória, `LimiteTentativasService`, 5 falhas / 15 min — **só uma instância da API**: com mais de uma, mover para Postgres/Redis. Mensagem genérica (`CREDENCIAIS_INVALIDAS`) tanto para senha errada quanto para conta inexistente, com tempo de resposta equivalente (hash de senha falso quando o usuário não existe).
- Access token JWT de 15 min em memória (nunca em `localStorage`); refresh token opaco rotativo em cookie `httpOnly; Secure; SameSite=Strict; Path=/api/v1/auth`, com detecção de reuso (reuso de um token já rotacionado revoga a família toda). Tolerância de 10 s na rotação para duas abas renovando ao mesmo tempo não se derrubarem (ver `docs/03-arquitetura.md`); o front tenta a renovação de novo uma vez após 800 ms antes de limpar a sessão, e só limpa em `401` de verdade.
- Logout revoga o refresh token; desativar usuário revoga todas as sessões (listener em `USUARIO_DESATIVADO`) e o guard confere `ativo` no banco a cada requisição → o próximo request já responde 401, imediato. **Troca de senha não revoga o access token em voo**: como o guard não versiona o JWT pela senha, um access token emitido antes da troca continua válido até expirar (até 15 min depois) — só o refresh (e as sessões dos outros aparelhos) é revogado na hora. Registrado como limite conhecido; revisitar se precisar de revogação imediata de access token.
- Troca de senha exige a senha atual e revoga as sessões dos outros aparelhos; troca de e-mail fica fora da Sprint 2.
- Tokens de link (confirmar e-mail, redefinir senha, convite) com 32 bytes aleatórios, hash SHA-256, uso único, expiração curta (24 h / 1 h / 72 h) e **viajam no fragmento da URL** (`#token`), nunca em query string — não é enviado ao servidor nem aparece em logs de acesso. As telas de link só chamam a API depois de um clique explícito (proteção contra pré-visualização/antivírus do provedor de e-mail abrindo o link sozinho).
- **Enumeração aceita no piloto:** `POST /convites` e `POST /auth/cadastro` (com código de piloto válido) respondem `409 EMAIL_JA_CADASTRADO` quando o e-mail já tem conta — permite descobrir se um e-mail está cadastrado nesses dois fluxos (não no login nem no "esqueci a senha", que respondem sempre igual). Risco aceito para o piloto; revisitar se abrir cadastro público.
- **Cadastro fechado no piloto:** `CodigoPiloto` (model global, sem `oficinaId` obrigatório, fora de `MODELOS_COM_TENANT`) — hash SHA-256, uso único, validade de 30 dias, controlado por `CADASTRO_EXIGE_CODIGO` (padrão `true`). Todo acesso roda dentro de `tenant.executarSemTenant(...)`, comentado. A extensão de tenant falha **fechado**: qualquer model do schema fora de `Oficina`, `MODELOS_COM_TENANT` ou `MODELOS_GLOBAIS` lança `TenantModeloDesconhecidoError` em vez de devolver dados sem filtro — um model novo precisa ser classificado antes de ser usado.

### T4 — Escalada de privilégio dentro da oficina: **médio** (implementado na Sprint 2)
- Guard de permissões (`PermissaoGuard`) depois do guard de autenticação, com negação por padrão; endpoints declaram permissões (`EQUIPE_GERENCIAR`, `OFICINA_EDITAR`), não perfis diretamente.
- Só `DONO` gerencia usuários, convites e dados da oficina.
- Usuário não pode alterar o próprio perfil nem se desativar (`ACAO_NAO_PERMITIDA_EM_SI_MESMO`); a oficina sempre mantém pelo menos um `DONO` ativo (`ULTIMO_DONO`, 422). A checagem roda dentro de uma transação `Serializable` (com uma retentativa em `P2034`, senão `409 CONFLITO`) para fechar a corrida de duas alterações de equipe concorrentes.

### T5 — Upload malicioso / acesso indevido a arquivos: **médio**
- Bucket privado; downloads só por URL pré-assinada curta (≤ 10 min).
- Chave do objeto gerada pelo servidor com prefixo `oficinas/{oficinaId}/...`; o cliente nunca escolhe a chave.
- Ao confirmar o upload, validar que a chave pertence à oficina/OS do usuário.
- Aceitar só `image/jpeg`, `image/png`, `image/webp`, com tamanho máximo (ex.: 5 MB) na assinatura.
- Remover EXIF (GPS) das imagens.

### T6 — Injeção e XSS: **médio**
- Prisma com queries parametrizadas; `$queryRawUnsafe` proibido.
- Validação Zod em toda entrada (tipos, tamanhos máximos, enums).
- React escapa por padrão; `dangerouslySetInnerHTML` proibido.
- Texto enviado ao `wa.me` sempre com `encodeURIComponent`.
- CSP restritiva no front.

### T7 — Vazamento por logs, erros e configuração: **médio**
- Nada de stack trace na resposta em produção.
- Logs sem telefone/CPF/e-mail completos, tokens, senhas ou headers `Authorization`/`Cookie`.
- Segredos só em variáveis de ambiente; `.env` no `.gitignore`; `.env.example` sem valores reais.
- Helmet, HTTPS obrigatório, HSTS, CORS só para o domínio do front.
- Swagger só com `NODE_ENV=development` (opt-in; deploy sem `NODE_ENV` ou com `test`/`staging` não publica).
- Mensagens de erro do ORM podem conter os argumentos da query (dados pessoais): o filtro de erros loga só `name`, `code` e `meta.modelName` de erros do Prisma, nunca `message`/stack.

### T8 — Negação de serviço e abuso de custo: **baixo/médio**
- Throttler global + limites específicos (login, portal, upload-url).
- Tamanho máximo de body; paginação obrigatória com limite máximo.
- Limite de fotos por OS e de URLs de upload por minuto (protege a conta do R2).
- Atrás de proxy, configurar `trust proxy` com o número exato de saltos; nunca `true` (senão o `X-Forwarded-For` contorna o throttler).

### T9 — Dependências e cadeia de suprimentos: **médio**
- `pnpm audit` no CI; Dependabot/Renovate.
- Lockfile versionado; evitar pacotes abandonados ou com pouquíssimos downloads.

### T10 — Perda de dados: **alto**
- Backup diário automático do Postgres, com retenção de 7 a 30 dias, e **teste de restauração** mensal.
- Migrações revisadas; nunca `prisma db push` em produção.

## LGPD (mínimo)

- Oficina = **controladora**; OficinaTrack = **operadora**. Documentar isso nos termos.
- Política de privacidade e termos de uso aceitos no cadastro da oficina (guardar versão e data, `Oficina.termosVersao`/`termosAceitosEm`).
- Coletar só o necessário (CPF/CNPJ opcional em `Oficina.documento`).
- Permitir exportar e excluir/anonimizar dados de um cliente a pedido da oficina.
- Registro de incidentes: saber quem avisar e em quanto tempo (ANPD e titulares, quando aplicável).
- **D7 — sem criptografia campo a campo de CPF/CNPJ** (`Oficina.documento`): protegido só pela criptografia em repouso do provedor de banco, igual aos demais campos. Decisão de escopo para o piloto (poucas oficinas, dado opcional); **reavaliar antes de produção**, especialmente se o volume de oficinas crescer ou se CPF/CNPJ passar a ser exigido.

## Limites conhecidos (revisitar antes de produção)

- **Rate limit por identificador e lockout de login em memória** (`LimiteTentativasService`): reseta se a API reiniciar e não é compartilhado entre instâncias — funciona para o piloto (uma instância), mas precisa de storage compartilhado (Postgres/Redis) antes de escalar horizontalmente. O mesmo vale para o storage padrão do `@nestjs/throttler`.
- **Diferença pequena de tempo de resposta** em `esqueci-senha` e `reenviar-confirmacao`: o caminho "conta existe" faz uma escrita extra (criar o token) antes de responder; o caminho "conta não existe" só lê. A resposta HTTP é idêntica nos dois casos, mas o tempo pode variar o suficiente para um atacante paciente distinguir os dois casos por timing. Mitigar antes de produção movendo a criação do token para fora do caminho crítico de resposta.
- **Access token não é revogado na troca de senha** (só o refresh e as sessões dos outros aparelhos): ver T3 acima.
- **Enumeração aceita em convite e cadastro com código**: ver T3 acima.

## Quando rodar o subagent `seguranca`

- Ao final de **toda sprint**.
- Sempre que mexer em: auth, portal do cliente, upload/arquivos, tenant context/extensão Prisma, permissões, variáveis de ambiente/deploy.
- **Antes do primeiro deploy de produção** (auditoria completa) e antes de colocar cada oficina piloto.
