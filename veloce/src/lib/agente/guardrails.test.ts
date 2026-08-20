import { describe, it, expect } from "vitest";
import {
  evaluarEntrada,
  confianzaSuficiente,
  redactarDatosSensibles,
  respuestaViolaGuardrails,
} from "@/lib/agente/guardrails";

describe("evaluarEntrada — casos que nunca resuelve el agente", () => {
  it("escala cuando el cliente pide una persona", () => {
    for (const texto of [
      "quiero hablar con una persona",
      "me pasas con un humano por favor",
      "necesito hablar con alguien",
      "pásame con un asesor",
    ]) {
      expect(evaluarEntrada(texto, null).accion, texto).toBe("escalar");
    }
  });

  it("escala ante dinero, documentos fiscales y cambios de pedido", () => {
    for (const texto of [
      "quiero un reembolso",
      "necesito cancelar mi pedido",
      "me pueden dar factura",
      "necesito el CFDI",
      "me haces un descuento?",
      "quiero cambiar la dirección de envío",
      "cuál es mi número de rastreo",
    ]) {
      expect(evaluarEntrada(texto, null).accion, texto).toBe("escalar");
    }
  });

  it("escala ante incidencias graves", () => {
    for (const texto of [
      "no me llegó el paquete",
      "el producto llegó roto",
      "esto es un fraude",
      "tengo un cargo no reconocido",
      "voy a ir a profeco",
    ]) {
      expect(evaluarEntrada(texto, null).accion, texto).toBe("escalar");
    }
  });

  it("deja pasar preguntas normales de venta", () => {
    for (const texto of [
      "hola, tienen disponible el modelo negro?",
      "cuánto cuesta la mochila urbana",
      "hacen envíos a Monterrey?",
      "qué talla me recomiendan",
    ]) {
      expect(evaluarEntrada(texto, null).accion, texto).toBe("responder");
    }
  });

  it("escala por intención aunque el texto no dispare ningún patrón", () => {
    expect(evaluarEntrada("ok", "QUEJA").accion).toBe("escalar");
    expect(evaluarEntrada("ok", "HUMANO").accion).toBe("escalar");
    expect(evaluarEntrada("ok", "DEVOLUCION").accion).toBe("escalar");
    expect(evaluarEntrada("ok", "PRODUCTO").accion).toBe("responder");
  });
});

describe("datos de pago — regla no negociable", () => {
  it("detecta una tarjeta y pide redactar y escalar", () => {
    const r = evaluarEntrada("mi tarjeta es 4111 1111 1111 1111", null);
    expect(r.accion).toBe("redactar_y_escalar");
  });

  it("detecta el CVV", () => {
    const r = evaluarEntrada("el cvv es 123", null);
    expect(r.accion).toBe("redactar_y_escalar");
  });

  // Un regex con flag /g conserva lastIndex entre llamadas a .test(),
  // así que la segunda invocación puede devolver false sobre el mismo texto.
  // Este caso lo cubre explícitamente porque sería un fallo silencioso.
  it("sigue detectando la tarjeta en llamadas sucesivas", () => {
    const texto = "mi tarjeta es 4111 1111 1111 1111";
    expect(evaluarEntrada(texto, null).accion).toBe("redactar_y_escalar");
    expect(evaluarEntrada(texto, null).accion).toBe("redactar_y_escalar");
    expect(evaluarEntrada(texto, null).accion).toBe("redactar_y_escalar");
  });

  it("redacta el número antes de persistirlo", () => {
    const salida = redactarDatosSensibles("paga con 4111 1111 1111 1111 ok");
    expect(salida).not.toContain("4111");
    expect(salida).toContain("[dato de pago removido]");
  });

  it("no confunde un teléfono con una tarjeta", () => {
    // En WhatsApp el cliente escribe su número constantemente; un falso
    // positivo aquí escalaría media operación sin motivo.
    for (const texto of [
      "mi número es 52 1 55 1234 5678",
      "márcame al 5512345678",
      "mi pedido es el 2026081900123456",
    ]) {
      expect(evaluarEntrada(texto, null).accion, texto).not.toBe("redactar_y_escalar");
    }
  });

  it("no destruye texto normal con números", () => {
    const salida = redactarDatosSensibles("quiero 2 piezas del sku TEN-001");
    expect(salida).toBe("quiero 2 piezas del sku TEN-001");
  });
});

describe("respuestaViolaGuardrails — última barrera", () => {
  it("bloquea promesas que el agente no puede cumplir", () => {
    for (const texto of [
      "claro, te hago un descuento del 10%",
      "listo, ya cancelé tu pedido",
      "te devuelvo el dinero hoy mismo",
      "genero tu factura en un momento",
      "te garantizo que llega mañana",
    ]) {
      expect(respuestaViolaGuardrails(texto), texto).not.toBeNull();
    }
  });

  it("deja pasar respuestas correctas", () => {
    for (const texto of [
      "Sí, tenemos el modelo negro disponible. Cuesta $1,299.00 MXN.",
      "A León el envío tarda de 2 a 3 días hábiles.",
      "Déjame pasar tu caso con una persona del equipo.",
    ]) {
      expect(respuestaViolaGuardrails(texto), texto).toBeNull();
    }
  });
});

describe("confianzaSuficiente", () => {
  it("respeta el umbral del tenant", () => {
    expect(confianzaSuficiente(0.9, 0.7)).toBe(true);
    expect(confianzaSuficiente(0.7, 0.7)).toBe(true);
    expect(confianzaSuficiente(0.69, 0.7)).toBe(false);
  });
});
