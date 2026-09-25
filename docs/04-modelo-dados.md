# 04 — Modelo de Dados

## Decisões

1. **Tudo que a oficina cadastra pertence à oficina** (`oficinaId`), inclusive `Cliente` e `Veiculo`. Se a mesma placa aparecer em duas oficinas, são dois registros de `Veiculo`, um para cada. Isso deixa a privacidade garantida por padrão e o MVP simples.
2. **Histórico universal do carro (futuro):** tabelas globais `ContaCliente` (chave = telefone verificado) e `VeiculoGlobal` (chave = placa/chassi) que *apontam* para os registros de cada oficina. O dono do carro vê tudo, e cada oficina continua vendo só o seu. Compartilhar com outra oficina exige consentimento (`Compartilhamento`). **Não implementar no MVP**, mas não criar nada que impeça isso: placa e telefone sempre normalizados.
3. Dinheiro em **centavos (Int)**.
4. IDs em `cuid()`; número da OS é sequencial **por oficina** (`numero`), controlado por `Oficina.proximoNumeroOS` dentro de uma transação.
5. `EventoOS` é a linha do tempo, append-only: o que o cliente vê é `EventoOS` com `visivelCliente = true`.
6. Orçamento enviado é imutável; mudanças = nova `versao`.
7. **Aprovação só pelo cliente, pelo link** (revisão de 24/09/2026). Não existe campo para a oficina marcar o orçamento como aprovado; `respondidoEm`, `respostaIp` e `respostaUserAgent` são a prova.
8. **Cadastro mínimo** (revisão de 24/09/2026): para abrir uma OS bastam placa, telefone do cliente e queixa. `Cliente.nome` e os dados do veículo são opcionais e completados depois.
9. **Perfis:** só `DONO` e `FUNCIONARIO`. Na oficina pequena o mecânico faz toda a operação.
10. **Isolamento por FK composta** (Sprint 1, Tarefa 4; ampliado na correção da auditoria): toda relação entre duas tabelas da oficina, obrigatória ou opcional, usa FK composta `(oficinaId, xId)` contra um `@@unique([oficinaId, id])` do lado referenciado. Isso impede, a nível de banco, que um registro da oficina A aponte para um registro da oficina B, mesmo antes de existir qualquer filtro de aplicação (extensão de tenant do Prisma, Tarefa 5).
11. **Relações opcionais com `Usuario` (`responsavel`, `autor`) e `Foto.evento` também usam FK composta** (migração `fks_tenant_restritas`), com `onDelete: NoAction`: usuário é desativado, não apagado, e um `SET NULL` composto anularia também o `oficinaId`. `NoAction` (e não `Restrict`) porque apagar uma OS remove eventos e fotos na mesma instrução, e a checagem fica para o fim da instrução. Com o campo opcional nulo, a FK não é checada (`MATCH SIMPLE`); para "tirar o responsável", o service grava `responsavelId: null`.
12. **`RefreshToken` tem `oficinaId`** (migração `fks_tenant_restritas`) e FK composta `(oficinaId, usuarioId) → Usuario(oficinaId, id)`. Está em `MODELOS_COM_TENANT`; o refresh (busca por `tokenHash` antes de existir tenant na requisição) roda dentro de `executarSemTenant`.
13. **`Convite`** guarda o convite de um novo usuário da oficina (nome, telefone/e-mail, perfil) com `tokenHash` de uso único; `criadoPor` referencia o `Usuario` que criou o convite via FK composta `(oficinaId, criadoPorId)`.
14. **`Oficina.termosVersao` / `Oficina.termosAceitosEm`**: versão dos termos de uso/LGPD aceitos no cadastro e o momento do aceite (auditoria de consentimento).
15. **`RefreshToken.familiaId`**: agrupa os refresh tokens da mesma sessão; o reuso de um token já rotacionado revoga toda a família (mitiga a ameaça T3 — tomada de conta / detecção de reuso de refresh token — ver `docs/06-seguranca.md`).
16. **`oficinaId` é imutável**: `ON UPDATE RESTRICT` em toda FK para `Oficina` e em toda FK composta, mais o trigger `impedir_troca_oficina()` (`BEFORE UPDATE`) em toda tabela com tenant, que lança erro quando `NEW."oficinaId" <> OLD."oficinaId"` (vale também para SQL cru).
17. **Escrita por relação é proibida pela extensão de tenant**: services gravam FKs escalares (`clienteId`, `responsavelId: null`); proibido connect/disconnect/set e escrita aninhada exceto create em filho com FK composta. Ver `docs/03-arquitetura.md` (Multi-tenancy) e `apps/api/src/prisma/relacoes-tenant.ts`.

