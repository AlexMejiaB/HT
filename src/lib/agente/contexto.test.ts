import { describe, it, expect } from "vitest";
import { formatearContexto, formatearEjemplos, type ContextoTenant } from "@/lib/agente/conocimiento";
import { periodoActual } from "@/lib/agente/uso";

const base: ContextoTenant = {
  nombre: "Tienda Piloto",
  tonoMarca: "Cercano",
  politicaEnvios: "Envíos a todo México.",
  politicaCambios: null,
  politicaDevoluciones: null,
  horarios: null,
  umbralConfianza: 0.7,
  instruccionesExtra: null,
  llmModelo: null,
  llmTemperatura: null,
  llmRazonamiento: null,
};

const producto = {
  sku: "TEN-001",
  nombre: "Tenis Runner Negro",
  precioCentavos: 129900,
  moneda: "MXN",
  stock: 14,
  lineaId: "linea-deportiva",
};

describe("formatearContexto", () => {
  it("incluye el subcontexto de la línea consultada", () => {
    const t = formatearContexto(base, [producto], [], {
      id: "linea-deportiva",
      nombre: "Deportivo",
      contexto: "Los tenis deportivos tienen garantía de 6 meses en suela.",
    });
    expect(t).toContain("LÍNEA CONSULTADA: Deportivo");
    expect(t).toContain("garantía de 6 meses");
  });

  it("omite el bloque de línea cuando no hay ninguna", () => {
    const t = formatearContexto(base, [producto], [], null);
    expect(t).not.toContain("LÍNEA CONSULTADA");
  });

  it("expresa el precio en pesos, no en centavos", () => {
    const t = formatearContexto(base, [producto], []);
    expect(t).toContain("$1299.00 MXN");
    expect(t).not.toContain("129900");
  });

  it("dice explícitamente que no hay coincidencias en vez de callar", () => {
    // Si el bloque faltara, el modelo podría inventarse el catálogo.
    const t = formatearContexto(base, [], []);
    expect(t).toContain("ninguno coincide");
  });

  it("marca la falta de existencias", () => {
    const t = formatearContexto(base, [{ ...producto, stock: 0 }], []);
    expect(t).toContain("Sin existencia");
  });
});

describe("formatearEjemplos", () => {
  it("devuelve vacío cuando no hay ejemplos", () => {
    expect(formatearEjemplos([])).toBe("");
  });

  it("presenta los pares y advierte que no se copien los datos", () => {
    const t = formatearEjemplos([{ pregunta: "¿hacen envíos?", respuesta: "Sí, a todo México." }]);
    expect(t).toContain("¿hacen envíos?");
    expect(t).toContain("Sí, a todo México.");
    expect(t).toMatch(/no copies los datos/i);
  });
});

describe("periodoActual", () => {
  it("usa el formato YYYY-MM con mes de dos dígitos", () => {
    expect(periodoActual(new Date(2026, 0, 15))).toBe("2026-01");
    expect(periodoActual(new Date(2026, 11, 1))).toBe("2026-12");
  });
});
