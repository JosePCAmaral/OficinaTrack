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

## Diagrama (resumo)

```
Oficina 1─* Usuario
Oficina 1─* Cliente 1─* Veiculo
Oficina 1─* OrdemServico *─1 Veiculo
                         *─1 Cliente
OrdemServico 1─1 ChecklistEntrada
OrdemServico 1─* EventoOS 1─* Foto
OrdemServico 1─* Orcamento 1─* ItemOrcamento
Cliente 1─* AcessoCliente
```

## Schema Prisma (rascunho inicial)

```prisma
generator client {
  provider = "prisma-client-js"
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
  id               String   @id @default(cuid())
  nome             String
  documento        String?  // CNPJ ou CPF, só dígitos
  telefone         String   // E.164
  endereco         String?
  cidade           String?
  uf               String?  @db.Char(2)
  logoKey          String?
  proximoNumeroOS  Int      @default(1)
  criadoEm         DateTime @default(now())
  atualizadoEm     DateTime @updatedAt

  usuarios         Usuario[]
  clientes         Cliente[]
  veiculos         Veiculo[]
  ordensServico    OrdemServico[]
}

model Usuario {
  id            String        @id @default(cuid())
  oficinaId     String
  oficina       Oficina       @relation(fields: [oficinaId], references: [id])
  nome          String
  email         String?       @unique
  telefone      String?       @unique
  senhaHash     String
  perfil        PerfilUsuario
  ativo         Boolean       @default(true)
  criadoEm      DateTime      @default(now())
  atualizadoEm  DateTime      @updatedAt

  refreshTokens RefreshToken[]
  osResponsavel OrdemServico[] @relation("ResponsavelOS")
  eventos       EventoOS[]

  @@index([oficinaId])
}

model RefreshToken {
  id         String    @id @default(cuid())
  usuarioId  String
  usuario    Usuario   @relation(fields: [usuarioId], references: [id], onDelete: Cascade)
  tokenHash  String    @unique
  expiraEm   DateTime
  revogadoEm DateTime?
  criadoEm   DateTime  @default(now())

  @@index([usuarioId])
}

model Cliente {
  id           String   @id @default(cuid())
  oficinaId    String
  oficina      Oficina  @relation(fields: [oficinaId], references: [id])
  nome         String?  // opcional: abertura rápida só com telefone
  telefone     String   // E.164, WhatsApp
  email        String?
  documento    String?
  observacoes  String?  // interno, nunca vai ao portal
  criadoEm     DateTime @default(now())
  atualizadoEm DateTime @updatedAt

  veiculos     Veiculo[]
  ordensServico OrdemServico[]
  acessos      AcessoCliente[]

  @@unique([oficinaId, telefone])
  @@index([oficinaId, nome])
}

model Veiculo {
  id           String   @id @default(cuid())
  oficinaId    String
  oficina      Oficina  @relation(fields: [oficinaId], references: [id])
  clienteId    String
  cliente      Cliente  @relation(fields: [clienteId], references: [id])
  placa        String   // normalizada: AAA0A00 / AAA0000
  marca        String?
  modelo       String?
  anoModelo    Int?
  cor          String?
  chassi       String?
  kmAtual      Int?
  criadoEm     DateTime @default(now())
  atualizadoEm DateTime @updatedAt

  ordensServico OrdemServico[]

  @@unique([oficinaId, placa])
  @@index([clienteId])
}

model OrdemServico {
  id             String    @id @default(cuid())
  oficinaId      String
  oficina        Oficina   @relation(fields: [oficinaId], references: [id])
  numero         Int
  veiculoId      String
  veiculo        Veiculo   @relation(fields: [veiculoId], references: [id])
  clienteId      String
  cliente        Cliente   @relation(fields: [clienteId], references: [id])
  responsavelId  String?
  responsavel    Usuario?  @relation("ResponsavelOS", fields: [responsavelId], references: [id])
  status         StatusOS  @default(TRIAGEM)
  statusDesde    DateTime  @default(now())
  relatoCliente  String    // queixa: obrigatória na abertura
  diagnostico    String?
  kmEntrada      Int?
  previsaoEntrega DateTime?
  entregueEm     DateTime?
  criadoEm       DateTime  @default(now())
  atualizadoEm   DateTime  @updatedAt

  checklist      ChecklistEntrada?
  eventos        EventoOS[]
  orcamentos     Orcamento[]
  fotos          Foto[]

  @@unique([oficinaId, numero])
  @@index([oficinaId, status])
  @@index([veiculoId])
}

model ChecklistEntrada {
  id               String       @id @default(cuid())
  oficinaId        String
  ordemServicoId   String       @unique
  ordemServico     OrdemServico @relation(fields: [ordemServicoId], references: [id], onDelete: Cascade)
  nivelCombustivel Int?         // 0 a 100
  km               Int?
  itens            Json         // [{ chave: "estepe", presente: true }, ...]
  avarias          Json         // [{ local: "porta_dianteira_esq", descricao: "risco" }, ...]
  observacoes      String?
  criadoEm         DateTime     @default(now())
}

model EventoOS {
  id              String       @id @default(cuid())
  oficinaId       String
  ordemServicoId  String
  ordemServico    OrdemServico @relation(fields: [ordemServicoId], references: [id], onDelete: Cascade)
  autorId         String?      // null = cliente/sistema
  autor           Usuario?     @relation(fields: [autorId], references: [id])
  tipo            TipoEvento
  texto           String?
  statusDe        StatusOS?
  statusPara      StatusOS?
  visivelCliente  Boolean      @default(true)
  criadoEm        DateTime     @default(now())

  fotos           Foto[]

  @@index([ordemServicoId, criadoEm])
}

model Foto {
  id              String       @id @default(cuid())
  oficinaId       String
  ordemServicoId  String
  ordemServico    OrdemServico @relation(fields: [ordemServicoId], references: [id], onDelete: Cascade)
  eventoId        String?
  evento          EventoOS?    @relation(fields: [eventoId], references: [id])
  storageKey      String
  legenda         String?
  visivelCliente  Boolean      @default(true)
  criadoEm        DateTime     @default(now())

  @@index([ordemServicoId])
}

model Orcamento {
  id              String          @id @default(cuid())
  oficinaId       String
  ordemServicoId  String
  ordemServico    OrdemServico    @relation(fields: [ordemServicoId], references: [id], onDelete: Cascade)
  versao          Int
  status          StatusOrcamento @default(RASCUNHO)
  observacoes     String?
  validadeDias    Int             @default(7)
  enviadoEm       DateTime?
  respondidoEm    DateTime?
  respostaIp      String?
  respostaUserAgent String?
  criadoEm        DateTime        @default(now())

  itens           ItemOrcamento[]

  @@unique([ordemServicoId, versao])
}

model ItemOrcamento {
  id                  String     @id @default(cuid())
  orcamentoId         String
  orcamento           Orcamento  @relation(fields: [orcamentoId], references: [id], onDelete: Cascade)
  tipo                TipoItem
  descricao           String
  quantidade          Decimal    @db.Decimal(10, 3)
  valorUnitarioCentavos Int
  status              StatusItem @default(PENDENTE)
  ordem               Int        @default(0)
}

model AcessoCliente {
  id         String    @id @default(cuid())
  oficinaId  String
  clienteId  String
  cliente    Cliente   @relation(fields: [clienteId], references: [id], onDelete: Cascade)
  tokenHash  String    @unique
  expiraEm   DateTime
  revogadoEm DateTime?
  ultimoUsoEm DateTime?
  criadoEm   DateTime  @default(now())

  @@index([clienteId])
}
```

## Observações para implementação

- O schema foi validado com o Prisma 7. Use a versão estável mais recente e confira a documentação oficial para a configuração (`prisma.config.ts` e driver adapter `@prisma/adapter-pg`).
- **Models com tenant** (filtro automático por `oficinaId`): `Usuario`, `Cliente`, `Veiculo`, `OrdemServico`, `ChecklistEntrada`, `EventoOS`, `Foto`, `Orcamento`, `AcessoCliente`. `ItemOrcamento` herda via `Orcamento` (sempre acessar pelo orçamento).
- **Mudança de status** sempre por um único método `OrdensServicoService.alterarStatus()`, que valida a transição, atualiza `statusDesde` e cria o `EventoOS` na mesma transação.
- **Total do orçamento** é calculado (não armazenado) no MVP: `Σ round(quantidade × valorUnitarioCentavos)`.
- **Futuro (Plus):** `Peca`, `MovimentoEstoque`, `Fornecedor`, `Cotacao`; `ItemOrcamento.pecaId` opcional.
- **Futuro (Ultra):** `Pagamento`, `ContaReceber`, `NotaFiscal`.
- **Futuro (histórico universal):** `ContaCliente`, `VeiculoGlobal`, `Compartilhamento`.
