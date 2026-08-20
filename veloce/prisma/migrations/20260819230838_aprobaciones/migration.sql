-- CreateEnum
CREATE TYPE "NivelAprobacion" AS ENUM ('AUTOMATICO', 'REVISION', 'BLOQUEO');

-- CreateEnum
CREATE TYPE "EstadoAprobacion" AS ENUM ('PENDIENTE', 'APROBADA', 'RECHAZADA', 'EJECUTADA', 'FALLIDA', 'ESCALADA');

-- AlterTable
ALTER TABLE "Tenant" ADD COLUMN     "facturaProveedor" TEXT,
ADD COLUMN     "facturaSandbox" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "facturaSecretoCifrado" TEXT,
ADD COLUMN     "facturaUsuario" TEXT,
ADD COLUMN     "umbralInventarioBajo" INTEGER NOT NULL DEFAULT 3;

-- CreateTable
CREATE TABLE "Aprobacion" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "accion" TEXT NOT NULL,
    "nivel" "NivelAprobacion" NOT NULL,
    "estado" "EstadoAprobacion" NOT NULL DEFAULT 'PENDIENTE',
    "argumentos" JSONB NOT NULL,
    "contexto" TEXT NOT NULL,
    "conversacionId" TEXT,
    "claveIdempotencia" TEXT NOT NULL,
    "solicitadaEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "venceEn" TIMESTAMP(3),
    "resueltaPor" TEXT,
    "resueltaEn" TIMESTAMP(3),
    "comentario" TEXT,
    "resultado" JSONB,
    "error" TEXT,

    CONSTRAINT "Aprobacion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Aprobacion_claveIdempotencia_key" ON "Aprobacion"("claveIdempotencia");

-- CreateIndex
CREATE INDEX "Aprobacion_tenantId_estado_idx" ON "Aprobacion"("tenantId", "estado");

-- CreateIndex
CREATE INDEX "Aprobacion_estado_venceEn_idx" ON "Aprobacion"("estado", "venceEn");

-- AddForeignKey
ALTER TABLE "Aprobacion" ADD CONSTRAINT "Aprobacion_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Aprobacion" ADD CONSTRAINT "Aprobacion_conversacionId_fkey" FOREIGN KEY ("conversacionId") REFERENCES "Conversacion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

