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

### T3 — Tomada de conta de usuário da oficina: **alto**
- Senhas com argon2id; política mínima de 8+ caracteres e checagem contra senhas comuns.
- Rate limit + atraso progressivo no login; mensagem genérica ("e-mail ou senha inválidos").
- Access token curto (15 min) em memória; refresh token rotativo em cookie `httpOnly; Secure; SameSite=Strict`, com detecção de reuso (reuso = revoga a família toda).
- Logout revoga o refresh token; desativar usuário revoga todos.
- Troca de senha/e-mail exige a senha atual.
- Convites com token de uso único e expiração curta.

### T4 — Escalada de privilégio dentro da oficina: **médio**
- Guard de perfil (`DONO`, `FUNCIONARIO`) em cada rota, com negação por padrão.
- Só `DONO` gerencia usuários e dados da oficina.
- Usuário não pode alterar o próprio perfil.

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
- Política de privacidade e termos de uso aceitos no cadastro da oficina (guardar versão e data).
- Coletar só o necessário (CPF opcional).
- Permitir exportar e excluir/anonimizar dados de um cliente a pedido da oficina.
- Registro de incidentes: saber quem avisar e em quanto tempo (ANPD e titulares, quando aplicável).

## Quando rodar o subagent `seguranca`

- Ao final de **toda sprint**.
- Sempre que mexer em: auth, portal do cliente, upload/arquivos, tenant context/extensão Prisma, permissões, variáveis de ambiente/deploy.
- **Antes do primeiro deploy de produção** (auditoria completa) e antes de colocar cada oficina piloto.
