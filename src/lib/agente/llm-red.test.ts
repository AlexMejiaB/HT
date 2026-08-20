import { describe, it, expect, vi, afterEach } from "vitest";
import { completar, ErrorLLM } from "@/lib/agente/llm";

/**
 * Pruebas del adaptador contra las respuestas REALES capturadas de la capa de
 * compatibilidad de Google. Sin estas, dos comportamientos suyos rompen el
 * agente en silencio: envuelve el cuerpo en un array y usa 400 para la llave.
 */

type LlamadaFetch = [string, RequestInit];

/** Mock con la firma de fetch, para poder inspeccionar el cuerpo enviado. */
function mockFetch(impl: (...a: LlamadaFetch) => Promise<Response>) {
  return vi.fn(impl);
}

function cuerpoDe(espia: ReturnType<typeof mockFetch>, i = 0): Record<string, unknown> {
  const llamada = espia.mock.calls[i];
  if (!llamada) throw new Error(`No hubo llamada ${i}`);
  return JSON.parse(String(llamada[1].body));
}

function responder(cuerpo: unknown, estado = 200) {
  return new Response(JSON.stringify(cuerpo), {
    status: estado,
    headers: { "content-type": "application/json" },
  });
}

afterEach(() => vi.unstubAllGlobals());

describe("respuestas envueltas en array (Gemini)", () => {
  it("desenvuelve el array y lee el contenido", async () => {
    // Forma real de Google: [{...}] en vez de {...}
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        responder([{ choices: [{ message: { content: "hola desde gemini" } }] }]),
      ),
    );
    const r = await completar([{ role: "user", content: "x" }]);
    expect(r.texto).toBe("hola desde gemini");
  });

  it("sigue funcionando con la forma normal de objeto", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => responder({ choices: [{ message: { content: "hola" } }] })),
    );
    const r = await completar([{ role: "user", content: "x" }]);
    expect(r.texto).toBe("hola");
  });
});

describe("medición de consumo", () => {
  it("reporta los tokens que informa el proveedor", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        responder({
          choices: [{ message: { content: "ok" } }],
          usage: { prompt_tokens: 60, completion_tokens: 27, total_tokens: 329 },
        }),
      ),
    );
    const r = await completar([{ role: "user", content: "x" }]);
    // El total (329) supera entrada+salida (87): la diferencia son tokens de
    // razonamiento, que se cobran aunque no aparezcan como salida.
    expect(r.uso).toEqual({ entrada: 60, salida: 27, total: 329 });
  });

  it("deduce el total cuando el proveedor no lo manda", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        responder({
          choices: [{ message: { content: "ok" } }],
          usage: { prompt_tokens: 10, completion_tokens: 5 },
        }),
      ),
    );
    const r = await completar([{ role: "user", content: "x" }]);
    expect(r.uso.total).toBe(15);
  });
});

describe("configuración por cliente", () => {
  it("el modelo y la temperatura del tenant ganan al valor global", async () => {
    const espia = mockFetch(async () => responder({ choices: [{ message: { content: "ok" } }] }));
    vi.stubGlobal("fetch", espia);

    await completar([{ role: "user", content: "x" }], {
      temperatura: 0.3,
      config: { modelo: "gemini-2.5-flash-lite", temperatura: 0.9, razonamiento: "low" },
    });

    const cuerpo = cuerpoDe(espia);
    expect(cuerpo.model).toBe("gemini-2.5-flash-lite");
    expect(cuerpo.temperature).toBe(0.9);
    expect(cuerpo.reasoning_effort).toBe("low");
  });

  it("sin configuración del tenant usa el valor global", async () => {
    const espia = mockFetch(async () => responder({ choices: [{ message: { content: "ok" } }] }));
    vi.stubGlobal("fetch", espia);

    await completar([{ role: "user", content: "x" }], { temperatura: 0.3 });

    const cuerpo = cuerpoDe(espia);
    expect(cuerpo.model).toBe("gemini-3.7-flash");
    expect(cuerpo.temperature).toBe(0.3);
  });
});

describe("400 de Gemini con llave inválida", () => {
  const cuerpoLlaveMala = [
    { error: { code: 400, message: "Please pass a valid API key", status: "INVALID_ARGUMENT" } },
  ];

  it("da la pista correcta en vez de una genérica", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => responder(cuerpoLlaveMala, 400)));
    try {
      await completar([{ role: "user", content: "x" }]);
      throw new Error("debió lanzar");
    } catch (e) {
      expect(e).toBeInstanceOf(ErrorLLM);
      expect((e as ErrorLLM).pista).toMatch(/llave/i);
    }
  });

  it("NO reintenta cuando el 400 es por la llave", async () => {
    // Reintentar a ciegas duplicaría cada petición fallida.
    const espia = vi.fn(async () => responder(cuerpoLlaveMala, 400));
    vi.stubGlobal("fetch", espia);
    await expect(
      completar([{ role: "user", content: "x" }], { json: true }),
    ).rejects.toBeInstanceOf(ErrorLLM);
    expect(espia).toHaveBeenCalledTimes(1);
  });
});

describe("proveedor que no soporta response_format", () => {
  it("reintenta sin el parámetro y devuelve el contenido", async () => {
    const espia = mockFetch(async () => responder({}))
      .mockResolvedValueOnce(
        responder({ error: { message: "Unknown name \"response_format\"" } }, 400),
      )
      .mockResolvedValueOnce(responder({ choices: [{ message: { content: '{"ok":1}' } }] }));
    vi.stubGlobal("fetch", espia);

    const r = await completar([{ role: "user", content: "x" }], { json: true });
    expect(r.texto).toBe('{"ok":1}');
    expect(espia).toHaveBeenCalledTimes(2);

    // El segundo intento va sin response_format.
    const segundo = cuerpoDe(espia as ReturnType<typeof mockFetch>, 1);
    expect(segundo.response_format).toBeUndefined();
  });
});

describe("errores accionables", () => {
  it("distingue saldo agotado", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => responder({ error: { message: "no credits" } }, 402)));
    await expect(completar([{ role: "user", content: "x" }])).rejects.toMatchObject({
      pista: expect.stringMatching(/saldo/i),
    });
  });

  it("distingue límite de peticiones", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => responder({ error: { message: "rate" } }, 429)));
    await expect(completar([{ role: "user", content: "x" }])).rejects.toMatchObject({
      pista: expect.stringMatching(/límite/i),
    });
  });

  it("detecta un error devuelto dentro de un 200", async () => {
    // Algunos proveedores responden 200 con el error en el cuerpo.
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => responder({ error: { message: "modelo sobrecargado" } })),
    );
    await expect(completar([{ role: "user", content: "x" }])).rejects.toThrow(/sobrecargado/);
  });

  it("una respuesta vacía no pasa como válida", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => responder({ choices: [{ message: { content: "  " } }] })));
    await expect(completar([{ role: "user", content: "x" }])).rejects.toThrow(/vacía/);
  });

  it("un fallo de red da un mensaje legible", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("ECONNREFUSED"); }));
    await expect(completar([{ role: "user", content: "x" }])).rejects.toMatchObject({
      pista: expect.stringMatching(/conexión/i),
    });
  });
});
