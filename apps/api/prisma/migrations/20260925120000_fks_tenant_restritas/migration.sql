-- fks_tenant_restritas (Sprint 1, correção da auditoria 2026-09-25)
-- 1) FKs compostas (oficinaId, xId) para OrdemServico.responsavel, EventoOS.autor e Foto.evento.
-- 2) ON UPDATE RESTRICT em toda FK para Oficina e em toda FK composta (id e oficinaId nunca mudam).
-- 3) RefreshToken passa a ter oficinaId (backfill a partir do Usuario) e FK composta para Usuario.
-- 4) Trigger impedir_troca_oficina(): oficinaId é imutável em toda tabela com tenant.
-- 5) Limpeza: remove índice redundante de ChecklistEntrada; unique de Orcamento passa a incluir oficinaId.

-- DropForeignKey
ALTER TABLE "AcessoCliente" DROP CONSTRAINT "AcessoCliente_oficinaId_clienteId_fkey";

-- DropForeignKey
ALTER TABLE "AcessoCliente" DROP CONSTRAINT "AcessoCliente_oficinaId_fkey";

-- DropForeignKey
ALTER TABLE "ChecklistEntrada" DROP CONSTRAINT "ChecklistEntrada_oficinaId_fkey";

-- DropForeignKey
ALTER TABLE "ChecklistEntrada" DROP CONSTRAINT "ChecklistEntrada_oficinaId_ordemServicoId_fkey";

-- DropForeignKey
ALTER TABLE "Cliente" DROP CONSTRAINT "Cliente_oficinaId_fkey";

-- DropForeignKey
ALTER TABLE "Convite" DROP CONSTRAINT "Convite_oficinaId_criadoPorId_fkey";

-- DropForeignKey
ALTER TABLE "Convite" DROP CONSTRAINT "Convite_oficinaId_fkey";

-- DropForeignKey
ALTER TABLE "EventoOS" DROP CONSTRAINT "EventoOS_autorId_fkey";

-- DropForeignKey
ALTER TABLE "EventoOS" DROP CONSTRAINT "EventoOS_oficinaId_fkey";

-- DropForeignKey
ALTER TABLE "EventoOS" DROP CONSTRAINT "EventoOS_oficinaId_ordemServicoId_fkey";

-- DropForeignKey
ALTER TABLE "Foto" DROP CONSTRAINT "Foto_eventoId_fkey";

-- DropForeignKey
ALTER TABLE "Foto" DROP CONSTRAINT "Foto_oficinaId_fkey";

-- DropForeignKey
ALTER TABLE "Foto" DROP CONSTRAINT "Foto_oficinaId_ordemServicoId_fkey";

-- DropForeignKey
ALTER TABLE "ItemOrcamento" DROP CONSTRAINT "ItemOrcamento_oficinaId_fkey";

-- DropForeignKey
ALTER TABLE "ItemOrcamento" DROP CONSTRAINT "ItemOrcamento_oficinaId_orcamentoId_fkey";

-- DropForeignKey
ALTER TABLE "Orcamento" DROP CONSTRAINT "Orcamento_oficinaId_fkey";

-- DropForeignKey
ALTER TABLE "Orcamento" DROP CONSTRAINT "Orcamento_oficinaId_ordemServicoId_fkey";

-- DropForeignKey
ALTER TABLE "OrdemServico" DROP CONSTRAINT "OrdemServico_oficinaId_clienteId_fkey";

-- DropForeignKey
ALTER TABLE "OrdemServico" DROP CONSTRAINT "OrdemServico_oficinaId_fkey";

-- DropForeignKey
ALTER TABLE "OrdemServico" DROP CONSTRAINT "OrdemServico_oficinaId_veiculoId_fkey";

-- DropForeignKey
ALTER TABLE "OrdemServico" DROP CONSTRAINT "OrdemServico_responsavelId_fkey";

-- DropForeignKey
ALTER TABLE "RefreshToken" DROP CONSTRAINT "RefreshToken_usuarioId_fkey";

-- DropForeignKey
ALTER TABLE "Usuario" DROP CONSTRAINT "Usuario_oficinaId_fkey";

-- DropForeignKey
ALTER TABLE "Veiculo" DROP CONSTRAINT "Veiculo_oficinaId_clienteId_fkey";

-- DropForeignKey
ALTER TABLE "Veiculo" DROP CONSTRAINT "Veiculo_oficinaId_fkey";

-- DropIndex
DROP INDEX "ChecklistEntrada_oficinaId_idx";

-- DropIndex
DROP INDEX "Orcamento_oficinaId_ordemServicoId_idx";

-- DropIndex
DROP INDEX "Orcamento_ordemServicoId_versao_key";

-- DropIndex
DROP INDEX "RefreshToken_usuarioId_idx";