## Diagrama (resumo)

```
Oficina 1─* Usuario 1─* RefreshToken
Oficina 1─* Convite *─1 Usuario (criadoPor)
Oficina 1─* Cliente 1─* Veiculo
Oficina 1─* OrdemServico *─1 Veiculo
                         *─1 Cliente
                         *─0..1 Usuario (responsavel, FK composta)
OrdemServico 1─1 ChecklistEntrada
OrdemServico 1─* EventoOS 1─* Foto
OrdemServico 1─* Orcamento 1─* ItemOrcamento
Cliente 1─* AcessoCliente
```

## Schema Prisma (real — sincronizado com `apps/api/prisma/schema.prisma`)

```prisma
generator client {
  provider     = "prisma-client"
  output       = "../src/generated/prisma"
  moduleFormat = "esm"
}

datasource db {
  provider = "postgresql"
  // Prisma 7+: a URL de conexão fica em prisma.config.ts (DATABASE_URL), não aqui.
}

enum PerfilUsuario {
  DONO
  FUNCIONARIO
}

enum StatusOS {
  TRIAGEM
  DIAGNOSTICO
  AGUARDANDO_APROVACAO
  AGUARDANDO_PECA
  EM_EXECUCAO
  PRONTO
  ENTREGUE
  CANCELADO
}

enum TipoEvento {
  OS_ABERTA
  STATUS_ALTERADO
  COMENTARIO
  FOTO
  ORCAMENTO_ENVIADO
  ORCAMENTO_RESPONDIDO
  CHECKLIST_PREENCHIDO
}

enum StatusOrcamento {
  RASCUNHO
  ENVIADO
  RESPONDIDO
  SUBSTITUIDO
}

enum TipoItem {
  PECA
  MAO_DE_OBRA
}

enum StatusItem {
  PENDENTE
  APROVADO
  RECUSADO
}

model Oficina {
  id              String   @id @default(cuid())
  nome            String
  documento       String? // CNPJ ou CPF, só dígitos
  telefone        String // E.164
  endereco        String?
  cidade          String?
  uf              String?  @db.Char(2)
  logoKey         String?
  proximoNumeroOS Int      @default(1)
  termosVersao    String // versão dos termos aceitos no cadastro (LGPD)
  termosAceitosEm DateTime
  criadoEm        DateTime @default(now())
  atualizadoEm    DateTime @updatedAt

  usuarios       Usuario[]
  refreshTokens  RefreshToken[]
  convites       Convite[]
  clientes       Cliente[]
  veiculos       Veiculo[]
  ordensServico  OrdemServico[]
  checklists     ChecklistEntrada[]
  eventos        EventoOS[]
  fotos          Foto[]
  orcamentos     Orcamento[]
  itensOrcamento ItemOrcamento[]
  acessosCliente AcessoCliente[]
}

model Usuario {
  id           String        @id @default(cuid())
  oficinaId    String
  oficina      Oficina       @relation(fields: [oficinaId], references: [id], onUpdate: Restrict)
  nome         String
  email        String?       @unique
  telefone     String?       @unique
  senhaHash    String
  perfil       PerfilUsuario
  ativo        Boolean       @default(true)
  criadoEm     DateTime      @default(now())
  atualizadoEm DateTime      @updatedAt

  refreshTokens   RefreshToken[]
  convitesCriados Convite[]
  osResponsavel   OrdemServico[] @relation("ResponsavelOS")
  eventos         EventoOS[]

  @@unique([oficinaId, id])
}

model RefreshToken {
  id         String    @id @default(cuid())
  oficinaId  String
  oficina    Oficina   @relation(fields: [oficinaId], references: [id], onUpdate: Restrict)
  usuarioId  String
  usuario    Usuario   @relation(fields: [oficinaId, usuarioId], references: [oficinaId, id], onDelete: Cascade, onUpdate: Restrict)
  familiaId  String // tokens da mesma sessão; reuso de um token revoga a família (T3)
  tokenHash  String    @unique
  expiraEm   DateTime
  revogadoEm DateTime?
  criadoEm   DateTime  @default(now())

  @@index([oficinaId, usuarioId])
  @@index([familiaId])
}

model Convite {
  id          String        @id @default(cuid())
  oficinaId   String
  oficina     Oficina       @relation(fields: [oficinaId], references: [id], onUpdate: Restrict)
  nome        String
  email       String?
  telefone    String? // E.164
  perfil      PerfilUsuario @default(FUNCIONARIO)
  tokenHash   String        @unique
  expiraEm    DateTime
  usadoEm     DateTime?
  criadoPorId String
  criadoPor   Usuario       @relation(fields: [oficinaId, criadoPorId], references: [oficinaId, id], onUpdate: Restrict)
  criadoEm    DateTime      @default(now())

  @@index([oficinaId, criadoEm])
}

model Cliente {
  id           String   @id @default(cuid())
  oficinaId    String
  oficina      Oficina  @relation(fields: [oficinaId], references: [id], onUpdate: Restrict)
  nome         String? // opcional: abertura rápida só com telefone
  telefone     String // E.164, WhatsApp
  email        String?
  documento    String?
  observacoes  String? // interno, nunca vai ao portal
  criadoEm     DateTime @default(now())
  atualizadoEm DateTime @updatedAt

  veiculos      Veiculo[]
  ordensServico OrdemServico[]
  acessos       AcessoCliente[]

  @@unique([oficinaId, id])
  @@unique([oficinaId, telefone])
  @@index([oficinaId, nome])
}

model Veiculo {
  id           String   @id @default(cuid())
  oficinaId    String
  oficina      Oficina  @relation(fields: [oficinaId], references: [id], onUpdate: Restrict)
  clienteId    String
  cliente      Cliente  @relation(fields: [oficinaId, clienteId], references: [oficinaId, id], onUpdate: Restrict)
  placa        String // normalizada: AAA0A00 / AAA0000
  marca        String?
  modelo       String?
  anoModelo    Int?
  cor          String?
  chassi       String?
  kmAtual      Int?
  criadoEm     DateTime @default(now())
  atualizadoEm DateTime @updatedAt

  ordensServico OrdemServico[]

  @@unique([oficinaId, id])
  @@unique([oficinaId, placa])
  @@index([oficinaId, clienteId])
}

model OrdemServico {
  id              String    @id @default(cuid())
  oficinaId       String
  oficina         Oficina   @relation(fields: [oficinaId], references: [id], onUpdate: Restrict)
  numero          Int
  veiculoId       String
  veiculo         Veiculo   @relation(fields: [oficinaId, veiculoId], references: [oficinaId, id], onUpdate: Restrict)
  clienteId       String
  cliente         Cliente   @relation(fields: [oficinaId, clienteId], references: [oficinaId, id], onUpdate: Restrict)
  responsavelId   String?
  responsavel     Usuario?  @relation("ResponsavelOS", fields: [oficinaId, responsavelId], references: [oficinaId, id], onDelete: NoAction, onUpdate: Restrict)
  status          StatusOS  @default(TRIAGEM)
  statusDesde     DateTime  @default(now())
  relatoCliente   String // queixa: obrigatória na abertura
  diagnostico     String?
  kmEntrada       Int?
  previsaoEntrega DateTime?
  entregueEm      DateTime?
  criadoEm        DateTime  @default(now())
  atualizadoEm    DateTime  @updatedAt

  checklist  ChecklistEntrada?
  eventos    EventoOS[]
  orcamentos Orcamento[]
  fotos      Foto[]

  @@unique([oficinaId, id])
  @@unique([oficinaId, numero])
  @@index([oficinaId, status])
  @@index([oficinaId, veiculoId])
}

model ChecklistEntrada {
  id               String       @id @default(cuid())
  oficinaId        String
  oficina          Oficina      @relation(fields: [oficinaId], references: [id], onUpdate: Restrict)
  ordemServicoId   String
  ordemServico     OrdemServico @relation(fields: [oficinaId, ordemServicoId], references: [oficinaId, id], onDelete: Cascade, onUpdate: Restrict)
  nivelCombustivel Int? // 0 a 100
  km               Int?
  itens            Json         @default("[]") // [{ chave: "estepe", presente: true }]
  avarias          Json         @default("[]") // [{ local: "porta_dianteira_esq", descricao: "risco" }]
  observacoes      String?
  criadoEm         DateTime     @default(now())

  @@unique([oficinaId, ordemServicoId])
}

model EventoOS {
  id             String       @id @default(cuid())
  oficinaId      String
  oficina        Oficina      @relation(fields: [oficinaId], references: [id], onUpdate: Restrict)
  ordemServicoId String
  ordemServico   OrdemServico @relation(fields: [oficinaId, ordemServicoId], references: [oficinaId, id], onDelete: Cascade, onUpdate: Restrict)
  autorId        String? // null = cliente/sistema
  autor          Usuario?     @relation(fields: [oficinaId, autorId], references: [oficinaId, id], onDelete: NoAction, onUpdate: Restrict)
  tipo           TipoEvento
  texto          String?
  statusDe       StatusOS?
  statusPara     StatusOS?
  visivelCliente Boolean      @default(true)
  criadoEm       DateTime     @default(now())

  fotos Foto[]

  @@unique([oficinaId, id])
  @@index([oficinaId, ordemServicoId, criadoEm])
}

model Foto {
  id             String       @id @default(cuid())
  oficinaId      String
  oficina        Oficina      @relation(fields: [oficinaId], references: [id], onUpdate: Restrict)
  ordemServicoId String
  ordemServico   OrdemServico @relation(fields: [oficinaId, ordemServicoId], references: [oficinaId, id], onDelete: Cascade, onUpdate: Restrict)
  eventoId       String?
  evento         EventoOS?    @relation(fields: [oficinaId, eventoId], references: [oficinaId, id], onDelete: NoAction, onUpdate: Restrict)
  storageKey     String
  legenda        String?
  visivelCliente Boolean      @default(true)
  criadoEm       DateTime     @default(now())

  @@index([oficinaId, ordemServicoId])
}

model Orcamento {
  id                String          @id @default(cuid())
  oficinaId         String
  oficina           Oficina         @relation(fields: [oficinaId], references: [id], onUpdate: Restrict)
  ordemServicoId    String
  ordemServico      OrdemServico    @relation(fields: [oficinaId, ordemServicoId], references: [oficinaId, id], onDelete: Cascade, onUpdate: Restrict)
  versao            Int
  status            StatusOrcamento @default(RASCUNHO)
  observacoes       String?
  validadeDias      Int             @default(7)
  enviadoEm         DateTime?
  respondidoEm      DateTime?
  respostaIp        String?
  respostaUserAgent String?
  criadoEm          DateTime        @default(now())

  itens ItemOrcamento[]

  @@unique([oficinaId, id])
  @@unique([oficinaId, ordemServicoId, versao])
}

model ItemOrcamento {
  id                    String     @id @default(cuid())
  oficinaId             String
  oficina               Oficina    @relation(fields: [oficinaId], references: [id], onUpdate: Restrict)
  orcamentoId           String
  orcamento             Orcamento  @relation(fields: [oficinaId, orcamentoId], references: [oficinaId, id], onDelete: Cascade, onUpdate: Restrict)
  tipo                  TipoItem
  descricao             String
  quantidade            Decimal    @db.Decimal(10, 3)
  valorUnitarioCentavos Int
  status                StatusItem @default(PENDENTE)
  ordem                 Int        @default(0)

  @@index([oficinaId, orcamentoId])
}

model AcessoCliente {
  id          String    @id @default(cuid())
  oficinaId   String
  oficina     Oficina   @relation(fields: [oficinaId], references: [id], onUpdate: Restrict)
  clienteId   String
  cliente     Cliente   @relation(fields: [oficinaId, clienteId], references: [oficinaId, id], onDelete: Cascade, onUpdate: Restrict)
  tokenHash   String    @unique
  expiraEm    DateTime
  revogadoEm  DateTime?
  ultimoUsoEm DateTime?
  criadoEm    DateTime  @default(now())

  @@index([oficinaId, clienteId])
}
```

