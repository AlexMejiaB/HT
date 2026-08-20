import { describe, it, expect } from "vitest";
import { puede } from "@/lib/permisos";

describe("permisos por rol", () => {
  it("el dueño puede configurar y autorizar dinero", () => {
    expect(puede("DUENO", "configurar")).toBe(true);
    expect(puede("DUENO", "equipo")).toBe(true);
    expect(puede("DUENO", "aprobar_bloqueo")).toBe(true);
  });

  it("el agente atiende pero no configura ni autoriza dinero", () => {
    expect(puede("AGENTE", "panel")).toBe(true);
    expect(puede("AGENTE", "aprobar_revision")).toBe(true);
    expect(puede("AGENTE", "aprobar_bloqueo")).toBe(false);
    expect(puede("AGENTE", "configurar")).toBe(false);
    expect(puede("AGENTE", "equipo")).toBe(false);
  });

  it("sólo soporte entra a la consola multi-tenant", () => {
    expect(puede("SOPORTE_VELOCE", "admin")).toBe(true);
    expect(puede("DUENO", "admin")).toBe(false);
    expect(puede("AGENTE", "admin")).toBe(false);
  });

  it("un rol desconocido no puede nada", () => {
    // Si el JWT trae un rol inventado, el resultado debe ser denegar todo.
    expect(puede("ROL_INVENTADO", "panel")).toBe(false);
    expect(puede("", "panel")).toBe(false);
  });
});
