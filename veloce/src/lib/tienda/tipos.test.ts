import { describe, it, expect } from "vitest";
import { normalizarEstado, telefonoCoincide } from "@/lib/tienda/tipos";

describe("normalizarEstado", () => {
  it("mapea el vocabulario de cada plataforma a un estado común", () => {
    expect(normalizarEstado("fulfilled")).toBe("enviado");
    expect(normalizarEstado("shipped")).toBe("enviado");
    expect(normalizarEstado("enviado")).toBe("enviado");
    expect(normalizarEstado("delivered")).toBe("entregado");
    expect(normalizarEstado("completed")).toBe("entregado");
    expect(normalizarEstado("processing")).toBe("preparando");
    expect(normalizarEstado("paid")).toBe("pagado");
    expect(normalizarEstado("pending")).toBe("pendiente");
    expect(normalizarEstado("cancelled")).toBe("cancelado");
    expect(normalizarEstado("refunded")).toBe("cancelado");
  });

  it("cae en desconocido en vez de inventar", () => {
    expect(normalizarEstado("algo-rarisimo")).toBe("desconocido");
    expect(normalizarEstado("")).toBe("desconocido");
  });
});

describe("telefonoCoincide — comprobación de titularidad", () => {
  it("acepta el mismo número con distinto formato", () => {
    expect(telefonoCoincide("+52 1 55 8765 4321", "5215587654321")).toBe(true);
    expect(telefonoCoincide("(55) 8765-4321", "5215587654321")).toBe(true);
    expect(telefonoCoincide("55 8765 4321", "5587654321")).toBe(true);
  });

  it("rechaza números distintos", () => {
    expect(telefonoCoincide("5215587654321", "5215511112222")).toBe(false);
  });

  it("rechaza valores ausentes o demasiado cortos para comparar", () => {
    // Sin esto, un pedido sin teléfono registrado se entregaría a cualquiera.
    expect(telefonoCoincide(null, "5215587654321")).toBe(false);
    expect(telefonoCoincide(undefined, "5215587654321")).toBe(false);
    expect(telefonoCoincide("", "5215587654321")).toBe(false);
    expect(telefonoCoincide("1234", "1234")).toBe(false);
  });
});