## Migração inicial

- Nome: `schema_inicial_mvp` (`apps/api/prisma/migrations/<timestamp>_schema_inicial_mvp/migration.sql`).
- **FKs compostas `(oficinaId, xId)` → `(oficinaId, id)`** confirmadas na migração para: `Veiculo.oficinaId,clienteId → Cliente`, `OrdemServico.oficinaId,veiculoId → Veiculo`, `OrdemServico.oficinaId,clienteId → Cliente`, `Convite.oficinaId,criadoPorId → Usuario`, `ChecklistEntrada.oficinaId,ordemServicoId → OrdemServico`, `EventoOS.oficinaId,ordemServicoId → OrdemServico`, `Foto.oficinaId,ordemServicoId → OrdemServico`, `Orcamento.oficinaId,ordemServicoId → OrdemServico`, `ItemOrcamento.oficinaId,orcamentoId → Orcamento`, `AcessoCliente.oficinaId,clienteId → Cliente`.
- **FKs simples** (por desenho): `<Tabela>.oficinaId → Oficina`, que não precisa ser composta pois `Oficina` é a raiz do tenant. (Nesta migração inicial, `RefreshToken.usuarioId`, `OrdemServico.responsavelId`, `EventoOS.autorId` e `Foto.eventoId` ainda eram simples; viraram compostas em `fks_tenant_restritas`, abaixo.)

