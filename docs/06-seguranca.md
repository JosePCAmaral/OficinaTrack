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
- **Regra de visibilidade do evento (definida na Sprint 3, portal entra na Sprint 5):** o portal só pode devolver `EventoOS` com `visivelCliente = true` **e** `retiradoEm = null`. `NOTA_INTERNA` e `VEICULO_TRANSFERIDO` são sempre `visivelCliente = false` (nunca aceito do body, sempre derivado do `tipo` em `EventosOsService.publicar`); uma `ATUALIZACAO_CLIENTE` retirada (`POST /ordens-servico/:id/eventos/:eventoId/retirar`) nunca volta a ficar visível — o registro continua no histórico interno com `retiradoEm`/`retiradoPorId`, só sai da consulta que o endpoint do portal vai usar.
- `Referrer-Policy: no-referrer` e `noindex` nas páginas do portal, para o token não vazar em logs de terceiros ou em buscadores.
- Aprovação do orçamento: idempotente, só em orçamento `ENVIADO` da versão atual, registra IP/user-agent/data.

### T3 — Tomada de conta de usuário da oficina: **alto** (implementado na Sprint 2)
- Senhas com argon2id (`@node-rs/argon2`); política `senhaSchema` (8–128 caracteres, recusa lista de senhas comuns embutida).
- Rate limit por rota (`@nestjs/throttler`, login 5/min por IP) **e** bloqueio por conta em memória, `LimiteTentativasService`, 5 falhas / 15 min. A chave é o **id do usuário** quando a conta existe (e-mail e telefone da mesma conta somam no mesmo contador) e o identificador normalizado quando não existe. O bloqueio não usa `FATOR_LIMITES` (é por conta, não por IP). Redefinir a senha pelo link do e-mail desbloqueia a conta. **Só uma instância da API**: com mais de uma, mover para Postgres/Redis. Mensagem genérica (`CREDENCIAIS_INVALIDAS`) tanto para senha errada quanto para conta inexistente, com tempo de resposta equivalente (hash de senha falso quando o usuário não existe).
- **Trade-off do bloqueio fixo (DoS de conta):** quem sabe o e-mail de um dono (não é segredo) consegue, com 5 senhas erradas a cada 15 min, mantê-lo sem conseguir entrar, mesmo com a senha certa. Sessões já abertas continuam (refresh) e "esqueci a senha" desbloqueia. Aceito no piloto. Plano: ao mover o limitador para Postgres/Redis, bloquear pelo par **(conta, IP)** com um teto global maior por conta, e avaliar atraso progressivo e desbloqueio por link no e-mail.
- Access token JWT de 15 min em memória (nunca em `localStorage`); refresh token opaco rotativo em cookie `httpOnly; Secure; SameSite=Strict; Path=/api/v1/auth`, com detecção de reuso (reuso de um token já rotacionado revoga a família toda). Tolerância de 10 s na rotação para duas abas renovando ao mesmo tempo não se derrubarem (ver `docs/03-arquitetura.md`); o front tenta a renovação de novo uma vez após 800 ms antes de limpar a sessão, e só limpa em `401` de verdade.
- **Vida do access token (regra geral):** um access token vale até expirar (≤ 15 min), inclusive depois de logout, de revogação de refresh ou de detecção de reuso: esses fluxos só matam o refresh. Ele é cortado antes disso só por `Usuario.sessaoValidaDesde`: o guard lê o usuário do banco a cada requisição e recusa (`401 NAO_AUTENTICADO`) todo access token emitido antes desse instante. O corte é gravado ao **redefinir a senha** (recuperação de conta invadida), ao **trocar a senha** e ao **desativar** o usuário (reativar não ressuscita tokens antigos). A comparação usa a claim `emitidoEmMs` (ms) do token, então um token emitido logo depois do corte, no mesmo segundo, continua valendo; tokens sem a claim caem para o `iat` em segundos.
- Logout revoga o refresh token; desativar usuário revoga todas as sessões (listener em `USUARIO_DESATIVADO`), corta os access tokens e o guard confere `ativo` no banco a cada requisição → o próximo request já responde 401.
- Troca de senha exige a senha atual (`PATCH /auth/senha` limitado a 5 por 15 min, contra chute com um access token roubado), revoga as sessões dos outros aparelhos e corta os access tokens: o aparelho que trocou recebe 401 na próxima chamada e renova pelo refresh (a família dele continua). Redefinição de senha grava senha, e-mail confirmado, revogação de todas as sessões e o corte numa transação só. Troca de e-mail fica fora da Sprint 2.
- **Limite por destinatário nos e-mails de conta:** "esqueci a senha" e "reenviar confirmação" mandam no máximo **3 links por hora para o mesmo usuário** (contados em `TokenUsuario.criadoEm`, numa transação `Serializable`), independente do IP. Acima disso, a resposta é a mesma e nada é enviado. Isso impede bombardear a caixa de um dono e inutilizar o link que ele acabou de pedir.
- **Mesmo tempo de resposta com e sem conta:** nesses dois fluxos o handler responde logo depois da busca; gerar o token e enviar o e-mail rodam em segundo plano (`SegundoPlano`, erro logado só com `erro.name`). Nos testes, `EnvioEmailMemoria.aguardarPendentes()` espera esse trabalho antes de ler os e-mails.
- Tokens de link (confirmar e-mail, redefinir senha, convite) com 32 bytes aleatórios, hash SHA-256, uso único, expiração curta (24 h / 1 h / 72 h) e **viajam no fragmento da URL** (`#token`), nunca em query string — não é enviado ao servidor nem aparece em logs de acesso. As telas de link só chamam a API depois de um clique explícito (proteção contra pré-visualização/antivírus do provedor de e-mail abrindo o link sozinho).
- **Enumeração aceita no piloto:** `POST /convites` e `POST /auth/cadastro` (com código de piloto válido) respondem `409 EMAIL_JA_CADASTRADO` quando o e-mail já tem conta — permite descobrir se um e-mail está cadastrado nesses dois fluxos (não no login nem no "esqueci a senha", que respondem sempre igual). No cadastro, o `409` não consome o código, então um código válido enumera a 5/h por IP; no convite, o throttle de 20/h limita. O cadastro também responde `409 TELEFONE_JA_CADASTRADO` para o WhatsApp opcional do dono. Risco aceito para o piloto; revisitar se abrir cadastro público.
- **Pré-sequestro de conta (risco conhecido, revisitar antes de abrir o cadastro):** (a) quem tem um código de piloto pode se cadastrar com o e-mail de outra pessoa; a conta fica sem confirmar, mas ocupa o e-mail (único no sistema) até alguém tratar. (b) O aceite de convite marca o e-mail como confirmado sem prova de posse (o link também sai pelo WhatsApp e na tela do DONO), e o telefone informado no aceite não é verificado: um DONO que digita o e-mail errado, ou mal-intencionado, pode "ocupar" e-mail ou telefone de terceiros, e o dono real do endereço errado pode tomar a conta depois pelo "esqueci a senha". Mitigações futuras: só confirmar o e-mail quando o aceite vier do link do e-mail, mostrar o destino com destaque na tela de aceite, verificar telefone quando houver SMS (auditoria 2026-09-26, #10).
- **Cadastro fechado no piloto:** `CodigoPiloto` (model global, sem `oficinaId` obrigatório, fora de `MODELOS_COM_TENANT`) — hash SHA-256, uso único, validade de 30 dias, controlado por `CADASTRO_EXIGE_CODIGO` (padrão `true`). Todo acesso roda dentro de `tenant.executarSemTenant(...)`, comentado. A extensão de tenant falha **fechado**: qualquer model do schema fora de `Oficina`, `MODELOS_COM_TENANT` ou `MODELOS_GLOBAIS` lança `TenantModeloDesconhecidoError` em vez de devolver dados sem filtro — um model novo precisa ser classificado antes de ser usado.

### T4 — Escalada de privilégio dentro da oficina: **médio** (implementado na Sprint 2)
- Guard de permissões (`PermissaoGuard`) depois do guard de autenticação, com negação por padrão; endpoints declaram permissões (`EQUIPE_GERENCIAR`, `OFICINA_EDITAR`), não perfis diretamente.
- Só `DONO` gerencia usuários, convites e dados da oficina.
- Usuário não pode alterar o próprio perfil nem se desativar (`ACAO_NAO_PERMITIDA_EM_SI_MESMO`); a oficina sempre mantém pelo menos um `DONO` ativo (`ULTIMO_DONO`, 422). A checagem roda dentro de uma transação `Serializable` (com uma retentativa no conflito de serialização, `P2034` ou `40001` no COMMIT, senão `409 CONFLITO`) para fechar a corrida de duas alterações de equipe concorrentes.
- **Persistência por convite (auditoria 2026-09-26, #1):** um DONO (sócio saindo, ou invasor com a sessão dele) cria um convite `perfil: DONO` para um e-mail que controla e, depois de desativado, rebaixado ou de a vítima redefinir a senha, aceita o convite e volta como DONO. Controles: (1) o aceite, dentro da transação, exige que o criador ainda esteja ativo e tenha `EQUIPE_GERENCIAR` (convite DONO exige criador DONO), senão `TOKEN_INVALIDO`; o `updateMany` que marca o uso reconfere `tokenHash`, `usadoEm: null` e `expiraEm`; (2) os convites pendentes criados pelo usuário são apagados quando ele é desativado (`usuario.desativado`), muda de perfil ou redefine a senha (`usuario.credenciais_alteradas`); os listeners ficam no módulo `usuarios`, dono de `Convite`; (3) o corte de access token (`sessaoValidaDesde`, T3) fecha a janela de 15 min em que um invasor criaria o convite depois da redefinição.

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
- **Validação de env de produção** (`validarEnv` com `NODE_ENV=production`): recusa `JWT_SEGREDO` igual ao placeholder do `.env.example`, começando com `troque`, igual ao segredo dos testes ou do CI, ou com menos de 43 caracteres (≈ 256 bits em base64url); recusa `FATOR_LIMITES` diferente de 1 e `EMAIL_TRANSPORTE=memoria`. O erro lista só os nomes das variáveis. `NODE_ENV` continua com padrão `development` (ergonomia em dev): **o deploy de produção precisa definir `NODE_ENV=production`**, senão essas regras não rodam.
- **SMTP com TLS obrigatório em produção:** `SMTP_SEGURO=true` (TLS implícito, 465) ou, sem ele, o transporte exige STARTTLS (`requireTLS`) quando `NODE_ENV=production`, para um MITM não rebaixar a conexão e ler os links com token. Timeouts de conexão, saudação e socket de 10 s: um SMTP travado não segura a requisição.
- **Papel do banco em produção não pode ser superusuário:** hoje o `docker-compose` usa o superusuário do Postgres. Em produção, a API conecta com um papel sem `SUPERUSER`/`BYPASSRLS`/`CREATEDB`, só DML, dono das tabelas separado; as migrações rodam com outro papel (auditoria 2026-09-26, #14). Pré-requisito de deploy.

### T8 — Negação de serviço e abuso de custo: **baixo/médio**
- Throttler global + limites específicos (login, portal, upload-url, `POST /convites` 20/h, `PATCH /auth/senha` 5/15 min).
- **Limite por destinatário em todo envio de e-mail:** "esqueci a senha" e "reenviar confirmação" no máximo 3 por hora por usuário (T3); convites com throttle de 20/h em `POST /convites` e no máximo **3 reenvios por convite** (`Convite.reenvios`; acima disso, `429 MUITAS_TENTATIVAS` "Cancele e convide de novo"). Sem isso o convite vira relay de spam/phishing saindo do nosso remetente. Cota diária por oficina contada no banco fica para quando houver cadastro aberto.
- Tamanho máximo de body; paginação obrigatória com limite máximo nas listas que crescem (OS, clientes, veículos). `GET /usuarios` e `GET /convites` ainda não paginam: são listas pequenas e limitadas por oficina (equipe e convites pendentes). Colocar um `take` máximo se isso mudar.
- Limite de fotos por OS e de URLs de upload por minuto (protege a conta do R2).
- Atrás de proxy, configurar `trust proxy` com o número exato de saltos; nunca `true` (senão o `X-Forwarded-For` contorna o throttler). **Pré-requisito de deploy:** sem isso, atrás do proxy do PaaS todos os usuários dividem um IP e os limites por rota viram globais (5 logins/min, 3 "esqueci a senha"/h e 5 cadastros/h para a plataforma inteira).

### T9 — Dependências e cadeia de suprimentos: **médio**
- `pnpm audit` no CI; Dependabot/Renovate.
- Lockfile versionado; evitar pacotes abandonados ou com pouquíssimos downloads.

### T10 — Perda de dados: **alto**
- Backup diário automático do Postgres, com retenção de 7 a 30 dias, e **teste de restauração** mensal.
- Migrações revisadas; nunca `prisma db push` em produção.

## LGPD (mínimo)

- Oficina = **controladora**; OficinaTrack = **operadora**. Documentar isso nos termos.
- Política de privacidade e termos de uso aceitos no cadastro da oficina (guardar versão e data, `Oficina.termosVersao`/`termosAceitosEm`).
- Coletar só o necessário (CPF/CNPJ opcional em `Oficina.documento`). Do dono, no cadastro: nome, e-mail, senha e WhatsApp opcional.
- **Minimização por perfil:** `GET /oficinas/atual` devolve `documento: null` para quem não tem `OFICINA_EDITAR` (em MEI, `documento` é o CPF do dono; o funcionário não precisa dele).
- Permitir exportar e excluir/anonimizar dados de um cliente a pedido da oficina.
- Registro de incidentes: saber quem avisar e em quanto tempo (ANPD e titulares, quando aplicável).
- **D7 — sem criptografia campo a campo de CPF/CNPJ** (`Oficina.documento`): protegido só pela criptografia em repouso do provedor de banco, igual aos demais campos. Decisão de escopo para o piloto (poucas oficinas, dado opcional); **reavaliar antes de produção**, especialmente se o volume de oficinas crescer ou se CPF/CNPJ passar a ser exigido.

## Limites conhecidos (revisitar antes de produção)

- **Bloqueio de login por conta em memória** (`LimiteTentativasService`): reseta se a API reiniciar e não é compartilhado entre instâncias — funciona para o piloto (uma instância), mas precisa de storage compartilhado (Postgres/Redis, chave (conta, IP)) antes de escalar horizontalmente. O mesmo vale para o storage padrão do `@nestjs/throttler`. Bloqueio fixo permite DoS de conta: ver T3.
- **Envio em segundo plano não sobrevive a um restart:** um "esqueci a senha" em andamento quando a API cai não é enviado (o usuário pede de novo). Aceito.
- **Enumeração aceita em convite e cadastro com código**: ver T3 acima.
- **Pré-sequestro de conta** (cadastro com e-mail alheio; aceite de convite confirma e-mail sem prova de posse): ver T3 acima. Revisitar antes de abrir o cadastro.
- **Pré-requisitos de deploy:** `trust proxy` (T8), papel do banco sem superusuário e SMTP com TLS (T7), `NODE_ENV=production` (T7), CSP do front (T6).

## Pendências conhecidas (Sprint 3)

Itens identificados na implementação de OS rápida, clientes/veículos e busca, deixados conscientemente para depois (baixo risco no piloto):

- **`contains` não escapa `%`/`_`:** a busca por nome (`ClientesService.buscar`, `Prisma.QueryMode.insensitive`) usa `contains` direto no termo digitado; o Prisma parametriza a consulta (sem injeção), mas um termo com `%` ou `_` amplia o `LIKE` de forma inesperada. Risco baixo (sempre filtrado por `oficinaId`, resultado limitado a 10). Revisitar ao trocar por busca aproximada (pg_trgm).
- **D4 pode ter corrida num duplo toque:** o front desabilita o botão "Criar nova mesmo assim" enquanto a mutação está em voo (`abrirOs.isPending`), mas isso não é um lock — dois toques muito rápidos antes do primeiro `disabled` renderizar podem disparar duas requisições e abrir duas OS para o mesmo carro (a checagem de OS aberta no back não usa lock adicional, diferente da reserva do número). Aceito para o piloto.
- **Texto de `VEICULO_TRANSFERIDO` cai para o telefone completo quando não há nome:** `OrdensServicoService.abrir` monta o texto do evento interno com `cliente.nome ?? cliente.telefone` — deveria usar só os 4 últimos dígitos, como o `VEICULO_DE_OUTRO_CLIENTE` (409) já faz. O evento é sempre interno (`visivelCliente = false`), mas ainda expõe mais do que o necessário a quem lê o histórico. Correção trivial, não feita nesta tarefa por ser fora do escopo (documentação/fechamento).
- **`GET /veiculos/consulta` depende da ordem de registro dos módulos:** a rota funciona porque `OrdensServicoModule` entra antes de `VeiculosModule` no `AppModule` (comentário no código nos dois arquivos). Não há teste que trave essa ordem além do e2e que confere a resposta certa; uma reordenação futura do `AppModule` pode quebrar a rota sem aviso em tempo de compilação.
- **`GET /usuarios` e `GET /convites` continuam sem paginação** (já registrado em T8): a paginação por cursor desta sprint cobriu OS, clientes e veículos; essas duas listas seguem sem `cursor`/`limite` por serem pequenas e por oficina. Colocar um `take` máximo se isso mudar.

## Quando rodar o subagent `seguranca`

- Ao final de **toda sprint**.
- Sempre que mexer em: auth, portal do cliente, upload/arquivos, tenant context/extensão Prisma, permissões, variáveis de ambiente/deploy.
- **Antes do primeiro deploy de produção** (auditoria completa) e antes de colocar cada oficina piloto.
