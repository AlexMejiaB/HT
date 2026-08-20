import { z } from "zod";
import { Intencion } from "@/generated/prisma/enums";
import { completar, extraerJson } from "@/lib/agente/llm";
import {
  cargarContexto,
  buscarProductos,
  buscarFaqs,
  buscarEjemplos,
  elegirLinea,
  formatearContexto,
  formatearEjemplos,
  type ContextoTenant,
} from "@/lib/agente/conocimiento";
import { consultarUso, registrarUso } from "@/lib/agente/uso";
import type { ConfigModelo, Uso } from "@/lib/agente/llm";
import { consultarEstatus } from "@/lib/agente/pedidos";
import {
  evaluarEntrada,
  confianzaSuficiente,
  respuestaViolaGuardrails,
  mensajeDeEscalamiento,
  redactarDatosSensibles,
} from "@/lib/agente/guardrails";

export type ResultadoAgente = {
  /** Texto a enviar al cliente. */
  respuesta: string;
  intencion: Intencion;
  confianza: number;
  escalar: boolean;
  motivoEscalamiento?: string;
  /** Datos de prospecto detectados en la conversación. */
  lead?: { nombre?: string; productoInteres?: string };
  /** Resumen para la persona que reciba el caso escalado. */
  resumen: string;
  accionSugerida?: string;
  /** Etiquetas operativas de Fase 2, derivadas de la intención. */
  etiquetas: string[];
};

/**
 * Etiquetado del brief: venta, pedido, devolución, incidencia o humano.
 * Se derivan de la intención en vez de pedírselas al modelo, porque el
 * vocabulario tiene que ser estable para que los reportes sirvan.
 */
const ETIQUETA_POR_INTENCION: Partial<Record<Intencion, string>> = {
  PRODUCTO: "venta",
  PRECIO_STOCK: "venta",
  LEAD_CAMPANA: "venta",
  ENVIO: "pedido",
  ESTATUS_PEDIDO: "pedido",
  DEVOLUCION: "devolucion",
  QUEJA: "incidencia",
  HUMANO: "humano",
};

function etiquetar(intencion: Intencion, escala: boolean): string[] {
  const salida = new Set<string>();
  const base = ETIQUETA_POR_INTENCION[intencion];
  if (base) salida.add(base);
  if (escala) salida.add("humano");
  return [...salida];
}

const INTENCIONES = [
  "PRODUCTO",
  "PRECIO_STOCK",
  "ENVIO",
  "ESTATUS_PEDIDO",
  "DEVOLUCION",
  "LEAD_CAMPANA",
  "HUMANO",
  "QUEJA",
  "OTRO",
] as const;

const esquemaClasificacion = z.object({
  intencion: z.enum(INTENCIONES),
  confianza: z.number().min(0).max(1),
  producto_mencionado: z.string().nullable().optional(),
  nombre_cliente: z.string().nullable().optional(),
  resumen: z.string(),
});

function configDe(c: ContextoTenant): ConfigModelo {
  return {
    modelo: c.llmModelo,
    temperatura: c.llmTemperatura,
    razonamiento: c.llmRazonamiento,
  };
}

/** Paso 1: clasificar la intención y extraer datos de prospecto. */
async function clasificar(texto: string, historial: string, config: ConfigModelo) {
  const salida = await completar(
    [
      {
        role: "system",
        content: `Clasificas mensajes de clientes de una tienda en línea mexicana.

Devuelve SOLO un objeto JSON con esta forma:
{"intencion": one of ${INTENCIONES.join("|")}, "confianza": 0.0-1.0, "producto_mencionado": string|null, "nombre_cliente": string|null, "resumen": "una frase"}

Definiciones:
- PRODUCTO: pregunta por características o disponibilidad de un artículo.
- PRECIO_STOCK: pregunta cuánto cuesta o si hay existencia.
- ENVIO: costo, cobertura o tiempo de entrega.
- ESTATUS_PEDIDO: dónde va un pedido ya hecho.
- DEVOLUCION: quiere devolver, cambiar o cancelar.
- LEAD_CAMPANA: viene de un anuncio y muestra interés general.
- HUMANO: pide hablar con una persona.
- QUEJA: está molesto o reporta un problema.
- OTRO: cualquier otra cosa.

La confianza refleja qué tan seguro estás. Si el mensaje es ambiguo, usa un valor bajo.`,
      },
      { role: "user", content: `Historial reciente:\n${historial}\n\nMensaje nuevo:\n${texto}` },
    ],
    // La temperatura del tenant no aplica aquí: clasificar no es creativo.
    { json: true, temperatura: 0, maxTokens: 800, config: { ...config, temperatura: 0 } },
  );

  // Tolerante a que el JSON venga en un bloque de código o con prosa alrededor.
  return {
    ...esquemaClasificacion.parse(extraerJson(salida.texto)),
    uso: salida.uso,
  };
}

