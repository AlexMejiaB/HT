import { describe, it, expect } from "vitest";
import { extraerJson, ErrorLLM } from "@/lib/agente/llm";

describe("extraerJson", () => {
  it("parsea JSON limpio", () => {
    expect(extraerJson('{"intencion":"PRODUCTO","confianza":0.9}')).toEqual({
      intencion: "PRODUCTO",
      confianza: 0.9,
    });
  });

  it("tolera espacios y saltos de línea alrededor", () => {
    expect(extraerJson('\n\n  {"a":1}  \n')).toEqual({ a: 1 });
  });

  it("extrae de un bloque de código markdown", () => {
    // Gemini y otros devuelven el JSON envuelto cuando no hay response_format.
    const salida = '```json\n{"intencion":"ENVIO","confianza":0.8}\n```';
    expect(extraerJson(salida)).toEqual({ intencion: "ENVIO", confianza: 0.8 });
  });

  it("extrae de un bloque sin etiqueta de lenguaje", () => {
    expect(extraerJson('```\n{"a":2}\n```')).toEqual({ a: 2 });
  });

  it("extrae aunque el modelo agregue prosa antes y después", () => {
    const salida =
      'Claro, aquí está la clasificación:\n{"intencion":"QUEJA","confianza":0.95}\nEspero que ayude.';
    expect(extraerJson(salida)).toEqual({ intencion: "QUEJA", confianza: 0.95 });
  });

  it("respeta objetos anidados", () => {
    const salida = 'texto {"a":{"b":{"c":1}},"d":2} más texto';
    expect(extraerJson(salida)).toEqual({ a: { b: { c: 1 } }, d: 2 });
  });

  it("no se confunde con llaves dentro de cadenas", () => {
    // Un resumen que contenga } rompería un extractor ingenuo.
    const salida = '{"resumen":"el cliente escribió } y luego {","confianza":0.7}';
    expect(extraerJson(salida)).toEqual({
      resumen: "el cliente escribió } y luego {",
      confianza: 0.7,
    });
  });

  it("respeta comillas escapadas dentro de cadenas", () => {
    const salida = '{"resumen":"dijo \\"hola\\" y se fue"}';
    expect(extraerJson<{ resumen: string }>(salida).resumen).toBe('dijo "hola" y se fue');
  });

  it("lanza ErrorLLM con pista cuando no hay JSON", () => {
    try {
      extraerJson("No puedo ayudarte con eso.");
      throw new Error("debió lanzar");
    } catch (e) {
      expect(e).toBeInstanceOf(ErrorLLM);
      expect((e as ErrorLLM).pista).toBeTruthy();
    }
  });

  it("lanza si el JSON está truncado", () => {
    // Pasa cuando max_tokens corta la respuesta a la mitad.
    expect(() => extraerJson('{"intencion":"PRODUCTO","res')).toThrow(ErrorLLM);
  });
});
