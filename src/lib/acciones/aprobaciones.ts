"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { exigirPermisoEnAccion } from "@/lib/permisos";
import { aprobar, rechazar } from "@/lib/aprobaciones/motor";
import "@/lib/aprobaciones/acciones";

export type EstadoAprobacionUI = { ok?: string; error?: string };

/**
 * Aprueba una acción pendiente.
 *
 * El permiso depende del nivel: cualquiera con acceso al panel puede desahogar
 * la cola de REVISION, pero sólo un dueño autoriza lo irreversible. Se consulta
 * el nivel en la base, no se recibe del formulario.
 */
export async function aprobarAccion(
  _previo: EstadoAprobacionUI,
  datos: FormData,
): Promise<EstadoAprobacionUI> {
  const id = String(datos.get("id") ?? "");
  const comentario = String(datos.get("comentario") ?? "").slice(0, 500) || undefined;

  const solicitud = await db.aprobacion.findUnique({
    where: { id },
    select: { nivel: true, tenantId: true },
  });
  if (!solicitud) return { error: "La solicitud ya no existe." };

  const sesion = await exigirPermisoEnAccion(
    solicitud.nivel === "BLOQUEO" ? "aprobar_bloqueo" : "aprobar_revision",
  );
  // El tenant sale de la sesión: aprobar algo de otro negocio no es posible.
  if (solicitud.tenantId !== sesion.tenantId) return { error: "La solicitud ya no existe." };

  const r = await aprobar(id, sesion.tenantId, sesion.nombre, comentario);
  revalidatePath("/panel/aprobaciones");

  switch (r.estado) {
    case "ejecutada":
      return { ok: "Acción aprobada y ejecutada." };
    case "duplicada":
      return { error: "Esa solicitud ya estaba resuelta." };
    case "fallida":
      return { error: `Se aprobó, pero la ejecución falló: ${r.error}` };
    default:
      return { error: "No se pudo ejecutar la acción." };
  }
}

export async function rechazarAccion(
  _previo: EstadoAprobacionUI,
  datos: FormData,
): Promise<EstadoAprobacionUI> {
  const id = String(datos.get("id") ?? "");
  const comentario = String(datos.get("comentario") ?? "").slice(0, 500) || undefined;

  const solicitud = await db.aprobacion.findUnique({
    where: { id },
    select: { nivel: true, tenantId: true },
  });
  if (!solicitud) return { error: "La solicitud ya no existe." };

  const sesion = await exigirPermisoEnAccion(
    solicitud.nivel === "BLOQUEO" ? "aprobar_bloqueo" : "aprobar_revision",
  );
  if (solicitud.tenantId !== sesion.tenantId) return { error: "La solicitud ya no existe." };

  const r = await rechazar(id, sesion.tenantId, sesion.nombre, comentario);
  revalidatePath("/panel/aprobaciones");
  return r.ok ? { ok: "Solicitud rechazada." } : { error: "Ya estaba resuelta." };
}
