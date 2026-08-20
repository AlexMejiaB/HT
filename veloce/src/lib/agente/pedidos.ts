import { conectorDe, type PedidoTienda, type EstadoPedido } from "@/lib/tienda";

/**
 * Consulta de estatus de pedido (Fase 2).
 *
 * Sigue siendo de sólo lectura: se informa, nunca se modifica. Cualquier
 * petición de cambiar, cancelar o reembolsar sigue escalando por guardrails,
 * aunque aquí sepamos leer el pedido.
 */

/** Formatos habituales: #1234, pedido 1234, orden #1234, o el número suelto. */
const PATRONES_NUMERO = [
  /#\s*(\d{3,12})/,
  /\b(?:pedido|orden|order|compra|folio)\s*(?:n[uú]mero\s*)?#?\s*(\d{3,12})/i,
  /\b(\d{4,12})\b/,
];

export function extraerNumeroPedido(texto: string): string | null {
  for (const p of PATRONES_NUMERO) {
    const m = texto.match(p);
    if (m?.[1]) return m[1];
  }
  return null;
}

const FRASE_ESTADO: Record<EstadoPedido, string> = {
  pendiente: "está registrado y en espera de confirmación de pago",
  pagado: "ya está pagado y entra a preparación",
  preparando: "se está preparando en almacén",
  enviado: "ya va en camino",
  entregado: "aparece como entregado",
  cancelado: "aparece como cancelado",
  desconocido: "está en proceso",
};

export function redactarEstatus(p: PedidoTienda): string {
  const partes = [`Tu pedido ${p.numero} ${FRASE_ESTADO[p.estado]}.`];
  if (p.estado === "enviado" && p.rastreo) {
    partes.push(`Número de rastreo: ${p.rastreo}.`);
    if (p.urlRastreo) partes.push(`Puedes seguirlo aquí: ${p.urlRastreo}`);
  }
  return partes.join(" ");
}

export type ResultadoPedido =
  | { tipo: "encontrado"; texto: string; pedido: PedidoTienda }
  | { tipo: "sin_conector" }
  | { tipo: "sin_numero" }
  | { tipo: "no_encontrado" }
  | { tipo: "error"; detalle: string };

/**
 * El teléfono es obligatorio: el conector lo usa para comprobar que quien
 * pregunta es el titular. Sin esa comprobación, cualquiera que adivine un
 * número de pedido leería datos de otro cliente.
 */
export async function consultarEstatus(
  tenantId: string,
  texto: string,
  telefono: string,
): Promise<ResultadoPedido> {
  const conector = await conectorDe(tenantId);
  if (!conector) return { tipo: "sin_conector" };

  const numero = extraerNumeroPedido(texto);
  if (!numero) return { tipo: "sin_numero" };

  try {
    const pedido = await conector.buscarPedido(numero, telefono);
    if (!pedido) return { tipo: "no_encontrado" };
    return { tipo: "encontrado", texto: redactarEstatus(pedido), pedido };
  } catch (e) {
    return { tipo: "error", detalle: e instanceof Error ? e.message : "error desconocido" };
  }
}
