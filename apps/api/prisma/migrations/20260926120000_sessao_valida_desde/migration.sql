-- AlterTable
ALTER TABLE "Convite" ADD COLUMN     "reenvios" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "Usuario" ADD COLUMN     "sessaoValidaDesde" TIMESTAMP(3);

