-- CreateEnum
CREATE TYPE "Plan" AS ENUM ('RESPONDE', 'OPERADOR', 'AUTOPILOT');

-- CreateEnum
CREATE TYPE "RolUsuario" AS ENUM ('DUENO', 'AGENTE', 'SOPORTE_VELOCE');

-- CreateEnum
CREATE TYPE "Canal" AS ENUM ('WHATSAPP', 'INSTAGRAM');

-- CreateEnum
CREATE TYPE "Intencion" AS ENUM ('PRODUCTO', 'PRECIO_STOCK', 'ENVIO', 'ESTATUS_PEDIDO', 'DEVOLUCION', 'LEAD_CAMPANA', 'HUMANO', 'QUEJA', 'OTRO');

-- CreateEnum
CREATE TYPE "EstadoConversacion" AS ENUM ('ABIERTA', 'ESCALADA', 'CERRADA');

-- CreateEnum
CREATE TYPE "DireccionMensaje" AS ENUM ('ENTRANTE', 'SALIENTE');

-- CreateEnum
CREATE TYPE "EstadoEscalamiento" AS ENUM ('PENDIENTE', 'ATENDIDO');

-- CreateTable
CREATE TABLE "Tenant" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "plan" "Plan" NOT NULL DEFAULT 'RESPONDE',
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualEn" TIMESTAMP(3) NOT NULL,
    "tonoMarca" TEXT NOT NULL DEFAULT 'Cercano, directo y profesional. Tutea al cliente.',
    "mensajeBienvenida" TEXT NOT NULL DEFAULT '¡Hola! ¿En qué te puedo ayudar?',
    "waPhoneNumberId" TEXT,
    "waNumeroVisible" TEXT,
    "waTokenCifrado" TEXT,
    "waVerifyTokenHash" TEXT,
    "politicaEnvios" TEXT,
    "politicaCambios" TEXT,
    "politicaDevoluciones" TEXT,
    "horarios" TEXT,
    "umbralConfianza" DOUBLE PRECISION NOT NULL DEFAULT 0.7,

    CONSTRAINT "Tenant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContactoEquipo" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "telefono" TEXT NOT NULL,
    "email" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "ContactoEquipo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Usuario" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "rol" "RolUsuario" NOT NULL DEFAULT 'DUENO',
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "ultimoAcceso" TIMESTAMP(3),
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Usuario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Producto" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "sku" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "descripcion" TEXT,
    "precioCentavos" INTEGER NOT NULL,
    "moneda" TEXT NOT NULL DEFAULT 'MXN',
    "stock" INTEGER NOT NULL DEFAULT 0,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "fuente" TEXT NOT NULL DEFAULT 'manual',
    "actualEn" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Producto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Faq" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "pregunta" TEXT NOT NULL,
    "respuesta" TEXT NOT NULL,
    "etiquetas" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "actualEn" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Faq_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Contacto" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "telefono" TEXT NOT NULL,
    "nombre" TEXT,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Contacto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Conversacion" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "contactoId" TEXT NOT NULL,
    "canal" "Canal" NOT NULL DEFAULT 'WHATSAPP',
    "estado" "EstadoConversacion" NOT NULL DEFAULT 'ABIERTA',
    "intencion" "Intencion",
    "resumen" TEXT,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualEn" TIMESTAMP(3) NOT NULL,
    "primeraRespuestaMs" INTEGER,

    CONSTRAINT "Conversacion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Mensaje" (
    "id" TEXT NOT NULL,
    "conversacionId" TEXT NOT NULL,
    "direccion" "DireccionMensaje" NOT NULL,
    "texto" TEXT NOT NULL,
    "intencion" "Intencion",
    "confianza" DOUBLE PRECISION,
    "generadoPorIA" BOOLEAN NOT NULL DEFAULT false,
    "waMessageId" TEXT,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Mensaje_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Lead" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "contactoId" TEXT NOT NULL,
    "conversacionId" TEXT,
    "nombre" TEXT,
    "telefono" TEXT NOT NULL,
    "productoInteres" TEXT,
    "intencion" "Intencion",
    "resumen" TEXT,
    "origenCampana" TEXT,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Lead_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Escalamiento" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "conversacionId" TEXT NOT NULL,
    "motivo" TEXT NOT NULL,
    "resumen" TEXT NOT NULL,
    "accionSugerida" TEXT,
    "referencia" TEXT,
    "estado" "EstadoEscalamiento" NOT NULL DEFAULT 'PENDIENTE',
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atendidoEn" TIMESTAMP(3),

    CONSTRAINT "Escalamiento_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EventoAuditoria" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "actor" TEXT NOT NULL,
    "accion" TEXT NOT NULL,
    "recurso" TEXT,
    "detalle" JSONB,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EventoAuditoria_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClaveIdempotencia" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "clave" TEXT NOT NULL,
    "operacion" TEXT NOT NULL,
    "resultado" JSONB,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ClaveIdempotencia_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Tenant_slug_key" ON "Tenant"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Tenant_waPhoneNumberId_key" ON "Tenant"("waPhoneNumberId");

-- CreateIndex
CREATE INDEX "Tenant_activo_idx" ON "Tenant"("activo");

-- CreateIndex
CREATE INDEX "ContactoEquipo_tenantId_activo_idx" ON "ContactoEquipo"("tenantId", "activo");

-- CreateIndex
CREATE INDEX "Usuario_tenantId_idx" ON "Usuario"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "Usuario_tenantId_email_key" ON "Usuario"("tenantId", "email");

-- CreateIndex
CREATE INDEX "Producto_tenantId_activo_idx" ON "Producto"("tenantId", "activo");

-- CreateIndex
CREATE UNIQUE INDEX "Producto_tenantId_sku_key" ON "Producto"("tenantId", "sku");

-- CreateIndex
CREATE INDEX "Faq_tenantId_activo_idx" ON "Faq"("tenantId", "activo");

-- CreateIndex
CREATE INDEX "Contacto_tenantId_idx" ON "Contacto"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "Contacto_tenantId_telefono_key" ON "Contacto"("tenantId", "telefono");

-- CreateIndex
CREATE INDEX "Conversacion_tenantId_estado_idx" ON "Conversacion"("tenantId", "estado");

-- CreateIndex
CREATE INDEX "Conversacion_tenantId_creadoEn_idx" ON "Conversacion"("tenantId", "creadoEn");

-- CreateIndex
CREATE UNIQUE INDEX "Mensaje_waMessageId_key" ON "Mensaje"("waMessageId");

-- CreateIndex
CREATE INDEX "Mensaje_conversacionId_creadoEn_idx" ON "Mensaje"("conversacionId", "creadoEn");

-- CreateIndex
CREATE INDEX "Lead_tenantId_creadoEn_idx" ON "Lead"("tenantId", "creadoEn");

-- CreateIndex
CREATE INDEX "Escalamiento_tenantId_estado_idx" ON "Escalamiento"("tenantId", "estado");

-- CreateIndex
CREATE INDEX "EventoAuditoria_tenantId_creadoEn_idx" ON "EventoAuditoria"("tenantId", "creadoEn");

-- CreateIndex
CREATE INDEX "ClaveIdempotencia_tenantId_creadoEn_idx" ON "ClaveIdempotencia"("tenantId", "creadoEn");

-- CreateIndex
CREATE UNIQUE INDEX "ClaveIdempotencia_tenantId_clave_key" ON "ClaveIdempotencia"("tenantId", "clave");

-- AddForeignKey
ALTER TABLE "ContactoEquipo" ADD CONSTRAINT "ContactoEquipo_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Usuario" ADD CONSTRAINT "Usuario_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Producto" ADD CONSTRAINT "Producto_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Faq" ADD CONSTRAINT "Faq_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Contacto" ADD CONSTRAINT "Contacto_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Conversacion" ADD CONSTRAINT "Conversacion_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Conversacion" ADD CONSTRAINT "Conversacion_contactoId_fkey" FOREIGN KEY ("contactoId") REFERENCES "Contacto"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Mensaje" ADD CONSTRAINT "Mensaje_conversacionId_fkey" FOREIGN KEY ("conversacionId") REFERENCES "Conversacion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_contactoId_fkey" FOREIGN KEY ("contactoId") REFERENCES "Contacto"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_conversacionId_fkey" FOREIGN KEY ("conversacionId") REFERENCES "Conversacion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Escalamiento" ADD CONSTRAINT "Escalamiento_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Escalamiento" ADD CONSTRAINT "Escalamiento_conversacionId_fkey" FOREIGN KEY ("conversacionId") REFERENCES "Conversacion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventoAuditoria" ADD CONSTRAINT "EventoAuditoria_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClaveIdempotencia" ADD CONSTRAINT "ClaveIdempotencia_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
