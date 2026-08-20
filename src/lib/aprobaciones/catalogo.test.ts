import { describe, it, expect } from "vitest";
import { obtenerAccion, accionesRegistradas } from "@/lib/aprobaciones/registro";

// Importar el módulo puebla el registro. Va en su propio archivo porque el
// caché de ESM lo ejecuta una sola vez: no se puede alternar entre registro
// vacío y catálogo real dentro del mismo archivo de pruebas.
import "@/lib/aprobaciones/acciones";

describe("catálogo real de acciones", () => {

  it("clasifica cada acción en el nivel correcto", () => {
    const porNivel = Object.fromEntries(
      accionesRegistradas().map((a) => [a.accion, a.nivel]),
    );

    // Facturar es irreversible ante el SAT: siempre bloquea.
    expect(porNivel["emitir_factura"]).toBe("BLOQUEO");
    // Lo que ve el cliente o descuadra inventario se revisa.
    expect(porNivel["enviar_mensaje_proactivo"]).toBe("REVISION");
    expect(porNivel["ajustar_stock"]).toBe("REVISION");
    // Lo interno y reversible corre solo.
    expect(porNivel["anotar_conversacion"]).toBe("AUTOMATICO");
    expect(porNivel["etiquetar_conversacion"]).toBe("AUTOMATICO");
  });

  it("BLOQUEO nunca tiene plazo de vencimiento", () => {
    for (const a of accionesRegistradas().filter((x) => x.nivel === "BLOQUEO")) {
      // Un plazo en BLOQUEO abriría la puerta a que venza y alguien lo trate
      // como aprobado. No debe existir.
      expect(a.plazoMinutos, a.accion).toBeUndefined();
    }
  });

  it("toda acción de REVISION define un plazo", () => {
    for (const a of accionesRegistradas().filter((x) => x.nivel === "REVISION")) {
      expect(a.plazoMinutos, a.accion).toBeGreaterThan(0);
    }
  });

  it("la proporción de acciones bloqueantes se mantiene baja", () => {
    const todas = accionesRegistradas();
    const bloqueo = todas.filter((a) => a.nivel === "BLOQUEO").length;
    // Si la mayoría bloquea, el alcance del agente está mal planteado.
    expect(bloqueo / todas.length).toBeLessThan(0.4);
  });
});

describe("validación de argumentos de facturación", () => {
  it("rechaza un RFC mal formado antes de llegar al SAT", () => {
    const def = obtenerAccion("emitir_factura")!;
    const base = {
      razonSocial: "EMPRESA SA DE CV",
      codigoPostal: "37000",
      regimenFiscal: "601",
      usoCfdi: "G03",
      conceptos: [
        {
          claveProdServ: "01010101",
          claveUnidad: "H87",
          descripcion: "Producto",
          cantidad: 1,
          valorUnitario: 100,
        },
      ],
      formaPago: "03",
      metodoPago: "PUE",
    };
    expect(def.esquema.safeParse({ ...base, rfc: "XAXX010101000" }).success).toBe(true);
    expect(def.esquema.safeParse({ ...base, rfc: "NOSOYUNRFC" }).success).toBe(false);
    expect(def.esquema.safeParse({ ...base, rfc: "" }).success).toBe(false);
  });

  it("exige código postal de 5 dígitos", () => {
    const def = obtenerAccion("emitir_factura")!;
    const r = def.esquema.safeParse({
      rfc: "XAXX010101000",
      razonSocial: "EMPRESA SA DE CV",
      codigoPostal: "370",
      regimenFiscal: "601",
      usoCfdi: "G03",
      conceptos: [
        {
          claveProdServ: "01010101",
          claveUnidad: "H87",
          descripcion: "X",
          cantidad: 1,
          valorUnitario: 1,
        },
      ],
      formaPago: "03",
      metodoPago: "PUE",
    });
    expect(r.success).toBe(false);
  });

  it("el contexto para quien aprueba incluye el aviso de razón social exacta", () => {
    const def = obtenerAccion("emitir_factura")!;
    const texto = def.describir({
      rfc: "xaxx010101000",
      razonSocial: "EMPRESA SA DE CV",
      codigoPostal: "37000",
      regimenFiscal: "601",
      usoCfdi: "G03",
      conceptos: [
        {
          claveProdServ: "01010101",
          claveUnidad: "H87",
          descripcion: "Tenis",
          cantidad: 2,
          valorUnitario: 1299,
        },
      ],
      formaPago: "03",
      metodoPago: "PUE",
    } as never);
    expect(texto).toContain("XAXX010101000");
    expect(texto).toContain("2598.00");
    expect(texto).toMatch(/constancia fiscal/i);
  });
});
