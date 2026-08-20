-- AlterTable
ALTER TABLE "Producto" ADD COLUMN     "lineaId" TEXT;

-- AlterTable
ALTER TABLE "Tenant" ADD COLUMN     "instruccionesExtra" TEXT,
ADD COLUMN     "limiteMensajesMes" INTEGER,
ADD COLUMN     "llmModelo" TEXT,
ADD COLUMN     "llmRazonamiento" TEXT,
ADD COLUMN     "llmTemperatura" DOUBLE PRECISION;

-- CreateTable
CREATE TABLE "LineaProducto" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "contexto" TEXT NOT NULL,
    "porDefecto" BOOLEAN NOT NULL DEFAULT false,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LineaProducto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EjemploRespuesta" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "lineaId" TEXT,
    "pregunta" TEXT NOT NULL,
    "respuesta" TEXT NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EjemploRespuesta_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UsoMensual" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "periodo" TEXT NOT NULL,
    "mensajes" INTEGER NOT NULL DEFAULT 0,
    "tokensEntrada" INTEGER NOT NULL DEFAULT 0,
    "tokensSalida" INTEGER NOT NULL DEFAULT 0,
    "actualEn" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UsoMensual_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LineaProducto_tenantId_activo_idx" ON "LineaProducto"("tenantId", "activo");

-- CreateIndex
CREATE UNIQUE INDEX "LineaProducto_tenantId_slug_key" ON "LineaProducto"("tenantId", "slug");

-- CreateIndex
CREATE INDEX "EjemploRespuesta_tenantId_activo_idx" ON "EjemploRespuesta"("tenantId", "activo");

-- CreateIndex
CREATE UNIQUE INDEX "UsoMensual_tenantId_periodo_key" ON "UsoMensual"("tenantId", "periodo");

-- AddForeignKey
ALTER TABLE "LineaProducto" ADD CONSTRAINT "LineaProducto_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EjemploRespuesta" ADD CONSTRAINT "EjemploRespuesta_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EjemploRespuesta" ADD CONSTRAINT "EjemploRespuesta_lineaId_fkey" FOREIGN KEY ("lineaId") REFERENCES "LineaProducto"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UsoMensual" ADD CONSTRAINT "UsoMensual_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Producto" ADD CONSTRAINT "Producto_lineaId_fkey" FOREIGN KEY ("lineaId") REFERENCES "LineaProducto"("id") ON DELETE SET NULL ON UPDATE CASCADE;

