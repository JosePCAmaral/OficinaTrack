# Sprint 3 — OS rápida: especificação

**Data:** 28/09/2026 · **Épicos:** B (clientes e veículos), C1 e C3 sem fotos (`docs/02-escopo-mvp.md`) · **Branch:** `sprint-3` (a partir de `sprint-2`)

## Objetivo

O usuário da oficina abre uma OS em menos de 1 minuto pelo celular informando só placa, WhatsApp do cliente e queixa; encontra clientes e carros por placa, nome ou telefone; e registra na OS notas internas da equipe e atualizações para o cliente, separadas.

## Decisões tomadas com o usuário

| # | Decisão |
|---|---|
| D1 | **Placa já cadastrada com outro cliente:** a tela avisa e pergunta "O carro mudou de dono?". Sim → o veículo passa para o novo cliente (evento interno `VEICULO_TRANSFERIDO` na OS). Não → a OS fica em nome de quem trouxe e o veículo continua com o dono atual. Em ambos os casos, **o cliente da OS é quem trouxe o carro** (é quem recebe atualizações e, na Sprint 5, o link do portal). |
| D2 | **Duas áreas na OS:** **Notas internas** (equipe; nunca vão ao portal) e **Atualizações para o cliente** (vão ao portal; botão "Avisar no WhatsApp"). O cliente só lê; responde pelo WhatsApp (F4). Chat dentro do portal fica para depois do piloto. |
| D3 | **Atualização publicada por engano pode ser retirada** do portal por quem escreveu ou pelo dono. Nada é editado ou apagado: o evento continua no histórico interno com `retiradoEm` e `retiradoPorId`. |
| D4 | **Carro com OS aberta:** avisa ("Este carro já está na OS #0012, aberta há 2 dias") e oferece abrir a existente ou criar uma nova mesmo assim. Nunca bloqueia. |
| D5 | **Estrutura:** módulos `clientes`, `veiculos` e `ordens-servico` separados; o `OrdensServicoService` coordena a abertura usando os services públicos dos outros módulos numa única transação (mesmo padrão do cadastro da Sprint 2). |

## 1. Dados

| O quê | Mudança |
|---|---|
| `enum TipoEvento` | `COMENTARIO` é substituído por `NOTA_INTERNA` e `ATUALIZACAO_CLIENTE`; novo `VEICULO_TRANSFERIDO`. (Nenhuma linha usa `COMENTARIO` hoje; a migração confere e falha alto se houver.) |
| `EventoOS` | Novos `retiradoEm DateTime?` e `retiradoPorId String?` (FK composta `(oficinaId, retiradoPorId)` → `Usuario`, `onDelete: NoAction`, `onUpdate: Restrict`). Relação nova entra em `RELACOES_TENANT`. |
| Regras de visibilidade | `NOTA_INTERNA` e `VEICULO_TRANSFERIDO` sempre `visivelCliente = false`; `ATUALIZACAO_CLIENTE` e `OS_ABERTA` `visivelCliente = true`. **Regra do portal (Sprint 5):** só eventos com `visivelCliente = true` **e** `retiradoEm = null`. |

Já existentes e agora usados: `Oficina.proximoNumeroOS` (número sequencial por oficina, reservado na transação com `update … increment`, que trava a linha); `@@unique([oficinaId, numero])`; `Cliente @@unique([oficinaId, telefone])`; `Veiculo @@unique([oficinaId, placa])`; `OrdemServico.kmEntrada` atualiza `Veiculo.kmAtual` só se for maior.

**Busca:** um termo só; o servidor classifica: placa válida (`normalizarPlaca`) → busca por placa; telefone válido (`normalizarTelefone`) → busca por telefone; senão → nome por trecho, sem diferenciar maiúsculas (`contains`, `mode: insensitive`). Busca aproximada (pg_trgm) fica para quando houver volume.

## 2. Fluxos

1. **Abrir OS** — campos obrigatórios: placa, WhatsApp, queixa; "Mais detalhes": nome do cliente, km, responsável, previsão.
   - Ao terminar a placa: `GET /veiculos/consulta?placa=` preenche WhatsApp e nome do dono, mostra marca/modelo e avisa OS aberta (D4).
   - Ao salvar: se o servidor responder `OS_ABERTA_EXISTENTE` ou `VEICULO_DE_OUTRO_CLIENTE`, a tela mostra a pergunta e reenvia com a resposta (`criarMesmoComOsAberta: true` / `transferirVeiculo: true|false`).
   - Resultado: OS em `TRIAGEM`, evento `OS_ABERTA`, tela da OS.