-- AlterTable (coluna nula, backfill pelo usuário dono do token e só então NOT NULL)
ALTER TABLE "RefreshToken" ADD COLUMN     "oficinaId" TEXT;
UPDATE "RefreshToken" r SET "oficinaId" = u."oficinaId" FROM "Usuario" u WHERE u."id" = r."usuarioId";
ALTER TABLE "RefreshToken" ALTER COLUMN "oficinaId" SET NOT NULL;

-- Dados inválidos: referências entre oficinas diferentes (só existem como artefato dos testes da
-- auditoria; é exatamente o que as FKs compostas passam a impedir). Zera a referência opcional
-- para que as novas FKs possam ser criadas. Nenhum registro é apagado.
UPDATE "OrdemServico" o SET "responsavelId" = NULL FROM "Usuario" u
  WHERE u."id" = o."responsavelId" AND u."oficinaId" <> o."oficinaId";
UPDATE "EventoOS" e SET "autorId" = NULL FROM "Usuario" u
  WHERE u."id" = e."autorId" AND u."oficinaId" <> e."oficinaId";
UPDATE "Foto" f SET "eventoId" = NULL FROM "EventoOS" e
  WHERE e."id" = f."eventoId" AND e."oficinaId" <> f."oficinaId";

-- CreateIndex
CREATE UNIQUE INDEX "Orcamento_oficinaId_ordemServicoId_versao_key" ON "Orcamento"("oficinaId", "ordemServicoId", "versao");

-- CreateIndex
CREATE INDEX "RefreshToken_oficinaId_usuarioId_idx" ON "RefreshToken"("oficinaId", "usuarioId");

