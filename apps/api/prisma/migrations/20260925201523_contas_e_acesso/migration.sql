-- contas_e_acesso (Sprint 2, Tarefa 2)
-- 1) Usuario.email e Convite.email passam a ser obrigatórios (guardado por checagem RAISE
--    contra nulos, nunca preenchidos com valor inventado).
-- 2) Usuario.emailConfirmadoEm: momento da confirmação de e-mail (novo fluxo de conta).
-- 3) RefreshToken.substituidoEm: rotação (token trocado por outro da mesma família);
--    diferente de revogadoEm (revogação por reuso/logout).
-- 4) TokenUsuario (tenant): tokens de confirmação de e-mail e redefinição de senha, com
--    FK composta (oficinaId, usuarioId) para Usuario, igual ao padrão de fks_tenant_restritas.
-- 5) CodigoPiloto (global, sem oficinaId): códigos gerados pelo administrador para liberar
--    o cadastro no piloto; oficinaId é opcional e único (marca o código como já usado por
--    aquela oficina), com FK simples para Oficina (Oficina é a raiz do tenant).
-- 6) Trigger impedir_troca_oficina() (criada em fks_tenant_restritas) também em TokenUsuario.

-- CreateEnum
CREATE TYPE "TipoTokenUsuario" AS ENUM ('CONFIRMAR_EMAIL', 'REDEFINIR_SENHA');

-- Guarda de dados: nunca inventa e-mail para preencher a coluna. Se houver nulos, a migração
-- falha alto e precisa ser corrigida a mão antes de reaplicar.
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM "Usuario" WHERE "email" IS NULL) OR EXISTS (SELECT 1 FROM "Convite" WHERE "email" IS NULL) THEN
    RAISE EXCEPTION 'Há usuários ou convites sem e-mail; preencha antes de aplicar esta migração';
  END IF;
END $$;

-- AlterTable
ALTER TABLE "Convite" ALTER COLUMN "email" SET NOT NULL;

-- AlterTable
ALTER TABLE "RefreshToken" ADD COLUMN     "substituidoEm" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Usuario" ADD COLUMN     "emailConfirmadoEm" TIMESTAMP(3),
ALTER COLUMN "email" SET NOT NULL;

-- CreateTable
CREATE TABLE "TokenUsuario" (
    "id" TEXT NOT NULL,
    "oficinaId" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "tipo" "TipoTokenUsuario" NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiraEm" TIMESTAMP(3) NOT NULL,
    "usadoEm" TIMESTAMP(3),
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TokenUsuario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CodigoPiloto" (
    "id" TEXT NOT NULL,
    "codigoHash" TEXT NOT NULL,
    "descricao" TEXT NOT NULL,
    "expiraEm" TIMESTAMP(3) NOT NULL,
    "usadoEm" TIMESTAMP(3),
    "oficinaId" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CodigoPiloto_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TokenUsuario_tokenHash_key" ON "TokenUsuario"("tokenHash");

-- CreateIndex
CREATE INDEX "TokenUsuario_oficinaId_usuarioId_tipo_idx" ON "TokenUsuario"("oficinaId", "usuarioId", "tipo");

-- CreateIndex
CREATE UNIQUE INDEX "CodigoPiloto_codigoHash_key" ON "CodigoPiloto"("codigoHash");

-- CreateIndex
CREATE UNIQUE INDEX "CodigoPiloto_oficinaId_key" ON "CodigoPiloto"("oficinaId");

-- AddForeignKey
ALTER TABLE "TokenUsuario" ADD CONSTRAINT "TokenUsuario_oficinaId_fkey" FOREIGN KEY ("oficinaId") REFERENCES "Oficina"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "TokenUsuario" ADD CONSTRAINT "TokenUsuario_oficinaId_usuarioId_fkey" FOREIGN KEY ("oficinaId", "usuarioId") REFERENCES "Usuario"("oficinaId", "id") ON DELETE CASCADE ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "CodigoPiloto" ADD CONSTRAINT "CodigoPiloto_oficinaId_fkey" FOREIGN KEY ("oficinaId") REFERENCES "Oficina"("id") ON DELETE SET NULL ON UPDATE RESTRICT;

-- Trigger: oficinaId é imutável em TokenUsuario, mesmo padrão de fks_tenant_restritas
-- (a função impedir_troca_oficina() já existe, criada naquela migração).
CREATE TRIGGER "TokenUsuario_oficina_imutavel" BEFORE UPDATE ON "TokenUsuario"
  FOR EACH ROW EXECUTE FUNCTION impedir_troca_oficina();