/** Paso 2: redactar la respuesta, sólo con datos verificados. */
async function redactar(
  texto: string,
  historial: string,
  contexto: ContextoTenant,
  datosVerificados: string,
  ejemplos: string,
) {
  return completar(
    [
      {
        role: "system",
        content: `Eres el asistente de atención de "${contexto.nombre}", una tienda en línea mexicana.

TONO: ${contexto.tonoMarca}

REGLAS ABSOLUTAS:
1. Sólo puedes afirmar precios, existencias, tiempos y políticas que aparezcan en DATOS VERIFICADOS. Si no están ahí, di que un compañero del equipo confirmará el detalle.
2. Nunca inventes precios, stock, fechas ni políticas.
3. Nunca prometas descuentos, reembolsos, cancelaciones, facturas ni guías de envío.
4. Nunca pidas datos de tarjeta, CVV ni contraseñas.
5. No confirmes un pago: el pago se confirma cuando el sistema lo registra, no cuando el cliente lo dice.
6. Responde en español mexicano, en máximo 3 frases cortas, sin listas ni formato.
7. Si detectas interés de compra, pregunta de forma natural por el dato que falte para dar seguimiento.

DATOS VERIFICADOS:
${datosVerificados}
${contexto.instruccionesExtra ? `\nINDICACIONES DEL NEGOCIO (no anulan las reglas de arriba):\n${contexto.instruccionesExtra}` : ""}
${ejemplos ? `\n${ejemplos}` : ""}`,
      },
      { role: "user", content: `Historial reciente:\n${historial}\n\nMensaje del cliente:\n${texto}` },
    ],
    { temperatura: 0.3, maxTokens: 2000, config: configDe(contexto) },
  );
}

/**
 * Orquesta una respuesta completa: guardrails de entrada, clasificación,
 * recuperación de datos reales, redacción y guardrails de salida.
 */