2. **Tela da OS** — cabeçalho (#número, placa, veículo, cliente com botão WhatsApp, status, queixa, km, responsável, previsão); editar queixa, diagnóstico, km, responsável, previsão; abas **Atualizações para o cliente** (publicar, "Avisar no WhatsApp", retirar) e **Notas internas** (publicar). Status não muda nesta sprint.
3. **Busca, ficha do cliente, ficha do veículo** — busca única; ficha do cliente (nome, WhatsApp, e-mail e CPF opcionais, observações internas, veículos, histórico de OS nesta oficina); ficha do veículo (placa, marca, modelo, ano, cor, km, chassi, histórico). Trocar o WhatsApp para um número de outro cliente → `TELEFONE_JA_CADASTRADO`.
4. **Início do painel** — busca, lista de OS em aberto (mais recentes primeiro) e botão fixo "Abrir OS". O pátio (Sprint 4) substitui a lista.

**Permissões:** `CLIENTES_GERENCIAR`, `VEICULOS_GERENCIAR`, `OS_GERENCIAR` (DONO e FUNCIONARIO). Retirar atualização de outra pessoa exige `EQUIPE_GERENCIAR`.

**Texto do "Avisar no WhatsApp":** `Olá, {nome do cliente ou "tudo bem"}! {nome da oficina} sobre o {modelo ou placa formatada}: {texto da atualização}` com `encodeURIComponent`, para `https://wa.me/{telefone sem +}`. O link do portal entra na Sprint 5.

## 3. API (`/api/v1`, todas logadas)

| Método e rota | Permissão | Resposta |
|---|---|---|
| `GET /busca?q=` | `CLIENTES_GERENCIAR` | `{ clientes: ResumoCliente[] (≤10), veiculos: ResumoVeiculo[] (≤10) }`; `q` com 2–100 caracteres |
| `GET /veiculos/consulta?placa=` | `OS_GERENCIAR` | `{ veiculo, dono: { id, nome, telefone }, osAberta: { id, numero, criadoEm } \| null }`; placa desconhecida → 404 |
| `GET /veiculos/:id` · `PATCH /veiculos/:id` | `VEICULOS_GERENCIAR` | ficha do veículo |
| `GET /veiculos/:id/ordens-servico` | `OS_GERENCIAR` | página de `ResumoOS` |
| `GET /clientes/:id` · `PATCH /clientes/:id` | `CLIENTES_GERENCIAR` | ficha do cliente com veículos |
| `GET /clientes/:id/ordens-servico` | `OS_GERENCIAR` | página de `ResumoOS` |
| `POST /ordens-servico` | `OS_GERENCIAR` | 201 `DetalheOS` |
| `GET /ordens-servico?situacao=abertas&cursor=` | `OS_GERENCIAR` | página de `ResumoOS` ("abertas" = status diferente de `ENTREGUE` e `CANCELADO`) |
| `GET /ordens-servico/:id` · `PATCH /ordens-servico/:id` | `OS_GERENCIAR` | `DetalheOS` |
| `GET /ordens-servico/:id/eventos?cursor=` | `OS_GERENCIAR` | página de `EventoOS` (mais novos primeiro) |
| `POST /ordens-servico/:id/eventos` | `OS_GERENCIAR` | 201 evento; body `{ tipo: 'NOTA_INTERNA' \| 'ATUALIZACAO_CLIENTE', texto }` |
| `POST /ordens-servico/:id/eventos/:eventoId/retirar` | `OS_GERENCIAR` (+ `EQUIPE_GERENCIAR` se não for o autor) | 200 evento |

**Paginação:** por cursor (`?cursor=&limite=`), limite padrão 20 e máximo 50; resposta `{ itens, proximoCursor }`.

**Abrir OS (transação):** normaliza placa e telefone; cliente obter-ou-criar pelo telefone (corrida → P2002 → relê); veículo obter-ou-criar pela placa; regras D1 e D4 (409 com `details`); reserva do número; responsável ativo da oficina (`422 RESPONSAVEL_INVALIDO`); cria OS e `OS_ABERTA`; se transferiu, `VEICULO_TRANSFERIDO` (texto "Veículo transferido de {antigo} para {novo}", interno); km atualiza veículo se maior.

**Erros novos:** `VEICULO_DE_OUTRO_CLIENTE` 409 (`details: { dono: { nome, telefoneFinal } }`, só os 4 últimos dígitos), `OS_ABERTA_EXISTENTE` 409 (`details: { id, numero, criadoEm }`), `RESPONSAVEL_INVALIDO` 422, `EVENTO_NAO_RETIRAVEL` 422, `SEM_PERMISSAO` 403 (retirar de outro sem `EQUIPE_GERENCIAR`), `TELEFONE_JA_CADASTRADO` 409, `PLACA_JA_CADASTRADA` 409 (editar placa para uma existente).

**Limites de texto:** queixa ≤ 1.000; diagnóstico ≤ 2.000; nota/atualização 1–2.000; nome ≤ 120; observações ≤ 2.000; km inteiro 0–2.000.000.

**Schemas em `packages/shared`:** `abrirOsSchema`, `alterarOsSchema`, `novoEventoSchema`, `alterarClienteSchema`, `alterarVeiculoSchema`, `buscaSchema`, `paginacaoSchema`, e tipos `ResumoCliente`, `ResumoVeiculo`, `ResumoOS`, `DetalheOS`, `EventoOSDto`, `FichaCliente`, `FichaVeiculo`, `Pagina<T>`.

### Pendências da Sprint 2 (primeira tarefa)
- `testTimeout`/`hookTimeout` maiores no `vitest.config.e2e.ts` (partida a frio no CI).
- `redefinirSenha`: apagar os convites pendentes do usuário dentro da mesma transação (hoje depende do listener, cujas falhas são engolidas).
- `aceitar` convite: ler o criador com trava (`SELECT … FOR UPDATE` via `$queryRaw` parametrizado ou transação Serializable) para uma desativação simultânea não deixar passar.

## 4. Front (`apps/web`)

- **Início:** busca, lista de OS em aberto (número, placa, modelo, cliente, "aberta há X"), botão fixo "Abrir OS" (≥ 56px, canto inferior, respeitando safe-area).
- **Abrir OS:** placa em maiúsculas automáticas; WhatsApp com máscara; queixa; "Mais detalhes" recolhível (nome, km, responsável — lista da equipe ativa via `GET /usuarios` só se tiver `EQUIPE_GERENCIAR`; senão, "Eu" ou ninguém —, previsão); diálogos D1 e D4 com botões grandes.
- **OS:** cabeçalho, "Editar", abas Atualizações/Notas, "Avisar no WhatsApp", "Retirar" com confirmação; eventos retirados aparecem riscados com "Retirada por {nome} em {data}".
- **Busca:** resultados separados; **Fichas** do cliente e do veículo editáveis com histórico.
- Menu ganha **Buscar**. Estados de carregando, vazio e erro com "Tentar de novo" em todas as telas; 360px; toques ≥ 44px; datas em `America/Sao_Paulo`.

## 5. Testes

- **API (e2e):** caso feliz por endpoint; isolamento (404 da oficina B) em todos; D1 (sem resposta → 409; transferir → veículo muda de dono e evento interno; não transferir → OS com o novo cliente, veículo inalterado); D4 (409 e `criarMesmoComOsAberta`); placa/telefone em formatos diferentes acham o mesmo registro; **duas aberturas simultâneas → números distintos e consecutivos**; **mesmo telefone novo em duas aberturas simultâneas → um cliente só**; responsável de outra oficina ou inativo → 422; retirar: autor ok, outro funcionário 403, dono ok, nota interna 422, já retirada 422; nota interna sempre `visivelCliente = false`; paginação respeita o limite máximo.
- **Front:** abrir OS passando por D4 e D1; aba de notas não mostra atualizações e vice-versa; retirar; busca vazia/com resultado.
- **Fechamento:** revisão final da branch e auditoria `seguranca` (`docs/auditorias/`).

## 6. Fora da Sprint 3
Mudar status e pátio (Sprint 4); portal e link no WhatsApp (Sprint 5); fotos e registro de entrada (Sprint 6); orçamento (Sprint 7); busca aproximada por nome; trocar o dono pela ficha do veículo; apagar cliente ou veículo; chat do cliente no portal.

## 7. Docs a atualizar
`02-escopo-mvp.md` (C3 com duas áreas; D1; D4), `03-arquitetura.md` (módulos `clientes`, `veiculos`, `ordens-servico` e coordenação da abertura), `04-modelo-dados.md` (tipos de evento, `retiradoEm`/`retiradoPorId`), `06-seguranca.md` (regra do portal com `retiradoEm`; paginação implementada).
