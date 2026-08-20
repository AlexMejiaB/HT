import { redirect } from "next/navigation";
import { leerSesion, type Sesion } from "@/lib/sesion";

/**
 * Permisos por rol.
 *
 * El rol no basta con guardarlo en la sesión: si nadie lo comprueba, todos los
 * usuarios son administradores. Cada página y cada acción sensible pasa por
 * `exigirPermiso`.
 *
 * Autorizar acciones de dinero es competencia del dueño, no de cualquiera con
 * acceso al panel: aprobar un cargo o una factura es `aprobar_bloqueo`.
 */
export type Permiso =
  | "panel" // ver conversaciones y métricas
  | "configurar" // tono, políticas, catálogo, tienda
  | "equipo" // altas y bajas de usuarios del tenant
  | "aprobar_revision" // acciones de impacto medio
  | "aprobar_bloqueo" // irreversibles o que mueven dinero
  | "admin"; // consola multi-tenant

const PERMISOS: Record<string, readonly Permiso[]> = {
  DUENO: ["panel", "configurar", "equipo", "aprobar_revision", "aprobar_bloqueo"],
  // Un agente atiende y desahoga la cola de revisión, pero no toca la
  // configuración ni autoriza dinero.
  AGENTE: ["panel", "aprobar_revision"],
  SOPORTE_VELOCE: [
    "panel",
    "configurar",
    "equipo",
    "aprobar_revision",
    "aprobar_bloqueo",
    "admin",
  ],
};

export function puede(rol: string, permiso: Permiso): boolean {
  return PERMISOS[rol]?.includes(permiso) ?? false;
}

/** Para páginas: redirige si no hay sesión o falta el permiso. */
export async function exigirPermiso(permiso: Permiso): Promise<Sesion> {
  const sesion = await leerSesion();
  if (!sesion) redirect("/entrar");
  if (!puede(sesion.rol, permiso)) redirect("/panel?sinpermiso=1");
  return sesion;
}

/** Para server actions: lanza en vez de redirigir. */
export async function exigirPermisoEnAccion(permiso: Permiso): Promise<Sesion> {
  const sesion = await leerSesion();
  if (!sesion) throw new Error("No autenticado");
  if (!puede(sesion.rol, permiso)) {
    throw new Error(`Tu rol no permite esta acción (${permiso})`);
  }
  return sesion;
}

export const ETIQUETA_ROL: Record<string, string> = {
  DUENO: "Dueño",
  AGENTE: "Agente",
  SOPORTE_VELOCE: "Soporte",
};
