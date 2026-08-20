import type { Plan } from "@/generated/prisma/enums";

/**
 * Qué desbloquea cada plan.
 *
 * Única fuente de verdad. Hasta ahora el plan contratado era decorativo: un
 * cliente de $2,990 tenía exactamente el mismo acceso que uno de $9,990. Este
 * archivo lo corrige, y cualquier capacidad nueva se declara aquí, no dispersa
 * en comprobaciones sueltas por el código.
 *
 * Regla: el plan controla QUÉ puede hacer el negocio; el rol controla QUIÉN
 * dentro del negocio puede hacerlo. Son ortogonales y ambos se comprueban.
 */

export type Capacidad =
  /** Recibir y responder mensajes directos de Instagram. */
  | "instagram"
  /** Conectar Shopify, WooCommerce o Tiendanube en modo lectura. */
  | "conector_tienda"
  /** Consultar el estatus real de un pedido en la tienda conectada. */
  | "estatus_pedido"
  /** Líneas de marca con subcontexto propio. */
  | "lineas"
  /** Motor de acciones operativas con aprobación humana. */
  | "aprobaciones"
  /** Generar guías de envío. */
  | "guias"
  /** Ajustar y controlar inventario. */
  | "inventario"
  /** Órdenes de compra a proveedores y recepción de mercancía. */
  | "compras"
  /** Emitir CFDI 4.0 a los clientes finales. */
  | "facturacion";

type DefinicionPlan = {
  nombre: string;
  capacidades: readonly Capacidad[];
  /** Tope de mensajes al mes. `null` = sin tope. */
  limiteMensajes: number | null;
};

/**
 * Los límites de mensajes salen del perfil de cliente del brief: el plan de
 * entrada atiende a una tienda que factura ~$50k al mes, y el de arriba a una
 * consolidada con volumen alto.
 */
export const PLANES: Record<Plan, DefinicionPlan> = {
  RESPONDE: {
    nombre: "Responde",
    capacidades: [],
    limiteMensajes: 1_000,
  },
  OPERADOR: {
    nombre: "Operador",
    capacidades: ["instagram", "conector_tienda", "estatus_pedido", "lineas"],
    limiteMensajes: 5_000,
  },
  AUTOPILOT: {
    nombre: "Autopilot",
    capacidades: [
      "instagram",
      "conector_tienda",
      "estatus_pedido",
      "lineas",
      "aprobaciones",
      "guias",
      "inventario",
      "compras",
      "facturacion",
    ],
    limiteMensajes: null,
  },
};

export function planIncluye(plan: Plan, capacidad: Capacidad): boolean {
  return PLANES[plan]?.capacidades.includes(capacidad) ?? false;
}

/**
 * Tope de mensajes del plan.
 *
 * Antes lo elegía el propio cliente desde su panel — podía borrarse su tope y
 * gastar sin límite. Ahora deriva del plan. `limitePersonalizado` sólo permite
 * BAJARLO, nunca subirlo: sirve para que un negocio se autolimite el gasto, no
 * para saltarse lo contratado.
 */
export function limiteDelPlan(plan: Plan, limitePersonalizado?: number | null): number | null {
  const delPlan = PLANES[plan]?.limiteMensajes ?? null;
  if (limitePersonalizado == null) return delPlan;
  if (delPlan == null) return limitePersonalizado;
  return Math.min(delPlan, limitePersonalizado);
}

/** El plan mínimo que incluye una capacidad, para decir a qué hay que subir. */
export function planMinimoPara(capacidad: Capacidad): Plan | null {
  const orden: Plan[] = ["RESPONDE", "OPERADOR", "AUTOPILOT"];
  return orden.find((p) => planIncluye(p, capacidad)) ?? null;
}

export const ETIQUETA_CAPACIDAD: Record<Capacidad, string> = {
  instagram: "Instagram",
  conector_tienda: "Conexión con tu tienda",
  estatus_pedido: "Estatus de pedidos",
  lineas: "Líneas de marca",
  aprobaciones: "Acciones con aprobación",
  guias: "Generación de guías",
  inventario: "Control de inventario",
  compras: "Compras a proveedores",
  facturacion: "Facturación CFDI",
};
