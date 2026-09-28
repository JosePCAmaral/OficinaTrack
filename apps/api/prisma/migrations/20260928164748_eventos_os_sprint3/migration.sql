-- AlterEnum
-- Postgres não permite usar o valor novo de um enum na mesma transação em que foi
-- criado: esta migração só adiciona os valores (nenhuma linha é escrita com eles).
ALTER TYPE "TipoEvento" ADD VALUE 'NOTA_INTERNA';
ALTER TYPE "TipoEvento" ADD VALUE 'ATUALIZACAO_CLIENTE';
ALTER TYPE "TipoEvento" ADD VALUE 'VEICULO_TRANSFERIDO';

-- AlterTable
ALTER TABLE "EventoOS" ADD COLUMN     "retiradoEm" TIMESTAMP(3),
ADD COLUMN     "retiradoPorId" TEXT;

-- AddForeignKey
ALTER TABLE "EventoOS" ADD CONSTRAINT "EventoOS_oficinaId_retiradoPorId_fkey" FOREIGN KEY ("oficinaId", "retiradoPorId") REFERENCES "Usuario"("oficinaId", "id") ON DELETE NO ACTION ON UPDATE RESTRICT;
