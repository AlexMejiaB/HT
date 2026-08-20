import { createHash } from "node:crypto";
import { db } from "@/lib/db";
import { obtenerAccion } from "@/lib/aprobaciones/registro";

/**
 * Motor de aprobación humana.
 *
 * Reglas que no se negocian:
 *
 * 1. La solicitud se **persiste antes** de ejecutar nada. El ejecutor lee de la
 *    base, nunca recibe la orden directamente del modelo.
 * 2. Toda ejecución pasa por una **clave de idempotencia**. Los reintentos, los
 *    dobles clics y las reentregas de webhook no pueden actuar dos veces.
 * 3. Al vencer el plazo, una solicitud de REVISION **escala**. Jamás se
 *    auto-aprueba: una cola que se vacía sola no es una revisión, es un adorno.
 * 4. BLOQUEO **no tiene plazo**. No ocurre hasta que una persona dice que sí.
 */

export type ResultadoSolicitud =
  | { estado: "ejecutada"; id: string; resultado: Record<string, unknown> }
  | { estado: "pendiente"; id: string; nivel: string }
  | { estado: "duplicada"; id: string }
  | { estado: "rechazada_por_validacion"; error: string }
  | { estado: "accion_desconocida" }
  | { estado: "fallida"; id: string; error: string };

function claveDe(accion: string, argumentos: unknown, sufijo?: string): string {
  const huella = createHash("sha256")
    .update(JSON.stringify({ accion, argumentos, sufijo }))
    .digest("hex")
    .slice(0, 32);
  return `${accion}:${huella}`;
}

/** Registra en auditoría los cinco campos: quién, qué, cuándo, por qué y resultado. */
async function auditar(
  tenantId: string,
  actor: string,
  accion: string,
  recurso: string,
  detalle: Record<string, unknown>,
) {
  await db.eventoAuditoria.create({
    data: { tenantId, actor, accion, recurso, detalle: detalle as never },
  });
}

/**
 * Solicita una acción. Si es AUTOMATICO se ejecuta al momento; en otro caso
 * queda pendiente de una persona.
 *
 * `sufijoIdempotencia` distingue dos solicitudes legítimamente iguales (por
 * ejemplo la misma factura pedida en dos conversaciones distintas).
 */
export async function solicitar(
  tenantId: string,
  accion: string,
  argumentosCrudos: unknown,
  opciones: {
    actor?: string;
    conversacionId?: string;
    sufijoIdempotencia?: string;
  } = {},
): Promise<ResultadoSolicitud> {
  const def = obtenerAccion(accion);
  if (!def) return { estado: "accion_desconocida" };

  const validado = def.esquema.safeParse(argumentosCrudos);
  if (!validado.success) {
    return {
      estado: "rechazada_por_validacion",
      error: validado.error.issues[0]?.message ?? "Argumentos inválidos",
    };
  }
  const argumentos = validado.data;
  const clave = claveDe(accion, argumentos, opciones.sufijoIdempotencia);

  const existente = await db.aprobacion.findUnique({
    where: { claveIdempotencia: clave },
    select: { id: true },
  });
  if (existente) return { estado: "duplicada", id: existente.id };

  const venceEn =
    def.nivel === "REVISION" && def.plazoMinutos
      ? new Date(Date.now() + def.plazoMinutos * 60_000)
      : null;

  let solicitud;
  try {
    solicitud = await db.aprobacion.create({
      data: {
        tenantId,
        accion,
        nivel: def.nivel,
        argumentos: argumentos as never,
        contexto: def.describir(argumentos),
        conversacionId: opciones.conversacionId,
        claveIdempotencia: clave,
        venceEn,
      },
      select: { id: true },
    });
  } catch {
    // Carrera con otra solicitud idéntica: la primera gana.
    const otra = await db.aprobacion.findUnique({
      where: { claveIdempotencia: clave },
      select: { id: true },
    });
    return otra ? { estado: "duplicada", id: otra.id } : { estado: "accion_desconocida" };
  }

  await auditar(tenantId, opciones.actor ?? "agente", "accion_solicitada", `aprobacion:${solicitud.id}`, {
    accion,
    nivel: def.nivel,
  });

  if (def.nivel === "AUTOMATICO") {
    return ejecutar(solicitud.id, "sistema");
  }

  return { estado: "pendiente", id: solicitud.id, nivel: def.nivel };
}

