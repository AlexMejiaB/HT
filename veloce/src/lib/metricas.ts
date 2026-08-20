import { db } from "@/lib/db";

/**
 * Métricas que el brief pide mostrar: conversaciones, leads, escalados,
 * preguntas frecuentes y tiempo de primera respuesta.
 *
 * Todas las consultas filtran por tenantId. Sin ese filtro, un cliente vería
 * los datos de otro.
 */
export async function metricasDe(tenantId: string, dias = 30) {
  const desde = new Date(Date.now() - dias * 24 * 60 * 60 * 1000);
  const alcance = { tenantId, creadoEn: { gte: desde } };

  const [conversaciones, leads, escalados, pendientes, porIntencion, primeraRespuesta] =
    await Promise.all([
      db.conversacion.count({ where: alcance }),
      db.lead.count({ where: alcance }),
      db.escalamiento.count({ where: alcance }),
      db.escalamiento.count({ where: { tenantId, estado: "PENDIENTE" } }),
      db.conversacion.groupBy({
        by: ["intencion"],
        where: { ...alcance, intencion: { not: null } },
        _count: { _all: true },
        orderBy: { _count: { intencion: "desc" } },
        take: 8,
      }),
      db.conversacion.aggregate({
        where: { ...alcance, primeraRespuestaMs: { not: null } },
        _avg: { primeraRespuestaMs: true },
      }),
    ]);

  // Proporción de conversaciones que el agente resolvió sin una persona.
  const resueltasSolo = conversaciones > 0 ? 1 - escalados / conversaciones : 0;

  return {
    dias,
    conversaciones,
    leads,
    escalados,
    pendientes,
    tasaAutonomia: Math.max(0, Math.round(resueltasSolo * 100)),
    primeraRespuestaSeg: primeraRespuesta._avg.primeraRespuestaMs
      ? Math.round(primeraRespuesta._avg.primeraRespuestaMs / 1000)
      : null,
    porIntencion: porIntencion.map((i) => ({
      intencion: i.intencion,
      total: i._count._all,
    })),
  };
}

export async function escalamientosPendientes(tenantId: string, limite = 20) {
  return db.escalamiento.findMany({
    where: { tenantId, estado: "PENDIENTE" },
    orderBy: { creadoEn: "desc" },
    take: limite,
    select: {
      id: true,
      motivo: true,
      resumen: true,
      accionSugerida: true,
      creadoEn: true,
      conversacion: {
        select: { id: true, contacto: { select: { nombre: true, telefono: true } } },
      },
    },
  });
}

export async function conversacionesRecientes(tenantId: string, limite = 25) {
  return db.conversacion.findMany({
    where: { tenantId },
    orderBy: { actualEn: "desc" },
    take: limite,
    select: {
      id: true,
      estado: true,
      intencion: true,
      resumen: true,
      actualEn: true,
      canal: true,
      etiquetas: true,
      contacto: { select: { nombre: true, telefono: true } },
      _count: { select: { mensajes: true } },
    },
  });
}
