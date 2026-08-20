import { describe, it, expect, beforeEach } from "vitest";
import { z } from "zod";
import {
  registrarAccion,
  obtenerAccion,
  limpiarRegistro,
} from "@/lib/aprobaciones/registro";

const definicionMinima = {
  accion: "prueba",
  nivel: "AUTOMATICO" as const,
  titulo: "Prueba",
  esquema: z.object({ x: z.number() }),
  describir: () => "prueba",
  ejecutar: async () => ({ ok: true }),
};

describe("registro de acciones", () => {
  beforeEach(() => limpiarRegistro());

  it("guarda y devuelve una acción registrada", () => {
    registrarAccion(definicionMinima);
    expect(obtenerAccion("prueba")?.nivel).toBe("AUTOMATICO");
  });

  it("una acción no registrada no existe", () => {
    // El modelo no puede inventar acciones: si no está aquí, no ocurre nada.
    expect(obtenerAccion("borrar_todo")).toBeNull();
  });

  it("rechaza registrar dos veces el mismo nombre", () => {
    registrarAccion(definicionMinima);
    expect(() => registrarAccion(definicionMinima)).toThrow(/duplicada/i);
  });
});
