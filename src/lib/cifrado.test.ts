import { describe, it, expect } from "vitest";
import { createHmac } from "node:crypto";
import { cifrar, descifrar, firmaMetaValida } from "@/lib/cifrado";

describe("cifrado de tokens en reposo", () => {
  it("descifra lo que cifró", () => {
    const original = "EAABw...token-de-whatsapp";
    expect(descifrar(cifrar(original))).toBe(original);
  });

  it("produce un texto distinto en cada cifrado", () => {
    // IV aleatorio por registro: dos tokens iguales no deben verse iguales
    // en la base, o se filtra qué tenants comparten credencial.
    const a = cifrar("mismo-token");
    const b = cifrar("mismo-token");
    expect(a).not.toBe(b);
    expect(descifrar(a)).toBe(descifrar(b));
  });

  it("rechaza un texto manipulado", () => {
    const cifrado = cifrar("token");
    const [iv, tag, datos] = cifrado.split(".");
    const alterado = [iv, tag, Buffer.from("otracosa").toString("base64")].join(".");
    // GCM autentica: alterar el contenido debe fallar, no devolver basura.
    expect(() => descifrar(alterado)).toThrow();
  });

  it("rechaza formatos inválidos", () => {
    expect(() => descifrar("no-tiene-puntos")).toThrow("Formato de cifrado inválido");
    expect(() => descifrar("")).toThrow();
  });

  it("maneja acentos y emoji", () => {
    const texto = "configuración ñ 🚀";
    expect(descifrar(cifrar(texto))).toBe(texto);
  });
});

describe("firma del webhook de Meta", () => {
  const cuerpo = JSON.stringify({ entry: [{ id: "1" }] });
  const firmar = (b: string, secreto = "app-secret-de-pruebas") =>
    "sha256=" + createHmac("sha256", secreto).update(b, "utf8").digest("hex");

  it("acepta una firma correcta", () => {
    expect(firmaMetaValida(cuerpo, firmar(cuerpo))).toBe(true);
  });

  it("rechaza si el cuerpo cambió aunque sea un byte", () => {
    expect(firmaMetaValida(cuerpo + " ", firmar(cuerpo))).toBe(false);
  });

  it("rechaza una firma de otro secreto", () => {
    expect(firmaMetaValida(cuerpo, firmar(cuerpo, "secreto-equivocado"))).toBe(false);
  });

  it("rechaza cabeceras ausentes o mal formadas", () => {
    expect(firmaMetaValida(cuerpo, null)).toBe(false);
    expect(firmaMetaValida(cuerpo, "")).toBe(false);
    expect(firmaMetaValida(cuerpo, "sha1=abc")).toBe(false);
    // Sin el prefijo esperado, aunque el hex sea correcto.
    expect(firmaMetaValida(cuerpo, firmar(cuerpo).replace("sha256=", ""))).toBe(false);
  });

  it("rechaza una firma de longitud distinta sin reventar", () => {
    expect(firmaMetaValida(cuerpo, "sha256=abcd")).toBe(false);
  });
});
