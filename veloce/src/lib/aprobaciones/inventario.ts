import { db } from "@/lib/db";
import { enviarTexto } from "@/lib/whatsapp";

/**
 * Alertas de inventario bajo (Fase 3).
 *
 * No es una acción que requiera aprobación: sólo lee y avisa. Lo que sí exige
 * cuidado es no repetir el aviso — un sistema que manda el mismo "stock bajo"
 * cada hora acaba silenciado, y entonces no avisa de nada.
 */

export type ResultadoAlerta = {
  revisados: number;
  bajos: number;
  avisados: number;
};

/** Un aviso por producto y día: suficiente para enterarse, no para hartar. */
function claveDelDia(sku: string): string {
  const hoy = new Date().toISOString().slice(0, 10);
  return `inventario-bajo:${sku}:${hoy}`;
}

export async function revisarInventario(tenantId: string): Promise<ResultadoAlerta> {
  const tenant = await db.tenant.findUnique({
    where: { id: tenantId },
    select: {
      umbralInventarioBajo: true,
      waPhoneNumberId: true,
      waTokenCifrado: true,
      activo: true,
    },
  });
  if (!tenant?.activo) return { revisados: 0, bajos: 0, avisados: 0 };

  const revisados = await db.producto.count({ where: { tenantId, activo: true } });

  const bajos = await db.producto.findMany({
    where: { tenantId, activo: true, stock: { lte: tenant.umbralInventarioBajo } },
    orderBy: { stock: "asc" },
    select: { sku: true, nombre: true, stock: true },
  });
  if (bajos.length === 0) return { revisados, bajos: 0, avisados: 0 };

  // Se filtran los que ya se avisaron hoy antes de componer el mensaje.
  const nuevos: typeof bajos = [];
  for (const p of bajos) {
    try {
      await db.claveIdempotencia.create({
        data: { tenantId, clave: claveDelDia(p.sku), operacion: "alerta_inventario" },
      });
      nuevos.push(p);
    } catch {
      // Ya se avisó de este SKU hoy.
    }
  }
  if (nuevos.length === 0) return { revisados, bajos: bajos.length, avisados: 0 };

  const equipo = await db.contactoEquipo.findMany({
    where: { tenantId, activo: true },
    select: { telefono: true },
  });

  const lineas = nuevos.map((p) =>
    p.stock === 0 ? `· ${p.nombre} (${p.sku}): AGOTADO` : `· ${p.nombre} (${p.sku}): ${p.stock}`,
  );
  const texto = [
    "📦 Inventario bajo",
    "",
    ...lineas,
    "",
    `Umbral configurado: ${tenant.umbralInventarioBajo} piezas.`,
  ].join("\n");

  let avisados = 0;
  if (tenant.waPhoneNumberId && tenant.waTokenCifrado) {
    for (const c of equipo) {
      const envio = await enviarTexto(
        tenant.waPhoneNumberId,
        tenant.waTokenCifrado,
        c.telefono,
        texto,
      );
      if (envio.ok) avisados++;
      await db.eventoAuditoria.create({
        data: {
          tenantId,
          actor: "sistema",
          accion: envio.ok ? "alerta_inventario_enviada" : "alerta_inventario_fallida",
          detalle: {
            destinatario: c.telefono,
            skus: nuevos.map((p) => p.sku),
            error: envio.ok ? null : envio.error,
          },
        },
      });
    }
  }

  return { revisados, bajos: bajos.length, avisados };
}

/** Productos bajo el umbral, para mostrarlos en el panel. */
export async function productosBajos(tenantId: string) {
  const t = await db.tenant.findUnique({
    where: { id: tenantId },
    select: { umbralInventarioBajo: true },
  });
  if (!t) return [];
  return db.producto.findMany({
    where: { tenantId, activo: true, stock: { lte: t.umbralInventarioBajo } },
    orderBy: { stock: "asc" },
    select: { id: true, sku: true, nombre: true, stock: true },
    take: 50,
  });
}
