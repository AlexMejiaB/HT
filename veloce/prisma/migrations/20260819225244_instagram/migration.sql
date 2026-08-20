-- AlterTable
ALTER TABLE "Tenant" ADD COLUMN     "igCuentaId" TEXT,
ADD COLUMN     "igTokenCifrado" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Tenant_igCuentaId_key" ON "Tenant"("igCuentaId");

