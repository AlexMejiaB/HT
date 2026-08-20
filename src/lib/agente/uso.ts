import { db } from "@/lib/db";
import type { Uso } from "@/lib/agente/llm";

/**
 * Medición y tope de consumo por cliente.
 *
 * Cuando un negocio agota su límite, el agente **escala a una persona** en vez
 * de dejar de contestar. Un cliente que escribe y no recibe nada es peor que un
 * caso entregado a tiempo; y seguir gastando sin tope tampoco es opción.
 */

/** Periodo "YYYY-MM" en hora local, que es como el dueño lee su factura. */
export function periodoActual(fecha = new Date()): string {
  return `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, "0")}`;
}

export type EstadoUso = {
  mensajes: number;
  tokensEntrada: number;
  tokensSalida: number;
  limite: number | null;
  /** True cuando ya no queda margen este mes. */
  agotado: boolean;
};

export async function consultarUso(tenantId: string): Promise<EstadoUso> {
  const periodo = periodoActual();
  const [t, uso] = await Promise.all([
    db.tenant.findUnique({
      where: { id: tenantId },
      select: { limiteMensajesMes: true },
    }),
    db.usoMensual.findUnique({
      where: { tenantId_periodo: { tenantId, periodo } },
      select: { mensajes: true, tokensEntrada: true, tokensSalida: true },
    }),
  ]);

  const limite = t?.limiteMensajesMes ?? null;
  const mensajes = uso?.mensajes ?? 0;

  return {
    mensajes,
    tokensEntrada: uso?.tokensEntrada ?? 0,
    tokensSalida: uso?.tokensSalida ?? 0,
    limite,
    agotado: limite !== null && mensajes >= limite,
  };
}

/**
 * Registra el consumo de un mensaje. Se llama una vez por mensaje atendido,
 * sumando el gasto de todas las llamadas al modelo que hizo falta.
 */
export async function registrarUso(tenantId: string, usos: Uso[]): Promise<void> {
  const periodo = periodoActual();
  const entrada = usos.reduce((s, u) => s + u.entrada, 0);
  // El total del proveedor incluye los tokens de razonamiento, que se cobran
  // aunque no aparezcan como salida. Se guarda la diferencia para que el gasto
  // medido coincida con la factura.
  const salida = usos.reduce((s, u) => s + Math.max(u.salida, u.total - u.entrada), 0);

  await db.usoMensual.upsert({
    where: { tenantId_periodo: { tenantId, periodo } },
    create: { tenantId, periodo, mensajes: 1, tokensEntrada: entrada, tokensSalida: salida },
    update: {
      mensajes: { increment: 1 },
      tokensEntrada: { increment: entrada },
      tokensSalida: { increment: salida },
    },
  });
}