## Migração `fks_tenant_restritas` (correção da auditoria de 2026-09-25)

- **FKs compostas novas:** `OrdemServico.oficinaId,responsavelId → Usuario`, `EventoOS.oficinaId,autorId → Usuario`, `Foto.oficinaId,eventoId → EventoOS` (as três `ON DELETE NO ACTION`) e `RefreshToken.oficinaId,usuarioId → Usuario` (`ON DELETE CASCADE`). As FKs simples antigas dessas relações foram removidas.
- **`ON UPDATE RESTRICT`** em todas as FKs (para `Oficina` e compostas); antes eram `ON UPDATE CASCADE` (padrão do Prisma), que propagava uma troca de oficina em vez de bloquear.
- **`RefreshToken.oficinaId`**: coluna criada nula, preenchida a partir do `Usuario` dono do token e só então `NOT NULL`. Índice `@@index([usuarioId])` trocado por `@@index([oficinaId, usuarioId])`.
- **Trigger** `impedir_troca_oficina()` + um `BEFORE UPDATE ... FOR EACH ROW` por tabela com tenant (`<Tabela>_oficina_imutavel`). Adicionado à mão no `migration.sql` (o Prisma não modela triggers).
- **Limpeza:** removido `@@index([oficinaId])` de `ChecklistEntrada` (redundante com `@@unique([oficinaId, ordemServicoId])`); `Orcamento` passa de `@@unique([ordemServicoId, versao])` para `@@unique([oficinaId, ordemServicoId, versao])`, e o `@@index([oficinaId, ordemServicoId])` redundante saiu.
- **Dados inválidos:** antes de criar as FKs, a migração zera `responsavelId`/`autorId`/`eventoId` que apontam para outra oficina (só existiam como artefato dos testes da auditoria no banco de teste). Nenhum registro é apagado.

