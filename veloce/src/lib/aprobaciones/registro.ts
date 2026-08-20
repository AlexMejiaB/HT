import { z } from "zod";
import type { NivelAprobacion } from "@/generated/prisma/enums";

/**
 * Catálogo de acciones operativas (Fase 3).
 *
 * Una acción sólo existe si está registrada aquí, con su nivel de riesgo y su
 * ejecutor. El modelo no puede inventar acciones: pide una por nombre y, si no
 * está en este registro, no ocurre nada.
 *
 * El nivel se declara en el registro, no en el prompt. Un prompt se puede
 * convencer de que algo es de bajo riesgo; esta tabla no.
 */
export type Ejecutor<A> = (
  tenantId: string,
  argumentos: A,
) => Promise<Record<string, unknown>>;

export type DefinicionAccion<A = Record<string, unknown>> = {
  accion: string;
  nivel: NivelAprobacion;
  /** Descripción corta para el panel de aprobaciones. */
  titulo: string;
  esquema: z.ZodType<A>;
  /** Contexto que ve quien aprueba. Debe bastar para decidir en dos minutos. */
  describir: (argumentos: A) => string;
  ejecutar: Ejecutor<A>;
  /**
   * Sólo para REVISION. Al vencer, la solicitud ESCALA a una persona; nunca
   * se auto-aprueba, porque una cola que se auto-vacía no es una revisión.
   */
  plazoMinutos?: number;
};

const registro = new Map<string, DefinicionAccion<never>>();

export function registrarAccion<A>(def: DefinicionAccion<A>): void {
  if (registro.has(def.accion)) {
    throw new Error(`Acción duplicada en el registro: ${def.accion}`);
  }
  registro.set(def.accion, def as unknown as DefinicionAccion<never>);
}

export function obtenerAccion(nombre: string): DefinicionAccion<never> | null {
  return registro.get(nombre) ?? null;
}

export function accionesRegistradas(): DefinicionAccion<never>[] {
  return [...registro.values()];
}

/** Sólo para pruebas: deja el registro limpio entre casos. */
export function limpiarRegistro(): void {
  registro.clear();
}