/** Aprueba y ejecuta. Sólo una persona identificada puede llamarla. */
export async function aprobar(
  id: string,
  tenantId: string,
  quien: string,
  comentario?: string,
): Promise<ResultadoSolicitud> {
  // El where incluye estado y tenant: aprobar dos veces no re-ejecuta, y no se
  // puede aprobar una solicitud de otro negocio.
  const actualizadas = await db.aprobacion.updateMany({
    where: { id, tenantId, estado: "PENDIENTE" },
    data: { estado: "APROBADA", resueltaPor: quien, resueltaEn: new Date(), comentario },
  });
  if (actualizadas.count === 0) {
    const actual = await db.aprobacion.findFirst({
      where: { id, tenantId },
      select: { id: true, estado: true },
    });
    return actual
      ? { estado: "duplicada", id: actual.id }
      : { estado: "accion_desconocida" };
  }

  await auditar(tenantId, quien, "accion_aprobada", `aprobacion:${id}`, {
    comentario: comentario ?? null,
  });
  return ejecutar(id, quien);
}

export async function rechazar(
  id: string,
  tenantId: string,
  quien: string,
  comentario?: string,
): Promise<{ ok: boolean }> {
  const r = await db.aprobacion.updateMany({
    where: { id, tenantId, estado: "PENDIENTE" },
    data: { estado: "RECHAZADA", resueltaPor: quien, resueltaEn: new Date(), comentario },
  });
  if (r.count > 0) {
    await auditar(tenantId, quien, "accion_rechazada", `aprobacion:${id}`, {
      comentario: comentario ?? null,
    });
  }
  return { ok: r.count > 0 };
}

/**
 * Ejecuta una solicitud ya aprobada. No es pública por diseño: se llega aquí
 * desde `solicitar` (sólo AUTOMATICO) o desde `aprobar`.
 */
async function ejecutar(id: string, actor: string): Promise<ResultadoSolicitud> {
  const s = await db.aprobacion.findUniqueOrThrow({
    where: { id },
    select: { id: true, tenantId: true, accion: true, argumentos: true, estado: true },
  });

  const def = obtenerAccion(s.accion);
  if (!def) return { estado: "accion_desconocida" };

  try {
    const resultado = await def.ejecutar(s.tenantId, s.argumentos as never);
    await db.aprobacion.update({
      where: { id },
      data: { estado: "EJECUTADA", resultado: resultado as never },
    });
    await auditar(s.tenantId, actor, "accion_ejecutada", `aprobacion:${id}`, {
      accion: s.accion,
      resultado,
    });
    return { estado: "ejecutada", id, resultado };
  } catch (e) {
    const error = e instanceof Error ? e.message : "Error desconocido";
    await db.aprobacion.update({ where: { id }, data: { estado: "FALLIDA", error } });
    await auditar(s.tenantId, actor, "accion_fallida", `aprobacion:${id}`, {
      accion: s.accion,
      error,
    });
    return { estado: "fallida", id, error };
  }
}

/**
 * Vence las solicitudes de REVISION cuyo plazo pasó.
 *
 * Las marca ESCALADA, **no** aprobadas. Es la diferencia entre una cola de
 * revisión y un temporizador que aprueba solo.
 */
export async function vencerPendientes(): Promise<{ escaladas: number }> {
  const vencidas = await db.aprobacion.findMany({
    where: {
      estado: "PENDIENTE",
      nivel: "REVISION",
      venceEn: { not: null, lte: new Date() },
    },
    select: { id: true, tenantId: true, accion: true },
  });

  for (const v of vencidas) {
    await db.aprobacion.updateMany({
      where: { id: v.id, estado: "PENDIENTE" },
      data: { estado: "ESCALADA", resueltaEn: new Date() },
    });
    await auditar(v.tenantId, "sistema", "accion_escalada_por_plazo", `aprobacion:${v.id}`, {
      accion: v.accion,
      nota: "Venció el plazo de revisión; se escala en vez de auto-aprobar.",
    });
  }

  return { escaladas: vencidas.length };
}