## Desvios do rascunho original (Tarefa 4, Sprint 1)

- **`ChecklistEntrada.ordemServicoId`** não pode ter `@unique` de campo único junto com a FK composta `@relation(fields: [oficinaId, ordemServicoId], references: [oficinaId, id])`: o Prisma 7 rejeita essa combinação em relações 1:1 (`P1012`, *"A one-to-one relation must use unique fields on the defining side"*). A unicidade da OS→checklist agora é garantida por `@@unique([oficinaId, ordemServicoId])`, que cumpre o mesmo papel (uma OS tem no máximo um checklist) e ainda começa por `oficinaId`.
- O gerador `prisma-client` (não `prisma-client-js`) com `output = "../src/generated/prisma"` e `moduleFormat = "esm"` foi confirmado contra os tipos do pacote `prisma@7.10.0` instalado (`prisma/config.d.ts` reexporta `defineConfig`/`env`/`PrismaConfig` de `@prisma/config`, com a mesma forma `schema`/`migrations.path`/`datasource.url` usada em `apps/api/prisma.config.ts`). **Isso é uma divergência em relação ao rascunho anterior deste documento**, que usava o gerador `prisma-client-js` (deprecado a partir do Prisma 7 em favor do novo `prisma-client`, que gera um client ESM/CJS configurável em vez do client monolítico antigo).

