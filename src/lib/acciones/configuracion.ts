"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { leerSesion } from "@/lib/sesion";
import { exigirPermisoEnAccion } from "@/lib/permisos";

/**
 * Acciones del panel.
 *
 * Regla de aislamiento: el tenantId sale SIEMPRE de la sesión, nunca del
 * formulario. Si viniera del cliente, cualquiera podría editar el catálogo de
 * otra tienda cambiando un campo oculto.
 */
async function exigirSesion() {
  const sesion = await leerSesion();
  if (!sesion) throw new Error("No autenticado");
  return sesion;
}

/**
 * Toda escritura de configuración exige el permiso, no sólo estar autenticado.
 * Proteger la página y dejar la acción abierta es la forma más común de que un
 * control de acceso no sirva de nada.
 */
async function exigirConfigurar() {
  return exigirPermisoEnAccion("configurar");
}

async function auditar(tenantId: string, actor: string, accion: string, detalle?: unknown) {
  await db.eventoAuditoria.create({
    data: { tenantId, actor, accion, detalle: detalle as never },
  });
}

export type EstadoAccion = { ok?: string; error?: string };

// ------------------------------------------------------------ Configuración

const esquemaConfig = z.object({
  tonoMarca: z.string().min(10, "Describe el tono con un poco más de detalle").max(1000),
  mensajeBienvenida: z.string().min(3).max(500),
  politicaEnvios: z.string().max(2000).optional(),
  politicaCambios: z.string().max(2000).optional(),
  politicaDevoluciones: z.string().max(2000).optional(),
  horarios: z.string().max(500).optional(),
  umbralConfianza: z.coerce
    .number()
    .min(0.3, "Por debajo de 0.3 el agente respondería casi cualquier cosa")
    .max(0.95, "Por encima de 0.95 el agente escalaría casi todo"),

  // Ajustes del modelo. Vacío = usar el valor global del sistema.
  llmModelo: z.string().max(100).optional(),
  llmTemperatura: z
    .union([z.coerce.number().min(0).max(1), z.literal("")])
    .optional(),
  llmRazonamiento: z.enum(["", "none", "low", "medium", "high"]).optional(),
  instruccionesExtra: z.string().max(4000).optional(),
  limiteMensajesMes: z
    .union([z.coerce.number().int().min(1), z.literal("")])
    .optional(),
});

export async function guardarConfiguracion(
  _previo: EstadoAccion,
  datos: FormData,
): Promise<EstadoAccion> {
  const sesion = await exigirConfigurar();
  const r = esquemaConfig.safeParse(Object.fromEntries(datos));
  if (!r.success) return { error: r.error.issues[0]?.message ?? "Datos inválidos" };

  const { llmTemperatura, llmRazonamiento, llmModelo, limiteMensajesMes, ...resto } =
    r.data;

  await db.tenant.update({
    where: { id: sesion.tenantId },
    data: {
      ...resto,
      // Cadena vacía significa "usar el valor global", no "cero".
      llmModelo: llmModelo?.trim() || null,
      llmTemperatura: llmTemperatura === "" || llmTemperatura === undefined ? null : llmTemperatura,
      llmRazonamiento: llmRazonamiento || null,
      limiteMensajesMes:
        limiteMensajesMes === "" || limiteMensajesMes === undefined ? null : limiteMensajesMes,
    },
  });
  await auditar(sesion.tenantId, sesion.nombre, "configuracion_actualizada");
  revalidatePath("/panel/configuracion");
  return { ok: "Configuración guardada." };
}

// ---------------------------------------------------------------- Productos

const esquemaProducto = z.object({
  sku: z.string().min(1).max(60).trim(),
  nombre: z.string().min(1).max(200).trim(),
  descripcion: z.string().max(1000).optional(),
  precio: z.coerce.number().min(0, "El precio no puede ser negativo"),
  stock: z.coerce.number().int().min(0, "El stock no puede ser negativo"),
});

