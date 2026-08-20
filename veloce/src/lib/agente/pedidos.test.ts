import { describe, it, expect } from "vitest";
import { extraerNumeroPedido, redactarEstatus } from "@/lib/agente/pedidos";
import type { PedidoTienda } from "@/lib/tienda/tipos";

describe("extraerNumeroPedido", () => {
  it("reconoce los formatos que escribe la gente", () => {
    expect(extraerNumeroPedido("hola, mi pedido #1234 dónde va?")).toBe("1234");
    expect(extraerNumeroPedido("pedido 45678")).toBe("45678");
    expect(extraerNumeroPedido("orden #98765")).toBe("98765");
    expect(extraerNumeroPedido("mi folio es 100234")).toBe("100234");
    expect(extraerNumeroPedido("compra numero 5551")).toBe("5551");
  });

  it("devuelve null cuando no hay número", () => {
    expect(extraerNumeroPedido("dónde va mi pedido?")).toBeNull();
    expect(extraerNumeroPedido("hola")).toBeNull();
  });
});

describe("redactarEstatus", () => {
  const base: PedidoTienda = {
    numero: "1234",
    estado: "enviado",
    estadoCrudo: "fulfilled",
    totalCentavos: 129900,
    moneda: "MXN",
    fecha: "2026-08-01",
    items: [{ nombre: "Tenis", cantidad: 1 }],
  };

  it("incluye el rastreo cuando el pedido va en camino", () => {
    const t = redactarEstatus({ ...base, rastreo: "ABC123", urlRastreo: "https://x.mx/ABC123" });
    expect(t).toContain("1234");
    expect(t).toContain("en camino");
    expect(t).toContain("ABC123");
    expect(t).toContain("https://x.mx/ABC123");
  });

  it("no promete rastreo si no lo hay", () => {
    const t = redactarEstatus(base);
    expect(t).not.toContain("rastreo");
  });

  it("no inventa nada para un estado desconocido", () => {
    const t = redactarEstatus({ ...base, estado: "desconocido", estadoCrudo: "???" });
    expect(t).toContain("en proceso");
    expect(t).not.toContain("undefined");
  });
});