## Observações para implementação

- O schema foi validado com o Prisma **7.10.0** (fixado; a tag `latest` do pacote `prisma` aponta para 8.0 RC). Driver adapter `@prisma/adapter-pg`; conexão configurada em `apps/api/prisma.config.ts` (`defineConfig`/`env('DATABASE_URL')`), não no bloco `datasource` do schema.
- **Models com tenant** (filtro automático por `oficinaId` da extensão de tenant do Prisma): `Usuario`, `RefreshToken`, `Convite`, `Cliente`, `Veiculo`, `OrdemServico`, `ChecklistEntrada`, `EventoOS`, `Foto`, `Orcamento`, `ItemOrcamento`, `AcessoCliente`.
- **Escrita por relação:** services gravam FKs escalares (`clienteId`, `responsavelId: null`); proibido connect/disconnect/set e escrita aninhada exceto create em filho com FK composta. A extensão recusa o resto com `TenantViolacaoError`.
- **Relação opcional com usuário (`responsavel`, `autor`) ou com evento (`Foto.evento`) é validada pelo banco** (FK composta): um id de outra oficina dá `P2003`.
- **Mudança de status** sempre por um único método `OrdensServicoService.alterarStatus()`, que valida a transição, atualiza `statusDesde` e cria o `EventoOS` na mesma transação.
- **Total do orçamento** é calculado (não armazenado) no MVP: `Σ round(quantidade × valorUnitarioCentavos)`.
- **Futuro (Plus):** `Peca`, `MovimentoEstoque`, `Fornecedor`, `Cotacao`; `ItemOrcamento.pecaId` opcional.
- **Futuro (Ultra):** `Pagamento`, `ContaReceber`, `NotaFiscal`.
- **Futuro (histórico universal):** `ContaCliente`, `VeiculoGlobal`, `Compartilhamento`.
