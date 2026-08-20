-- CreateEnum
CREATE TYPE "TipoTienda" AS ENUM ('NINGUNA', 'SHOPIFY', 'WOOCOMMERCE', 'TIENDANUBE');

-- AlterTable
ALTER TABLE "Conversacion" ADD COLUMN     "etiquetas" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- AlterTable
ALTER TABLE "Tenant" ADD COLUMN     "tiendaDominio" TEXT,
ADD COLUMN     "tiendaSecretoCifrado" TEXT,
ADD COLUMN     "tiendaTipo" "TipoTienda" NOT NULL DEFAULT 'NINGUNA',
ADD COLUMN     "tiendaTokenCifrado" TEXT;
