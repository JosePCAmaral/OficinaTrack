-- CreateEnum
CREATE TYPE "PerfilUsuario" AS ENUM ('DONO', 'FUNCIONARIO');

-- CreateEnum
CREATE TYPE "StatusOS" AS ENUM ('TRIAGEM', 'DIAGNOSTICO', 'AGUARDANDO_APROVACAO', 'AGUARDANDO_PECA', 'EM_EXECUCAO', 'PRONTO', 'ENTREGUE', 'CANCELADO');

-- CreateEnum
CREATE TYPE "TipoEvento" AS ENUM ('OS_ABERTA', 'STATUS_ALTERADO', 'COMENTARIO', 'FOTO', 'ORCAMENTO_ENVIADO', 'ORCAMENTO_RESPONDIDO', 'CHECKLIST_PREENCHIDO');

-- CreateEnum
CREATE TYPE "StatusOrcamento" AS ENUM ('RASCUNHO', 'ENVIADO', 'RESPONDIDO', 'SUBSTITUIDO');

-- CreateEnum
CREATE TYPE "TipoItem" AS ENUM ('PECA', 'MAO_DE_OBRA');

-- CreateEnum
CREATE TYPE "StatusItem" AS ENUM ('PENDENTE', 'APROVADO', 'RECUSADO');

-- CreateTable
CREATE TABLE "Oficina" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "documento" TEXT,
    "telefone" TEXT NOT NULL,
    "endereco" TEXT,
    "cidade" TEXT,
    "uf" CHAR(2),
    "logoKey" TEXT,
    "proximoNumeroOS" INTEGER NOT NULL DEFAULT 1,
    "termosVersao" TEXT NOT NULL,
    "termosAceitosEm" TIMESTAMP(3) NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Oficina_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Usuario" (
    "id" TEXT NOT NULL,
    "oficinaId" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "email" TEXT,
    "telefone" TEXT,
    "senhaHash" TEXT NOT NULL,
    "perfil" "PerfilUsuario" NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Usuario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RefreshToken" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "familiaId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiraEm" TIMESTAMP(3) NOT NULL,
    "revogadoEm" TIMESTAMP(3),
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RefreshToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Convite" (
    "id" TEXT NOT NULL,
    "oficinaId" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "email" TEXT,
    "telefone" TEXT,
    "perfil" "PerfilUsuario" NOT NULL DEFAULT 'FUNCIONARIO',
    "tokenHash" TEXT NOT NULL,
    "expiraEm" TIMESTAMP(3) NOT NULL,
    "usadoEm" TIMESTAMP(3),
    "criadoPorId" TEXT NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Convite_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Cliente" (
    "id" TEXT NOT NULL,
    "oficinaId" TEXT NOT NULL,
    "nome" TEXT,
    "telefone" TEXT NOT NULL,
    "email" TEXT,
    "documento" TEXT,
    "observacoes" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Cliente_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Veiculo" (
    "id" TEXT NOT NULL,
    "oficinaId" TEXT NOT NULL,
    "clienteId" TEXT NOT NULL,
    "placa" TEXT NOT NULL,
    "marca" TEXT,
    "modelo" TEXT,
    "anoModelo" INTEGER,
    "cor" TEXT,
    "chassi" TEXT,
    "kmAtual" INTEGER,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Veiculo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrdemServico" (
    "id" TEXT NOT NULL,
    "oficinaId" TEXT NOT NULL,
    "numero" INTEGER NOT NULL,
    "veiculoId" TEXT NOT NULL,
    "clienteId" TEXT NOT NULL,
    "responsavelId" TEXT,
    "status" "StatusOS" NOT NULL DEFAULT 'TRIAGEM',
    "statusDesde" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "relatoCliente" TEXT NOT NULL,
    "diagnostico" TEXT,
    "kmEntrada" INTEGER,
    "previsaoEntrega" TIMESTAMP(3),
    "entregueEm" TIMESTAMP(3),
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrdemServico_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChecklistEntrada" (
    "id" TEXT NOT NULL,
    "oficinaId" TEXT NOT NULL,
    "ordemServicoId" TEXT NOT NULL,
    "nivelCombustivel" INTEGER,
    "km" INTEGER,
    "itens" JSONB NOT NULL DEFAULT '[]',
    "avarias" JSONB NOT NULL DEFAULT '[]',
    "observacoes" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChecklistEntrada_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EventoOS" (
    "id" TEXT NOT NULL,
    "oficinaId" TEXT NOT NULL,
    "ordemServicoId" TEXT NOT NULL,
    "autorId" TEXT,
    "tipo" "TipoEvento" NOT NULL,
    "texto" TEXT,
    "statusDe" "StatusOS",
    "statusPara" "StatusOS",
    "visivelCliente" BOOLEAN NOT NULL DEFAULT true,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EventoOS_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Foto" (
    "id" TEXT NOT NULL,
    "oficinaId" TEXT NOT NULL,
    "ordemServicoId" TEXT NOT NULL,
    "eventoId" TEXT,
    "storageKey" TEXT NOT NULL,
    "legenda" TEXT,
    "visivelCliente" BOOLEAN NOT NULL DEFAULT true,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Foto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Orcamento" (
    "id" TEXT NOT NULL,
    "oficinaId" TEXT NOT NULL,
    "ordemServicoId" TEXT NOT NULL,
    "versao" INTEGER NOT NULL,
    "status" "StatusOrcamento" NOT NULL DEFAULT 'RASCUNHO',
    "observacoes" TEXT,
    "validadeDias" INTEGER NOT NULL DEFAULT 7,
    "enviadoEm" TIMESTAMP(3),
    "respondidoEm" TIMESTAMP(3),
    "respostaIp" TEXT,
    "respostaUserAgent" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Orcamento_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ItemOrcamento" (
    "id" TEXT NOT NULL,
    "oficinaId" TEXT NOT NULL,
    "orcamentoId" TEXT NOT NULL,
    "tipo" "TipoItem" NOT NULL,
    "descricao" TEXT NOT NULL,
    "quantidade" DECIMAL(10,3) NOT NULL,
    "valorUnitarioCentavos" INTEGER NOT NULL,
    "status" "StatusItem" NOT NULL DEFAULT 'PENDENTE',
    "ordem" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ItemOrcamento_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AcessoCliente" (
    "id" TEXT NOT NULL,
    "oficinaId" TEXT NOT NULL,
    "clienteId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiraEm" TIMESTAMP(3) NOT NULL,
    "revogadoEm" TIMESTAMP(3),
    "ultimoUsoEm" TIMESTAMP(3),
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AcessoCliente_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Usuario_email_key" ON "Usuario"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Usuario_telefone_key" ON "Usuario"("telefone");

