import { db } from "@/lib/db";
import { descifrar } from "@/lib/cifrado";
import type { ConectorTienda } from "@/lib/tienda/tipos";
import { ConectorShopify } from "@/lib/tienda/shopify";
import { ConectorWooCommerce } from "@/lib/tienda/woocommerce";
import { ConectorTiendanube } from "@/lib/tienda/tiendanube";

export * from "@/lib/tienda/tipos";

/**
 * Devuelve el conector configurado para un tenant, o null si no tiene tienda
 * conectada. Que devuelva null es un estado normal, no un error: en Fase 1 el
 * agente funciona sin conector y escala las consultas de pedido.
 */
export async function conectorDe(tenantId: string): Promise<ConectorTienda | null> {
  const t = await db.tenant.findUnique({
    where: { id: tenantId },
    select: {
      tiendaTipo: true,
      tiendaDominio: true,
      tiendaTokenCifrado: true,
      tiendaSecretoCifrado: true,
    },
  });

  if (!t || t.tiendaTipo === "NINGUNA" || !t.tiendaDominio || !t.tiendaTokenCifrado) {
    return null;
  }

  let token: string;
  let secreto: string | null = null;
  try {
    token = descifrar(t.tiendaTokenCifrado);
    if (t.tiendaSecretoCifrado) secreto = descifrar(t.tiendaSecretoCifrado);
  } catch {
    // Credenciales ilegibles: mejor operar sin conector que con basura.
    return null;
  }

  switch (t.tiendaTipo) {
    case "SHOPIFY":
      return new ConectorShopify(t.tiendaDominio, token);
    case "WOOCOMMERCE":
      // En WooCommerce el token guardado es la consumer key.
      return secreto ? new ConectorWooCommerce(t.tiendaDominio, token, secreto) : null;
    case "TIENDANUBE":
      return new ConectorTiendanube(t.tiendaDominio, token);
    default:
      return null;
  }
}

/**
 * Trae el catálogo de la tienda a la base local. El agente sigue leyendo de la
 * base —no de la API en cada mensaje— para que una caída de la plataforma no
 * deje al agente mudo, y para no gastar rate limit por conversación.
 */
export async function sincronizarCatalogo(
  tenantId: string,
): Promise<{ ok: true; importados: number } | { ok: false; error: string }> {
  const conector = await conectorDe(tenantId);
  if (!conector) return { ok: false, error: "No hay tienda conectada" };

  let productos;
  try {
    productos = await conector.listarProductos();
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Error al leer la tienda" };
  }

  let importados = 0;
  for (const p of productos) {
    await db.producto.upsert({
      where: { tenantId_sku: { tenantId, sku: p.sku } },
      create: {
        tenantId,
        sku: p.sku,
        nombre: p.nombre,
        descripcion: p.descripcion,
        precioCentavos: p.precioCentavos,
        moneda: p.moneda,
        stock: p.stock,
        fuente: conector.nombre.toLowerCase(),
      },
      update: {
        nombre: p.nombre,
        precioCentavos: p.precioCentavos,
        stock: p.stock,
        fuente: conector.nombre.toLowerCase(),
        activo: true,
      },
    });
    importados++;
  }

  await db.eventoAuditoria.create({
    data: {
      tenantId,
      actor: "sistema",
      accion: "catalogo_sincronizado",
      detalle: { conector: conector.nombre, importados },
    },
  });

  return { ok: true, importados };
}
