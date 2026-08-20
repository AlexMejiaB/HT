import { describe, it, expect } from "vitest";
import { componerAviso } from "@/lib/agente/notificar";

const base = {
  tenantId: "t1",
  phoneNumberId: "PNID",
  tokenCifrado: "x",
  escalamientoId: "e1",
  contacto: { nombre: "Laura Méndez", telefono: "5215587654321" },
  motivo: "Solicitud fuera del alcance del agente",
  resumen: "La clienta quiere factura",
};

describe("componerAviso", () => {
  it("incluye todo lo que el brief exige entregar al equipo", () => {
    const t = componerAviso({
      ...base,
      accionSugerida: "Pedir datos fiscales",
      referencia: "Tenis Runner Negro",
    });
    expect(t).toContain("Laura Méndez");
    expect(t).toContain("5215587654321");
    expect(t).toContain("Solicitud fuera del alcance");
    expect(t).toContain("La clienta quiere factura");
    expect(t).toContain("Tenis Runner Negro");
    expect(t).toContain("Pedir datos fiscales");
  });

  it("omite las líneas opcionales sin dejar huecos", () => {
    const t = componerAviso(base);
    expect(t).not.toContain("undefined");
    expect(t).not.toContain("Acción sugerida:");
    expect(t).not.toContain("Relacionado:");
  });

  it("aguanta un contacto sin nombre", () => {
    const t = componerAviso({ ...base, contacto: { nombre: null, telefono: "521555" } });
    expect(t).toContain("sin nombre");
    expect(t).not.toContain("null");
  });
});