export async function responder(
  tenantId: string,
  textoCrudo: string,
  historial: string,
  telefono: string,
): Promise<ResultadoAgente> {
  const texto = redactarDatosSensibles(textoCrudo);

  const contexto = await cargarContexto(tenantId);
  if (!contexto) {
    throw new Error(`Tenant ${tenantId} inexistente o inactivo`);
  }

  // Tope de gasto: al agotarlo se entrega a una persona. Dejar al cliente sin
  // respuesta sería peor, y seguir gastando sin límite tampoco es opción.
  const uso = await consultarUso(tenantId);
  if (uso.agotado) {
    return {
      respuesta: mensajeDeEscalamiento(),
      intencion: "OTRO",
      confianza: 1,
      escalar: true,
      motivoEscalamiento: `Límite mensual alcanzado (${uso.mensajes}/${uso.limite} mensajes)`,
      resumen: `El cliente escribió: "${texto.slice(0, 200)}"`,
      accionSugerida: "Atender manualmente o ampliar el límite del plan.",
      etiquetas: ["humano"],
    };
  }

  // Acumula el consumo de todas las llamadas de este mensaje.
  const consumos: Uso[] = [];

  // Barrera 1: casos que nunca toca el agente, antes de gastar una llamada.
  const previo = evaluarEntrada(texto, null);
  if (previo.accion !== "responder") {
    return {
      respuesta: mensajeDeEscalamiento(),
      intencion: "HUMANO",
      confianza: 1,
      escalar: true,
      motivoEscalamiento: previo.motivo,
      resumen: `El cliente escribió: "${texto.slice(0, 200)}"`,
      accionSugerida: "Revisar el caso y responder personalmente.",
      etiquetas: ["humano"],
    };
  }

  // Si el modelo no está disponible, escalamos en vez de improvisar.
  let clasificacion: z.infer<typeof esquemaClasificacion> & { uso: Uso };
  try {
    clasificacion = await clasificar(texto, historial, configDe(contexto));
    consumos.push(clasificacion.uso);
  } catch {
    return {
      respuesta: mensajeDeEscalamiento(),
      intencion: "OTRO",
      confianza: 0,
      escalar: true,
      motivoEscalamiento: "No se pudo clasificar el mensaje",
      resumen: `Mensaje sin clasificar: "${texto.slice(0, 200)}"`,
      etiquetas: ["humano"],
    };
  }

  // Barrera 2: la intención en sí obliga a escalar.
  const porIntencion = evaluarEntrada(texto, clasificacion.intencion);
  if (porIntencion.accion !== "responder") {
    return {
      respuesta: mensajeDeEscalamiento(),
      intencion: clasificacion.intencion,
      confianza: clasificacion.confianza,
      escalar: true,
      motivoEscalamiento: porIntencion.motivo,
      resumen: clasificacion.resumen,
      accionSugerida: "Revisar el caso y responder personalmente.",
      etiquetas: etiquetar(clasificacion.intencion, true),
    };
  }

  // Barrera 3: baja confianza, no adivinamos.
  if (!confianzaSuficiente(clasificacion.confianza, contexto.umbralConfianza)) {
    return {
      respuesta: mensajeDeEscalamiento(),
      intencion: clasificacion.intencion,
      confianza: clasificacion.confianza,
      escalar: true,
      motivoEscalamiento: `Confianza ${clasificacion.confianza.toFixed(2)} bajo el umbral ${contexto.umbralConfianza}`,
      resumen: clasificacion.resumen,
      etiquetas: etiquetar(clasificacion.intencion, true),
    };
  }

  // Estatus de pedido: si hay tienda conectada se lee de la fuente real; si no
  // (o si el pedido no es de este cliente), se entrega a una persona.
  if (clasificacion.intencion === "ESTATUS_PEDIDO") {
    const r = await consultarEstatus(tenantId, texto, telefono);

    if (r.tipo === "encontrado") {
      return {
        respuesta: r.texto,
        intencion: clasificacion.intencion,
        confianza: clasificacion.confianza,
        escalar: false,
        resumen: `Consulta de pedido ${r.pedido.numero}: ${r.pedido.estadoCrudo}`,
        etiquetas: etiquetar(clasificacion.intencion, false),
      };
    }

    if (r.tipo === "sin_numero") {
      return {
        respuesta:
          "Con gusto lo reviso. ¿Me compartes el número de pedido? Viene en el correo de confirmación.",
        intencion: clasificacion.intencion,
        confianza: clasificacion.confianza,
        escalar: false,
        resumen: clasificacion.resumen,
        etiquetas: etiquetar(clasificacion.intencion, false),
      };
    }

    const motivo =
      r.tipo === "sin_conector"
        ? "Consulta de pedido sin tienda conectada"
        : r.tipo === "no_encontrado"
          ? "Pedido no encontrado o de otro titular"
          : `Error al consultar la tienda: ${r.detalle}`;

    return {
      respuesta:
        "Déjame confirmarlo con el equipo para darte el estatus exacto de tu pedido. En breve te escriben por aquí.",
      intencion: clasificacion.intencion,
      confianza: clasificacion.confianza,
      escalar: true,
      motivoEscalamiento: motivo,
      resumen: clasificacion.resumen,
      accionSugerida: "Consultar el pedido en el sistema y responder al cliente.",
      etiquetas: etiquetar(clasificacion.intencion, true),
    };
  }

  const consulta = `${clasificacion.producto_mencionado ?? ""} ${texto}`;
  const [productos, faqs] = await Promise.all([
    buscarProductos(tenantId, consulta),
    buscarFaqs(tenantId, texto),
  ]);

  // El subcontexto se elige por el producto mencionado: sólo entran las reglas
  // de la marca por la que preguntan, no las de todo el catálogo.
  const linea = await elegirLinea(tenantId, productos);
  const ejemplos = await buscarEjemplos(tenantId, linea?.id ?? null);

  let borrador: string;
  try {
    const r = await redactar(
      texto,
      historial,
      contexto,
      formatearContexto(contexto, productos, faqs, linea),
      formatearEjemplos(ejemplos),
    );
    consumos.push(r.uso);
    borrador = r.texto;
  } catch {
    return {
      respuesta: mensajeDeEscalamiento(),
      intencion: clasificacion.intencion,
      confianza: clasificacion.confianza,
      escalar: true,
      motivoEscalamiento: "No se pudo generar la respuesta",
      resumen: clasificacion.resumen,
      etiquetas: etiquetar(clasificacion.intencion, true),
    };
  }

  // Barrera 4: la respuesta ya escrita promete algo que no podemos cumplir.
  const violacion = respuestaViolaGuardrails(borrador);
  if (violacion) {
    return {
      respuesta: mensajeDeEscalamiento(),
      intencion: clasificacion.intencion,
      confianza: clasificacion.confianza,
      escalar: true,
      motivoEscalamiento: violacion,
      resumen: clasificacion.resumen,
      accionSugerida: "Revisar el caso: el agente intentó prometer una acción no permitida.",
      etiquetas: etiquetar(clasificacion.intencion, true),
    };
  }

  await registrarUso(tenantId, consumos);

  return {
    respuesta: borrador.trim(),
    intencion: clasificacion.intencion,
    confianza: clasificacion.confianza,
    escalar: false,
    lead: {
      nombre: clasificacion.nombre_cliente ?? undefined,
      productoInteres: clasificacion.producto_mencionado ?? undefined,
    },
    resumen: clasificacion.resumen,
    etiquetas: etiquetar(clasificacion.intencion, false),
  };
}