export async function guardarProducto(
  _previo: EstadoAccion,
  datos: FormData,
): Promise<EstadoAccion> {
  const sesion = await exigirConfigurar();
  const r = esquemaProducto.safeParse(Object.fromEntries(datos));
  if (!r.success) return { error: r.error.issues[0]?.message ?? "Datos inválidos" };

  const { sku, nombre, descripcion, precio, stock } = r.data;
  // El precio se guarda en centavos: un float en dinero acumula error.
  const precioCentavos = Math.round(precio * 100);

  await db.producto.upsert({
    where: { tenantId_sku: { tenantId: sesion.tenantId, sku } },
    create: { tenantId: sesion.tenantId, sku, nombre, descripcion, precioCentavos, stock },
    update: { nombre, descripcion, precioCentavos, stock, activo: true },
  });
  await auditar(sesion.tenantId, sesion.nombre, "producto_guardado", { sku });
  revalidatePath("/panel/catalogo");
  return { ok: `Producto ${sku} guardado.` };
}

export async function eliminarProducto(datos: FormData) {
  const sesion = await exigirConfigurar();
  const id = String(datos.get("id") ?? "");
  // El where incluye tenantId: sin él, un id ajeno borraría producto de otra tienda.
  await db.producto.deleteMany({ where: { id, tenantId: sesion.tenantId } });
  await auditar(sesion.tenantId, sesion.nombre, "producto_eliminado", { id });
  revalidatePath("/panel/catalogo");
}

/**
 * Importación CSV. El brief contempla carga inicial por Google Sheets o CSV,
 * que en la práctica es como llega el catálogo de una tienda pequeña.
 * Columnas: sku,nombre,precio,stock,descripcion
 */
export async function importarCatalogo(
  _previo: EstadoAccion,
  datos: FormData,
): Promise<EstadoAccion> {
  const sesion = await exigirConfigurar();
  const csv = String(datos.get("csv") ?? "").trim();
  if (!csv) return { error: "Pega el contenido del CSV." };

  const lineas = csv.split(/\r?\n/).filter((l) => l.trim());
  if (lineas.length < 2) return { error: "El CSV necesita encabezado y al menos una fila." };

  const encabezado = lineas[0].toLowerCase().split(",").map((c) => c.trim());
  const idx = {
    sku: encabezado.indexOf("sku"),
    nombre: encabezado.indexOf("nombre"),
    precio: encabezado.indexOf("precio"),
    stock: encabezado.indexOf("stock"),
    descripcion: encabezado.indexOf("descripcion"),
  };
  if (idx.sku < 0 || idx.nombre < 0 || idx.precio < 0) {
    return { error: "El encabezado debe incluir al menos: sku, nombre, precio." };
  }

  let importados = 0;
  const errores: string[] = [];

  for (const [i, linea] of lineas.slice(1).entries()) {
    const celdas = linea.split(",").map((c) => c.trim());
    const sku = celdas[idx.sku];
    const nombre = celdas[idx.nombre];
    const precio = Number(celdas[idx.precio]);
    const stock = idx.stock >= 0 ? Number(celdas[idx.stock] ?? 0) : 0;

    if (!sku || !nombre || !Number.isFinite(precio) || precio < 0) {
      errores.push(`fila ${i + 2}`);
      continue;
    }

    await db.producto.upsert({
      where: { tenantId_sku: { tenantId: sesion.tenantId, sku } },
      create: {
        tenantId: sesion.tenantId,
        sku,
        nombre,
        descripcion: idx.descripcion >= 0 ? celdas[idx.descripcion] : undefined,
        precioCentavos: Math.round(precio * 100),
        stock: Number.isFinite(stock) ? stock : 0,
        fuente: "csv",
      },
      update: {
        nombre,
        precioCentavos: Math.round(precio * 100),
        stock: Number.isFinite(stock) ? stock : 0,
        fuente: "csv",
        activo: true,
      },
    });
    importados++;
  }

  await auditar(sesion.tenantId, sesion.nombre, "catalogo_importado", {
    importados,
    fallidas: errores.length,
  });
  revalidatePath("/panel/catalogo");

  if (importados === 0) return { error: "Ninguna fila era válida. Revisa el formato." };
  return {
    ok:
      `${importados} producto(s) importado(s).` +
      (errores.length ? ` Se omitieron ${errores.length}: ${errores.join(", ")}.` : ""),
  };
}

// -------------------------------------------------------------------- FAQs

const esquemaFaq = z.object({
  pregunta: z.string().min(5, "La pregunta es muy corta").max(300).trim(),
  respuesta: z.string().min(5, "La respuesta es muy corta").max(2000).trim(),
});

