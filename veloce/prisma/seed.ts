import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { createCipheriv, randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";

/**
 * Tienda piloto para probar el flujo completo sin conectar WhatsApp todavía.
 * La "definición de éxito" del brief es poder configurar una tienda, responder
 * preguntas reales y revisar las conversaciones desde un registro confiable.
 */

const db = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
});

// Mismo formato que src/lib/cifrado.ts, duplicado aquí para que el seed no
// dependa de los alias de módulo de Next.
function cifrar(texto: string): string {
  const clave = Buffer.from(process.env.CLAVE_CIFRADO!, "base64");
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", clave, iv);
  const datos = Buffer.concat([c.update(texto, "utf8"), c.final()]);
  return [iv.toString("base64"), c.getAuthTag().toString("base64"), datos.toString("base64")].join(".");
}

async function main() {
  const password = process.env.SEED_PASSWORD ?? "cambiaEstaClave123";

  const tenant = await db.tenant.upsert({
    where: { slug: "tienda-piloto" },
    update: {},
    create: {
      slug: "tienda-piloto",
      nombre: "Tienda Piloto",
      plan: "RESPONDE",
      tonoMarca: "Cercano y directo. Tutea al cliente y responde corto.",
      politicaEnvios:
        "Envíos a todo México. Zona metropolitana 1 a 2 días hábiles, resto del país 2 a 4 días hábiles. Envío gratis en compras mayores a $999 MXN.",
      politicaCambios:
        "Cambios de talla dentro de los 15 días posteriores a la entrega, con etiqueta y empaque original.",
      politicaDevoluciones:
        "Devoluciones dentro de 30 días. El reembolso lo procesa una persona del equipo.",
      horarios: "Lunes a viernes de 9:00 a 18:00, sábados de 10:00 a 14:00.",
      waTokenCifrado: cifrar("TOKEN_DE_PRUEBA_SUSTITUIR"),
    },
  });

  await db.usuario.upsert({
    where: { tenantId_email: { tenantId: tenant.id, email: "dueno@tiendapiloto.mx" } },
    update: {},
    create: {
      tenantId: tenant.id,
      email: "dueno@tiendapiloto.mx",
      nombre: "Dueño de la tienda",
      rol: "DUENO",
      passwordHash: await bcrypt.hash(password, 12),
    },
  });

  const productos = [
    { sku: "TEN-001", nombre: "Tenis Runner Negro", precioCentavos: 129900, stock: 14 },
    { sku: "TEN-002", nombre: "Tenis Runner Blanco", precioCentavos: 129900, stock: 0 },
    { sku: "MOC-010", nombre: "Mochila Urbana 20L", precioCentavos: 74900, stock: 32 },
    { sku: "GOR-004", nombre: "Gorra Clásica Bordada", precioCentavos: 29900, stock: 58 },
  ];

  for (const p of productos) {
    await db.producto.upsert({
      where: { tenantId_sku: { tenantId: tenant.id, sku: p.sku } },
      update: { precioCentavos: p.precioCentavos, stock: p.stock },
      create: { ...p, tenantId: tenant.id, descripcion: p.nombre },
    });
  }

  const faqs = [
    {
      pregunta: "¿Hacen envíos a todo México?",
      respuesta: "Sí, enviamos a todo el país por paquetería. El envío es gratis arriba de $999 MXN.",
    },
    {
      pregunta: "¿Cuánto tarda el envío?",
      respuesta: "De 1 a 2 días hábiles en zona metropolitana y de 2 a 4 días en el resto del país.",
    },
    {
      pregunta: "¿Puedo cambiar la talla?",
      respuesta: "Sí, tienes 15 días desde la entrega para cambiar talla con etiqueta y empaque original.",
    },
  ];

  for (const f of faqs) {
    const existe = await db.faq.findFirst({
      where: { tenantId: tenant.id, pregunta: f.pregunta },
      select: { id: true },
    });
    if (!existe) await db.faq.create({ data: { ...f, tenantId: tenant.id } });
  }

  console.log(`Tienda piloto lista. Entra con dueno@tiendapiloto.mx / ${password}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