-- CreateIndex
CREATE UNIQUE INDEX "Usuario_oficinaId_id_key" ON "Usuario"("oficinaId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "RefreshToken_tokenHash_key" ON "RefreshToken"("tokenHash");

-- CreateIndex
CREATE INDEX "RefreshToken_usuarioId_idx" ON "RefreshToken"("usuarioId");

-- CreateIndex
CREATE INDEX "RefreshToken_familiaId_idx" ON "RefreshToken"("familiaId");

-- CreateIndex
CREATE UNIQUE INDEX "Convite_tokenHash_key" ON "Convite"("tokenHash");

-- CreateIndex
CREATE INDEX "Convite_oficinaId_criadoEm_idx" ON "Convite"("oficinaId", "criadoEm");

-- CreateIndex
CREATE INDEX "Cliente_oficinaId_nome_idx" ON "Cliente"("oficinaId", "nome");

-- CreateIndex
CREATE UNIQUE INDEX "Cliente_oficinaId_id_key" ON "Cliente"("oficinaId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "Cliente_oficinaId_telefone_key" ON "Cliente"("oficinaId", "telefone");

-- CreateIndex
CREATE INDEX "Veiculo_oficinaId_clienteId_idx" ON "Veiculo"("oficinaId", "clienteId");

-- CreateIndex
CREATE UNIQUE INDEX "Veiculo_oficinaId_id_key" ON "Veiculo"("oficinaId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "Veiculo_oficinaId_placa_key" ON "Veiculo"("oficinaId", "placa");

-- CreateIndex
CREATE INDEX "OrdemServico_oficinaId_status_idx" ON "OrdemServico"("oficinaId", "status");

-- CreateIndex
CREATE INDEX "OrdemServico_oficinaId_veiculoId_idx" ON "OrdemServico"("oficinaId", "veiculoId");

-- CreateIndex
CREATE UNIQUE INDEX "OrdemServico_oficinaId_id_key" ON "OrdemServico"("oficinaId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "OrdemServico_oficinaId_numero_key" ON "OrdemServico"("oficinaId", "numero");

-- CreateIndex
CREATE INDEX "ChecklistEntrada_oficinaId_idx" ON "ChecklistEntrada"("oficinaId");

-- CreateIndex
CREATE UNIQUE INDEX "ChecklistEntrada_oficinaId_ordemServicoId_key" ON "ChecklistEntrada"("oficinaId", "ordemServicoId");

-- CreateIndex
CREATE INDEX "EventoOS_oficinaId_ordemServicoId_criadoEm_idx" ON "EventoOS"("oficinaId", "ordemServicoId", "criadoEm");

-- CreateIndex
CREATE UNIQUE INDEX "EventoOS_oficinaId_id_key" ON "EventoOS"("oficinaId", "id");

-- CreateIndex
CREATE INDEX "Foto_oficinaId_ordemServicoId_idx" ON "Foto"("oficinaId", "ordemServicoId");

-- CreateIndex
CREATE INDEX "Orcamento_oficinaId_ordemServicoId_idx" ON "Orcamento"("oficinaId", "ordemServicoId");

-- CreateIndex
CREATE UNIQUE INDEX "Orcamento_oficinaId_id_key" ON "Orcamento"("oficinaId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "Orcamento_ordemServicoId_versao_key" ON "Orcamento"("ordemServicoId", "versao");

-- CreateIndex
CREATE INDEX "ItemOrcamento_oficinaId_orcamentoId_idx" ON "ItemOrcamento"("oficinaId", "orcamentoId");

-- CreateIndex
CREATE UNIQUE INDEX "AcessoCliente_tokenHash_key" ON "AcessoCliente"("tokenHash");

-- CreateIndex
CREATE INDEX "AcessoCliente_oficinaId_clienteId_idx" ON "AcessoCliente"("oficinaId", "clienteId");

-- AddForeignKey
ALTER TABLE "Usuario" ADD CONSTRAINT "Usuario_oficinaId_fkey" FOREIGN KEY ("oficinaId") REFERENCES "Oficina"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RefreshToken" ADD CONSTRAINT "RefreshToken_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Convite" ADD CONSTRAINT "Convite_oficinaId_fkey" FOREIGN KEY ("oficinaId") REFERENCES "Oficina"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Convite" ADD CONSTRAINT "Convite_oficinaId_criadoPorId_fkey" FOREIGN KEY ("oficinaId", "criadoPorId") REFERENCES "Usuario"("oficinaId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Cliente" ADD CONSTRAINT "Cliente_oficinaId_fkey" FOREIGN KEY ("oficinaId") REFERENCES "Oficina"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Veiculo" ADD CONSTRAINT "Veiculo_oficinaId_fkey" FOREIGN KEY ("oficinaId") REFERENCES "Oficina"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Veiculo" ADD CONSTRAINT "Veiculo_oficinaId_clienteId_fkey" FOREIGN KEY ("oficinaId", "clienteId") REFERENCES "Cliente"("oficinaId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrdemServico" ADD CONSTRAINT "OrdemServico_oficinaId_fkey" FOREIGN KEY ("oficinaId") REFERENCES "Oficina"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrdemServico" ADD CONSTRAINT "OrdemServico_oficinaId_veiculoId_fkey" FOREIGN KEY ("oficinaId", "veiculoId") REFERENCES "Veiculo"("oficinaId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrdemServico" ADD CONSTRAINT "OrdemServico_oficinaId_clienteId_fkey" FOREIGN KEY ("oficinaId", "clienteId") REFERENCES "Cliente"("oficinaId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrdemServico" ADD CONSTRAINT "OrdemServico_responsavelId_fkey" FOREIGN KEY ("responsavelId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChecklistEntrada" ADD CONSTRAINT "ChecklistEntrada_oficinaId_fkey" FOREIGN KEY ("oficinaId") REFERENCES "Oficina"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChecklistEntrada" ADD CONSTRAINT "ChecklistEntrada_oficinaId_ordemServicoId_fkey" FOREIGN KEY ("oficinaId", "ordemServicoId") REFERENCES "OrdemServico"("oficinaId", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventoOS" ADD CONSTRAINT "EventoOS_oficinaId_fkey" FOREIGN KEY ("oficinaId") REFERENCES "Oficina"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventoOS" ADD CONSTRAINT "EventoOS_oficinaId_ordemServicoId_fkey" FOREIGN KEY ("oficinaId", "ordemServicoId") REFERENCES "OrdemServico"("oficinaId", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventoOS" ADD CONSTRAINT "EventoOS_autorId_fkey" FOREIGN KEY ("autorId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Foto" ADD CONSTRAINT "Foto_oficinaId_fkey" FOREIGN KEY ("oficinaId") REFERENCES "Oficina"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Foto" ADD CONSTRAINT "Foto_oficinaId_ordemServicoId_fkey" FOREIGN KEY ("oficinaId", "ordemServicoId") REFERENCES "OrdemServico"("oficinaId", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Foto" ADD CONSTRAINT "Foto_eventoId_fkey" FOREIGN KEY ("eventoId") REFERENCES "EventoOS"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Orcamento" ADD CONSTRAINT "Orcamento_oficinaId_fkey" FOREIGN KEY ("oficinaId") REFERENCES "Oficina"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Orcamento" ADD CONSTRAINT "Orcamento_oficinaId_ordemServicoId_fkey" FOREIGN KEY ("oficinaId", "ordemServicoId") REFERENCES "OrdemServico"("oficinaId", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ItemOrcamento" ADD CONSTRAINT "ItemOrcamento_oficinaId_fkey" FOREIGN KEY ("oficinaId") REFERENCES "Oficina"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ItemOrcamento" ADD CONSTRAINT "ItemOrcamento_oficinaId_orcamentoId_fkey" FOREIGN KEY ("oficinaId", "orcamentoId") REFERENCES "Orcamento"("oficinaId", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AcessoCliente" ADD CONSTRAINT "AcessoCliente_oficinaId_fkey" FOREIGN KEY ("oficinaId") REFERENCES "Oficina"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AcessoCliente" ADD CONSTRAINT "AcessoCliente_oficinaId_clienteId_fkey" FOREIGN KEY ("oficinaId", "clienteId") REFERENCES "Cliente"("oficinaId", "id") ON DELETE CASCADE ON UPDATE CASCADE;
