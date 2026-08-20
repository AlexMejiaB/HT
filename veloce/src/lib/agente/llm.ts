import { env } from "@/lib/env";

/**
 * Adaptador de modelo de lenguaje.
 *
 * Se habla contra una API con forma de OpenAI, que es lo que exponen
 * OpenRouter, la capa de compatibilidad de Google (Gemini), vLLM y Ollama.
 * Cambiar de proveedor son tres variables de entorno, no un refactor.
 *
 * Proveedores probados:
 *   Gemini directo  https://generativelanguage.googleapis.com/v1beta/openai
 *   OpenRouter      https://openrouter.ai/api/v1
 */

export type MensajeLLM = {
  role: "system" | "user" | "assistant";
  content: string;
};

/**
 * Ajustes del modelo por cliente. Cada campo nulo cae al valor global del
 * entorno, así un negocio puede pedir un modelo más capaz sin que eso obligue
 * a cambiarlo para todos.
 */
export type ConfigModelo = {
  modelo?: string | null;
  temperatura?: number | null;
  razonamiento?: string | null;
};

/** Consumo de una llamada, para el tope de gasto y los reportes. */
export type Uso = {
  entrada: number;
  salida: number;
  total: number;
};

export type RespuestaLLM = {
  texto: string;
  uso: Uso;
};

export type OpcionesLLM = {
  /** Temperatura baja por defecto: aquí no queremos creatividad. */
  temperatura?: number;
  maxTokens?: number;
  /** Pide salida JSON cuando esperamos una estructura. */
  json?: boolean;
  señal?: AbortSignal;
  /** Ajustes del tenant; sobreescriben entorno y valores por defecto. */
  config?: ConfigModelo;
};

/**
 * Los modelos con razonamiento (Gemini 3.x y equivalentes) piensan antes de
 * responder, y ese pensamiento **consume el presupuesto de `max_tokens` y se
 * cobra**. Con un presupuesto corto la respuesta llega truncada o vacía.
 *
 * Medido contra gemini-3.7-flash con el prompt "Responde exactamente: listo":
 *   sin el parámetro   -> ~396 tokens de pensamiento
 *   reasoning_effort "low"  -> ~298
 *   reasoning_effort "none" -> ~242
 *
 * Ponerlo en "none" ahorra ~39%, pero NO elimina el pensamiento: Gemini 3.x
 * siempre delibera algo. Por eso `max_tokens` va holgado — el modo de fallo es
 * truncar la respuesta a media frase, y sólo se paga lo que se genera.
 */
function razonamientoConfigurado(config?: ConfigModelo): string | null {
  const v = (config?.razonamiento ?? process.env.LLM_RAZONAMIENTO ?? "none")
    .trim()
    .toLowerCase();
  // Cadena vacía = no mandar el parámetro, para proveedores que lo rechazan.
  return v === "" || v === "omitir" ? null : v;
}

export class ErrorLLM extends Error {
  constructor(
    message: string,
    readonly estado?: number,
    /** Pista accionable para quien configura, no para el cliente final. */
    readonly pista?: string,
  ) {
    super(message);
    this.name = "ErrorLLM";
  }
}

/**
 * ¿El 400 viene de `response_format` y no de otra cosa?
 *
 * Importa distinguirlo: Gemini devuelve 400 también con llave inválida, y
 * reintentar a ciegas duplicaría cada petición fallida.
 */
function esRechazoDeFormatoJson(cuerpo: string): boolean {
  return (
    /response_format|json_object|json_schema|responseMimeType/i.test(cuerpo) &&
    !/api[ _-]?key/i.test(cuerpo)
  );
}

/** Traduce el código HTTP a algo que se pueda arreglar sin adivinar. */
function pistaPara(estado: number, cuerpo: string): string {
  if (estado === 401 || estado === 403) {
    return "La llave es inválida o no tiene permiso. Revisa LLM_API_KEY.";
  }
  if (estado === 402) {
    return "La cuenta no tiene saldo. Recarga con el proveedor.";
  }
  if (estado === 404) {
    return `No existe ese modelo en este proveedor. Revisa LLM_MODELO (actual: ${env().LLM_MODELO}).`;
  }
  if (estado === 429) {
    return "Límite de peticiones alcanzado. Espera o sube el plan.";
  }
  // Gemini responde 400 (no 401) cuando la llave es inválida.
  if (estado === 400 && /api[ _-]?key/i.test(cuerpo)) {
    return "La llave es inválida. Revisa LLM_API_KEY.";
  }
  if (estado === 400 && esRechazoDeFormatoJson(cuerpo)) {
    return "El proveedor no acepta response_format; se reintenta sin él.";
  }
  if (estado === 400 && /model/i.test(cuerpo)) {
    return `Puede que el modelo no exista en este proveedor. Revisa LLM_MODELO (actual: ${env().LLM_MODELO}).`;
  }
  if (estado >= 500) {
    return "El proveedor está fallando. No es configuración: reintenta más tarde.";
  }
  return "Revisa LLM_BASE_URL, LLM_MODELO y LLM_API_KEY.";
}

