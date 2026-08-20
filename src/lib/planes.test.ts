import { describe, it, expect } from "vitest";
import {
  PLANES,
  planIncluye,
  limiteDelPlan,
  planMinimoPara,
  type Capacidad,
} from "@/lib/planes";

describe("capacidades por plan", () => {
  it("Responde es sólo el agente en WhatsApp", () => {
    expect(planIncluye("RESPONDE", "instagram")).toBe(false);
    expect(planIncluye("RESPONDE", "conector_tienda")).toBe(false);
    expect(planIncluye("RESPONDE", "guias")).toBe(false);
  });

  it("Operador suma Instagram, tienda y líneas", () => {
    expect(planIncluye("OPERADOR", "instagram")).toBe(true);
    expect(planIncluye("OPERADOR", "conector_tienda")).toBe(true);
    expect(planIncluye("OPERADOR", "lineas")).toBe(true);
    // Pero no la operación pesada, que es lo que se cobra caro.
    expect(planIncluye("OPERADOR", "guias")).toBe(false);
    expect(planIncluye("OPERADOR", "compras")).toBe(false);
  });

  it("Autopilot opera todo menos empacar", () => {
    for (const c of ["guias", "inventario", "compras", "facturacion"] as Capacidad[]) {
      expect(planIncluye("AUTOPILOT", c), c).toBe(true);
    }
  });

  it("cada plan incluye todo lo del anterior", () => {
    // Si un plan caro perdiera una capacidad del barato, un cliente que sube
    // de plan perdería funciones. Nunca debe pasar.
    for (const c of PLANES.RESPONDE.capacidades) {
      expect(planIncluye("OPERADOR", c), c).toBe(true);
    }
    for (const c of PLANES.OPERADOR.capacidades) {
      expect(planIncluye("AUTOPILOT", c), c).toBe(true);
    }
  });
});

describe("limiteDelPlan", () => {
  it("usa el tope del plan cuando no hay personalizado", () => {
    expect(limiteDelPlan("RESPONDE", null)).toBe(1000);
    expect(limiteDelPlan("OPERADOR", null)).toBe(5000);
    expect(limiteDelPlan("AUTOPILOT", null)).toBeNull();
  });

  it("el cliente puede bajarse el tope para controlar su gasto", () => {
    expect(limiteDelPlan("OPERADOR", 500)).toBe(500);
    expect(limiteDelPlan("AUTOPILOT", 2000)).toBe(2000);
  });

  it("el cliente NO puede subirse el tope por encima de lo contratado", () => {
    // Antes podía borrarse su propio límite; ahora el plan manda.
    expect(limiteDelPlan("RESPONDE", 999_999)).toBe(1000);
    expect(limiteDelPlan("OPERADOR", 50_000)).toBe(5000);
  });
});

describe("planMinimoPara", () => {
  it("dice a qué plan hay que subir para cada capacidad", () => {
    expect(planMinimoPara("instagram")).toBe("OPERADOR");
    expect(planMinimoPara("conector_tienda")).toBe("OPERADOR");
    expect(planMinimoPara("guias")).toBe("AUTOPILOT");
    expect(planMinimoPara("compras")).toBe("AUTOPILOT");
  });
});