-- AddForeignKey
ALTER TABLE "Usuario" ADD CONSTRAINT "Usuario_oficinaId_fkey" FOREIGN KEY ("oficinaId") REFERENCES "Oficina"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "RefreshToken" ADD CONSTRAINT "RefreshToken_oficinaId_fkey" FOREIGN KEY ("oficinaId") REFERENCES "Oficina"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "RefreshToken" ADD CONSTRAINT "RefreshToken_oficinaId_usuarioId_fkey" FOREIGN KEY ("oficinaId", "usuarioId") REFERENCES "Usuario"("oficinaId", "id") ON DELETE CASCADE ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "Convite" ADD CONSTRAINT "Convite_oficinaId_fkey" FOREIGN KEY ("oficinaId") REFERENCES "Oficina"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "Convite" ADD CONSTRAINT "Convite_oficinaId_criadoPorId_fkey" FOREIGN KEY ("oficinaId", "criadoPorId") REFERENCES "Usuario"("oficinaId", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "Cliente" ADD CONSTRAINT "Cliente_oficinaId_fkey" FOREIGN KEY ("oficinaId") REFERENCES "Oficina"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "Veiculo" ADD CONSTRAINT "Veiculo_oficinaId_fkey" FOREIGN KEY ("oficinaId") REFERENCES "Oficina"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "Veiculo" ADD CONSTRAINT "Veiculo_oficinaId_clienteId_fkey" FOREIGN KEY ("oficinaId", "clienteId") REFERENCES "Cliente"("oficinaId", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "OrdemServico" ADD CONSTRAINT "OrdemServico_oficinaId_fkey" FOREIGN KEY ("oficinaId") REFERENCES "Oficina"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "OrdemServico" ADD CONSTRAINT "OrdemServico_oficinaId_veiculoId_fkey" FOREIGN KEY ("oficinaId", "veiculoId") REFERENCES "Veiculo"("oficinaId", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "OrdemServico" ADD CONSTRAINT "OrdemServico_oficinaId_clienteId_fkey" FOREIGN KEY ("oficinaId", "clienteId") REFERENCES "Cliente"("oficinaId", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "OrdemServico" ADD CONSTRAINT "OrdemServico_oficinaId_responsavelId_fkey" FOREIGN KEY ("oficinaId", "responsavelId") REFERENCES "Usuario"("oficinaId", "id") ON DELETE NO ACTION ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "ChecklistEntrada" ADD CONSTRAINT "ChecklistEntrada_oficinaId_fkey" FOREIGN KEY ("oficinaId") REFERENCES "Oficina"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "ChecklistEntrada" ADD CONSTRAINT "ChecklistEntrada_oficinaId_ordemServicoId_fkey" FOREIGN KEY ("oficinaId", "ordemServicoId") REFERENCES "OrdemServico"("oficinaId", "id") ON DELETE CASCADE ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "EventoOS" ADD CONSTRAINT "EventoOS_oficinaId_fkey" FOREIGN KEY ("oficinaId") REFERENCES "Oficina"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "EventoOS" ADD CONSTRAINT "EventoOS_oficinaId_ordemServicoId_fkey" FOREIGN KEY ("oficinaId", "ordemServicoId") REFERENCES "OrdemServico"("oficinaId", "id") ON DELETE CASCADE ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "EventoOS" ADD CONSTRAINT "EventoOS_oficinaId_autorId_fkey" FOREIGN KEY ("oficinaId", "autorId") REFERENCES "Usuario"("oficinaId", "id") ON DELETE NO ACTION ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "Foto" ADD CONSTRAINT "Foto_oficinaId_fkey" FOREIGN KEY ("oficinaId") REFERENCES "Oficina"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "Foto" ADD CONSTRAINT "Foto_oficinaId_ordemServicoId_fkey" FOREIGN KEY ("oficinaId", "ordemServicoId") REFERENCES "OrdemServico"("oficinaId", "id") ON DELETE CASCADE ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "Foto" ADD CONSTRAINT "Foto_oficinaId_eventoId_fkey" FOREIGN KEY ("oficinaId", "eventoId") REFERENCES "EventoOS"("oficinaId", "id") ON DELETE NO ACTION ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "Orcamento" ADD CONSTRAINT "Orcamento_oficinaId_fkey" FOREIGN KEY ("oficinaId") REFERENCES "Oficina"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "Orcamento" ADD CONSTRAINT "Orcamento_oficinaId_ordemServicoId_fkey" FOREIGN KEY ("oficinaId", "ordemServicoId") REFERENCES "OrdemServico"("oficinaId", "id") ON DELETE CASCADE ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "ItemOrcamento" ADD CONSTRAINT "ItemOrcamento_oficinaId_fkey" FOREIGN KEY ("oficinaId") REFERENCES "Oficina"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "ItemOrcamento" ADD CONSTRAINT "ItemOrcamento_oficinaId_orcamentoId_fkey" FOREIGN KEY ("oficinaId", "orcamentoId") REFERENCES "Orcamento"("oficinaId", "id") ON DELETE CASCADE ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "AcessoCliente" ADD CONSTRAINT "AcessoCliente_oficinaId_fkey" FOREIGN KEY ("oficinaId") REFERENCES "Oficina"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "AcessoCliente" ADD CONSTRAINT "AcessoCliente_oficinaId_clienteId_fkey" FOREIGN KEY ("oficinaId", "clienteId") REFERENCES "Cliente"("oficinaId", "id") ON DELETE CASCADE ON UPDATE RESTRICT;


-- Trigger: oficinaId é imutável (terceira camada, depois da extensão do Prisma e das FKs compostas).
CREATE FUNCTION impedir_troca_oficina() RETURNS trigger AS $$
BEGIN
  IF NEW."oficinaId" <> OLD."oficinaId" THEN
    RAISE EXCEPTION 'oficinaId é imutável (tabela %)', TG_TABLE_NAME
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "Usuario_oficina_imutavel" BEFORE UPDATE ON "Usuario"
  FOR EACH ROW EXECUTE FUNCTION impedir_troca_oficina();

CREATE TRIGGER "RefreshToken_oficina_imutavel" BEFORE UPDATE ON "RefreshToken"
  FOR EACH ROW EXECUTE FUNCTION impedir_troca_oficina();

CREATE TRIGGER "Convite_oficina_imutavel" BEFORE UPDATE ON "Convite"
  FOR EACH ROW EXECUTE FUNCTION impedir_troca_oficina();

CREATE TRIGGER "Cliente_oficina_imutavel" BEFORE UPDATE ON "Cliente"
  FOR EACH ROW EXECUTE FUNCTION impedir_troca_oficina();

CREATE TRIGGER "Veiculo_oficina_imutavel" BEFORE UPDATE ON "Veiculo"
  FOR EACH ROW EXECUTE FUNCTION impedir_troca_oficina();

CREATE TRIGGER "OrdemServico_oficina_imutavel" BEFORE UPDATE ON "OrdemServico"
  FOR EACH ROW EXECUTE FUNCTION impedir_troca_oficina();

CREATE TRIGGER "ChecklistEntrada_oficina_imutavel" BEFORE UPDATE ON "ChecklistEntrada"
  FOR EACH ROW EXECUTE FUNCTION impedir_troca_oficina();

CREATE TRIGGER "EventoOS_oficina_imutavel" BEFORE UPDATE ON "EventoOS"
  FOR EACH ROW EXECUTE FUNCTION impedir_troca_oficina();

CREATE TRIGGER "Foto_oficina_imutavel" BEFORE UPDATE ON "Foto"
  FOR EACH ROW EXECUTE FUNCTION impedir_troca_oficina();

CREATE TRIGGER "Orcamento_oficina_imutavel" BEFORE UPDATE ON "Orcamento"
  FOR EACH ROW EXECUTE FUNCTION impedir_troca_oficina();

CREATE TRIGGER "ItemOrcamento_oficina_imutavel" BEFORE UPDATE ON "ItemOrcamento"
  FOR EACH ROW EXECUTE FUNCTION impedir_troca_oficina();

CREATE TRIGGER "AcessoCliente_oficina_imutavel" BEFORE UPDATE ON "AcessoCliente"
  FOR EACH ROW EXECUTE FUNCTION impedir_troca_oficina();
