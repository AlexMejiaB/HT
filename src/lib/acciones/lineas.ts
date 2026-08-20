"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { exigirPermisoEnAccion } from "@/lib/permisos";

export type EstadoLinea = { ok?: string; error?: string };

const esquemaLinea = z.object({
  nombre: z.string().min(2, "Ponle nombre a la línea").max(120),
  contexto: z
    .string()
    .min(10, "Describe qué debe saber el agente sobre esta línea")
    .max(4000),
  porDefecto: z.coerce.boolean().optional(),
});

function aSlug(nombre: string): string {
  return nombre
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60);
}

export async function guardarLinea(
  _previo: EstadoLinea,
  datos: FormData,
): Promise<EstadoLinea> {
  const sesion = await exigirPermisoEnAccion("configurar");
  const r = esquemaLinea.safeParse(Object.fromEntries(datos));
  if (!r.success) return { error: r.error.issues[0]?.message ?? "Datos inválidos" };

  const slug = aSlug(r.data.nombre);
  if (!slug) return { error: "El nombre no produce un identificador válido." };

  // Sólo puede haber una línea por defecto: la anterior se desmarca.
  if (r.data.porDefecto) {
    await db.lineaProducto.updateMany({
      where: { tenantId: sesion.tenantId, porDefecto: true },
      data: { porDefecto: false },
    });
  }

  await db.lineaProducto.upsert({
    where: { tenantId_slug: { tenantId: sesion.tenantId, slug } },
    create: {
      tenantId: sesion.tenantId,
      nombre: r.data.nombre,
      slug,
      contexto: r.data.contexto,
      porDefecto: Boolean(r.data.porDefecto),
    },
    update: {
      nombre: r.data.nombre,
      contexto: r.data.contexto,
      porDefecto: Boolean(r.data.porDefecto),
      activo: true,
    },
  });

  await db.eventoAuditoria.create({
    data: {
      tenantId: sesion.tenantId,
      actor: sesion.nombre,
      accion: "linea_guardada",
      detalle: { slug },
    },
  });
  revalidatePath("/panel/lineas");
  return { ok: `Línea "${r.data.nombre}" guardada.` };
}

export async function eliminarLinea(datos: FormData) {
  const sesion = await exigirPermisoEnAccion("configurar");
  const id = String(datos.get("id") ?? "");
  // Los productos quedan sin línea (onDelete: SetNull), no se borran.
  await db.lineaProducto.deleteMany({ where: { id, tenantId: sesion.tenantId } });
  revalidatePath("/panel/lineas");
}

/** Asigna productos a una línea, por SKU separados por coma o salto de línea. */
export async function asignarProductos(
  _previo: EstadoLinea,
  datos: FormData,
): Promise<EstadoLinea> {
  const sesion = await exigirPermisoEnAccion("configurar");
  const lineaId = String(datos.get("lineaId") ?? "");
  const skus = String(datos.get("skus") ?? "")
    .split(/[\s,;]+/)
    .map((s) => s.trim())
    .filter(Boolean);

  if (!lineaId) return { error: "Elige una línea." };
  if (skus.length === 0) return { error: "Escribe al menos un SKU." };

  const linea = await db.lineaProducto.findFirst({
    where: { id: lineaId, tenantId: sesion.tenantId },
    select: { id: true, nombre: true },
  });
  if (!linea) return { error: "Esa línea no existe." };

  const r = await db.producto.updateMany({
    where: { tenantId: sesion.tenantId, sku: { in: skus } },
    data: { lineaId: linea.id },
  });

  revalidatePath("/panel/lineas");
  revalidatePath("/panel/catalogo");

  if (r.count === 0) return { error: "Ningún SKU coincidió con tu catálogo." };
  const faltantes = skus.length - r.count;
  return {
    ok:
      `${r.count} producto(s) asignado(s) a ${linea.nombre}.` +
      (faltantes > 0 ? ` ${faltantes} SKU no existe(n) en el catálogo.` : ""),
  };
}

// ------------------------------------------------------- Ejemplos de estilo

const esquemaEjemplo = z.object({
  pregunta: z.string().min(3, "Escribe la pregunta").max(300),
  respuesta: z.string().min(3, "Escribe la respuesta modelo").max(1000),
  lineaId: z.string().optional(),
});

export async function guardarEjemplo(
  _previo: EstadoLinea,
  datos: FormData,
): Promise<EstadoLinea> {
  const sesion = await exigirPermisoEnAccion("configurar");
  const r = esquemaEjemplo.safeParse(Object.fromEntries(datos));
  if (!r.success) return { error: r.error.issues[0]?.message ?? "Datos inválidos" };

  await db.ejemploRespuesta.create({
    data: {
      tenantId: sesion.tenantId,
      pregunta: r.data.pregunta,
      respuesta: r.data.respuesta,
      lineaId: r.data.lineaId || null,
    },
  });
  revalidatePath("/panel/lineas");
  return { ok: "Ejemplo agregado." };
}

export async function eliminarEjemplo(datos: FormData) {
  const sesion = await exigirPermisoEnAccion("configurar");
  const id = String(datos.get("id") ?? "");
  await db.ejemploRespuesta.deleteMany({ where: { id, tenantId: sesion.tenantId } });
  revalidatePath("/panel/lineas");
}