export async function guardarFaq(
  _previo: EstadoAccion,
  datos: FormData,
): Promise<EstadoAccion> {
  const sesion = await exigirConfigurar();
  const r = esquemaFaq.safeParse(Object.fromEntries(datos));
  if (!r.success) return { error: r.error.issues[0]?.message ?? "Datos inválidos" };

  await db.faq.create({ data: { ...r.data, tenantId: sesion.tenantId } });
  await auditar(sesion.tenantId, sesion.nombre, "faq_creada");
  revalidatePath("/panel/faqs");
  return { ok: "Pregunta agregada." };
}

export async function eliminarFaq(datos: FormData) {
  const sesion = await exigirConfigurar();
  const id = String(datos.get("id") ?? "");
  await db.faq.deleteMany({ where: { id, tenantId: sesion.tenantId } });
  await auditar(sesion.tenantId, sesion.nombre, "faq_eliminada", { id });
  revalidatePath("/panel/faqs");
}

// ------------------------------------------------------------ Escalamientos

export async function marcarEscalamientoAtendido(datos: FormData) {
  const sesion = await exigirSesion();
  const id = String(datos.get("id") ?? "");
  await db.escalamiento.updateMany({
    where: { id, tenantId: sesion.tenantId, estado: "PENDIENTE" },
    data: { estado: "ATENDIDO", atendidoEn: new Date() },
  });
  await auditar(sesion.tenantId, sesion.nombre, "escalamiento_atendido", { id });
  revalidatePath("/panel");
}

// ------------------------------------------------------------ Conector de tienda

const esquemaTienda = z.object({
  tiendaTipo: z.enum(["NINGUNA", "SHOPIFY", "WOOCOMMERCE", "TIENDANUBE"]),
  tiendaDominio: z.string().max(200).optional(),
  token: z.string().max(500).optional(),
  secreto: z.string().max(500).optional(),
});

/**
 * Guarda las credenciales del conector, cifradas en reposo.
 *
 * Si el campo de token llega vacío se conserva el que ya había: el panel nunca
 * muestra el token guardado, así que un formulario en blanco significa "no lo
 * cambies", no "bórralo".
 */
export async function guardarTienda(
  _previo: EstadoAccion,
  datos: FormData,
): Promise<EstadoAccion> {
  const sesion = await exigirConfigurar();
  const r = esquemaTienda.safeParse(Object.fromEntries(datos));
  if (!r.success) return { error: r.error.issues[0]?.message ?? "Datos inválidos" };

  const { tiendaTipo, tiendaDominio, token, secreto } = r.data;

  if (tiendaTipo !== "NINGUNA" && !tiendaDominio) {
    return { error: "Falta el dominio o id de la tienda." };
  }
  if (tiendaTipo === "WOOCOMMERCE" && token && !secreto) {
    return { error: "WooCommerce necesita consumer key y consumer secret." };
  }

  const { cifrar } = await import("@/lib/cifrado");

  await db.tenant.update({
    where: { id: sesion.tenantId },
    data: {
      tiendaTipo,
      tiendaDominio: tiendaDominio || null,
      ...(token ? { tiendaTokenCifrado: cifrar(token) } : {}),
      ...(secreto ? { tiendaSecretoCifrado: cifrar(secreto) } : {}),
      // Desconectar limpia las credenciales: dejarlas ahí es superficie inútil.
      ...(tiendaTipo === "NINGUNA"
        ? { tiendaTokenCifrado: null, tiendaSecretoCifrado: null, tiendaDominio: null }
        : {}),
    },
  });

  await auditar(sesion.tenantId, sesion.nombre, "tienda_configurada", { tiendaTipo });
  revalidatePath("/panel/tienda");
  return { ok: "Conexión guardada." };
}

export async function sincronizarDesdeTienda(
  _previo: EstadoAccion,
  _datos: FormData,
): Promise<EstadoAccion> {
  const sesion = await exigirConfigurar();
  const { sincronizarCatalogo } = await import("@/lib/tienda");

  const r = await sincronizarCatalogo(sesion.tenantId);
  revalidatePath("/panel/catalogo");
  revalidatePath("/panel/tienda");

  if (!r.ok) return { error: `No se pudo sincronizar: ${r.error}` };
  return { ok: `${r.importados} producto(s) sincronizado(s) desde la tienda.` };
}