async function llamar(
  mensajes: MensajeLLM[],
  opciones: OpcionesLLM,
  conFormatoJson: boolean,
  conRazonamiento: boolean,
): Promise<Response> {
  const { LLM_BASE_URL, LLM_API_KEY, LLM_MODELO } = env();
  const razonamiento = conRazonamiento ? razonamientoConfigurado(opciones.config) : null;
  const modelo = opciones.config?.modelo || LLM_MODELO;

  return fetch(`${LLM_BASE_URL.replace(/\/$/, "")}/chat/completions`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${LLM_API_KEY}`,
    },
    body: JSON.stringify({
      model: modelo,
      messages: mensajes,
      temperature: opciones.config?.temperatura ?? opciones.temperatura ?? 0.2,
      max_tokens: opciones.maxTokens ?? 2000,
      ...(conFormatoJson ? { response_format: { type: "json_object" } } : {}),
      ...(razonamiento ? { reasoning_effort: razonamiento } : {}),
    }),
    signal: opciones.señal ?? AbortSignal.timeout(30_000),
  });
}

export async function completar(
  mensajes: MensajeLLM[],
  opciones: OpcionesLLM = {},
): Promise<RespuestaLLM> {
  let r: Response;
  try {
    r = await llamar(mensajes, opciones, Boolean(opciones.json), true);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "error de red";
    throw new ErrorLLM(
      `No se pudo contactar al modelo: ${msg}`,
      undefined,
      "Revisa la conexión y que LLM_BASE_URL sea alcanzable.",
    );
  }

  // Algunos proveedores compatibles no implementan response_format y devuelven
  // 400. Se reintenta sin él sólo si el error habla del formato: el prompt ya
  // pide JSON explícitamente y la extracción tolera que venga envuelto.
  if (!r.ok && r.status === 400) {
    const cuerpo = await r.clone().text().catch(() => "");
    if (opciones.json && esRechazoDeFormatoJson(cuerpo)) {
      r = await llamar(mensajes, opciones, false, true);
    } else if (/reasoning_effort/i.test(cuerpo)) {
      // Proveedor que no conoce el parámetro de razonamiento.
      r = await llamar(mensajes, opciones, Boolean(opciones.json), false);
    }
  }

  if (!r.ok) {
    const detalle = await r.text().catch(() => "");
    throw new ErrorLLM(
      `El modelo respondió ${r.status}: ${detalle.slice(0, 300)}`,
      r.status,
      pistaPara(r.status, detalle),
    );
  }

  type RespuestaChat = {
    choices?: { message?: { content?: string }; finish_reason?: string }[];
    error?: { message?: string };
    usage?: {
      prompt_tokens?: number;
      completion_tokens?: number;
      total_tokens?: number;
    };
  };

  // La capa de compatibilidad de Google envuelve el cuerpo en un array.
  // Sin desenvolverlo, `choices` sale undefined y todo parece "respuesta vacía".
  const crudo: unknown = await r.json();
  const datos = (Array.isArray(crudo) ? crudo[0] : crudo) as RespuestaChat;

  // Algunos proveedores devuelven 200 con un error dentro del cuerpo.
  if (datos.error?.message) {
    throw new ErrorLLM(`El proveedor devolvió un error: ${datos.error.message}`);
  }

  const eleccion = datos.choices?.[0];
  const contenido = eleccion?.message?.content;

  if (!contenido?.trim()) {
    // Causa habitual con modelos que razonan: el pensamiento agotó el
    // presupuesto y no quedaron tokens para la respuesta visible.
    const porLimite = eleccion?.finish_reason === "length";
    throw new ErrorLLM(
      "El modelo devolvió una respuesta vacía",
      undefined,
      porLimite
        ? "El razonamiento agotó max_tokens. Sube maxTokens o define LLM_RAZONAMIENTO=none."
        : "Puede ser un filtro de seguridad del proveedor o un max_tokens muy bajo.",
    );
  }

  const u = datos.usage ?? {};
  const entrada = u.prompt_tokens ?? 0;
  const salida = u.completion_tokens ?? 0;
  // El total incluye los tokens de razonamiento, que no aparecen en
  // completion_tokens pero sí se cobran. Se guarda tal cual lo reporta el
  // proveedor para que el gasto medido coincida con la factura.
  const total = u.total_tokens ?? entrada + salida;

  return { texto: contenido, uso: { entrada, salida, total } };
}

/**
 * Extrae un objeto JSON de la respuesta del modelo.
 *
 * Sin `response_format` garantizado, un modelo devuelve el JSON envuelto en
 * ```json ... ``` o precedido de una frase. Parsear directo fallaría y el
 * agente escalaría cada mensaje: correcto pero inservible.
 */
export function extraerJson<T = unknown>(texto: string): T {
  const limpio = texto.trim();

  try {
    return JSON.parse(limpio) as T;
  } catch {
    // Sigue con las estrategias de abajo.
  }

  // Bloque de código markdown, con o sin etiqueta de lenguaje.
  const fence = limpio.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence?.[1]) {
    try {
      return JSON.parse(fence[1].trim()) as T;
    } catch {
      // Sigue.
    }
  }

  // Primer objeto balanceado del texto, ignorando llaves dentro de cadenas.
  const inicio = limpio.indexOf("{");
  if (inicio >= 0) {
    let profundidad = 0;
    let enCadena = false;
    let escapado = false;
    for (let i = inicio; i < limpio.length; i++) {
      const c = limpio[i];
      if (escapado) {
        escapado = false;
        continue;
      }
      if (c === "\\") {
        escapado = true;
        continue;
      }
      if (c === '"') {
        enCadena = !enCadena;
        continue;
      }
      if (enCadena) continue;
      if (c === "{") profundidad++;
      else if (c === "}") {
        profundidad--;
        if (profundidad === 0) {
          try {
            return JSON.parse(limpio.slice(inicio, i + 1)) as T;
          } catch {
            break;
          }
        }
      }
    }
  }

  throw new ErrorLLM(
    `El modelo no devolvió JSON válido: ${limpio.slice(0, 200)}`,
    undefined,
    "Prueba con un modelo más capaz o revisa que el prompt pida JSON explícito.",
  );
}
