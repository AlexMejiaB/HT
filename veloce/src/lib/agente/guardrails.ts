import { Intencion } from "@/generated/prisma/enums";

/**
 * Guardrails del agente. Estas reglas no viven en el prompt: se evalúan en
 * código, antes y después del modelo, porque un prompt se puede convencer y
 * una condición no.
 */

/** Intenciones que nunca resuelve el agente: siempre pasan a una persona. */
const INTENCIONES_QUE_ESCALAN = new Set<Intencion>([
  "HUMANO",
  "QUEJA",
  "DEVOLUCION",
]);

/**
 * El texto se normaliza antes de evaluar: sin acentos y en minúsculas.
 *
 * `\b` en JavaScript sólo reconoce caracteres ASCII, así que un patrón que
 * termina en vocal acentuada ("no me llegó") nunca casa. Normalizar elimina
 * esa clase de fallo completa y deja los patrones legibles, sin `[oó]` por todos lados.
 */
export function normalizar(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

/**
 * Frases que obligan a escalar aunque el clasificador falle. Cubren los casos
 * del brief: pedir persona, dinero, documentos fiscales y cambios de pedido.
 * Se escriben sin acentos porque se evalúan contra el texto normalizado.
 */
const DISPARADORES = [
  // Pide persona explícitamente.
  /\b(?:hablar|habla|comunicar|comunicame|pas\w*)\s+(?:con\s+)?(?:una?\s+)?(?:persona|humano|asesor|agente\s+real|alguien|ejecutivo|encargado|supervisor|representante)\b/,
  /\b(?:quiero|necesito)\s+(?:hablar|que\s+me\s+atienda)\b/,
  // Dinero y documentos: nunca los toca el agente.
  /\b(?:reembolso|devolucion\s+de\s+dinero|me\s+devuelvan|cancelar\s+(?:mi\s+)?pedido|cancelacion)\b/,
  /\b(?:factura|facturar|cfdi|constancia\s+fiscal|rfc)\b/,
  /\b(?:descuento|cupon|promocion\s+especial|precio\s+especial|rebaja)\b/,
  /\b(?:guia|numero\s+de\s+rastreo|cambiar\s+(?:la\s+)?direccion)\b/,
  // Incidencias graves.
  /\b(?:fraude|estafa|me\s+robaron|cargo\s+no\s+reconocido|no\s+me\s+llego|paquete\s+perdido|llego\s+roto|producto\s+danado|defectuoso)\b/,
  /\b(?:demanda|profeco|abogado)\b/,
];

/**
 * Datos de tarjeta. Regla no negociable: no se piden, no se aceptan y no se
 * guardan por chat. Si el cliente los manda, se redactan antes de persistir.
 *
 * Los patrones de detección van SIN el flag `g`: un regex global conserva
 * `lastIndex` entre llamadas a `.test()`, así que la segunda evaluación del
 * mismo texto devolvería false. Para reemplazar se usan copias con `g`.
 */
const SECUENCIA_LARGA = /\b(?:\d[ -]?){13,19}\b/;
const SECUENCIA_LARGA_G = /\b(?:\d[ -]?){13,19}\b/g;
const CVV = /\b(?:cvv|cvc|codigo\s+de\s+seguridad)\b[^\d]{0,15}\d{3,4}\b/;
const CVV_G = /\b(?:cvv|cvc|c[oó]digo\s+de\s+seguridad)\b[^\d]{0,15}\d{3,4}\b/gi;

/**
 * Algoritmo de Luhn. Sin esta comprobación, cualquier teléfono de 13 dígitos
 * se confundiría con una tarjeta, y en WhatsApp los clientes escriben su
 * número todo el tiempo.
 */
function luhnValido(digitos: string): boolean {
  if (digitos.length < 13 || digitos.length > 19) return false;
  let suma = 0;
  let alterna = false;
  for (let i = digitos.length - 1; i >= 0; i--) {
    let d = digitos.charCodeAt(i) - 48;
    if (d < 0 || d > 9) return false;
    if (alterna) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    suma += d;
    alterna = !alterna;
  }
  return suma % 10 === 0;
}

/**
 * Longitudes reales de tarjeta en circulación: Amex 15, la mayoría 16, algunas
 * co-branded 19. Un teléfono mexicano con lada son 12-13 dígitos, así que la
 * longitud sola ya descarta el falso positivo más común de este canal.
 */
const LONGITUDES_TARJETA = new Set([15, 16, 19]);

/** Prefijos de emisor: Amex 34/37, Visa 4, Mastercard 51-55 y 2221-2720, Discover 6. */
const PREFIJO_EMISOR = /^(?:3[47]|4|5[1-5]|2[2-7]|6)/;

function pareceTarjeta(digitos: string): boolean {
  if (!LONGITUDES_TARJETA.has(digitos.length)) return false;
  if (!PREFIJO_EMISOR.test(digitos)) return false;
  return luhnValido(digitos);
}

function contieneTarjeta(texto: string): boolean {
  if (!SECUENCIA_LARGA.test(texto)) return false;
  const candidatos = texto.match(SECUENCIA_LARGA_G) ?? [];
  return candidatos.some((c) => pareceTarjeta(c.replace(/[ -]/g, "")));
}

export type Veredicto =
  | { accion: "responder" }
  | { accion: "escalar"; motivo: string }
  | { accion: "redactar_y_escalar"; motivo: string };

/**
 * Decide antes de llamar al modelo. Ahorra una llamada y, sobre todo, evita
 * que el modelo tenga siquiera la oportunidad de improvisar en estos casos.
 */
export function evaluarEntrada(texto: string, intencion: Intencion | null): Veredicto {
  const t = normalizar(texto);

  if (contieneTarjeta(t) || CVV.test(t)) {
    return {
      accion: "redactar_y_escalar",
      motivo: "El cliente compartió datos de pago por chat",
    };
  }

  for (const patron of DISPARADORES) {
    if (patron.test(t)) {
      return { accion: "escalar", motivo: `Solicitud fuera del alcance del agente` };
    }
  }

  if (intencion && INTENCIONES_QUE_ESCALAN.has(intencion)) {
    return { accion: "escalar", motivo: `Intención que requiere persona: ${intencion}` };
  }

  return { accion: "responder" };
}

/**
 * Segunda barrera: si el modelo no alcanzó el umbral de confianza del tenant,
 * no adivinamos. El brief lo pide explícitamente.
 */
export function confianzaSuficiente(confianza: number, umbral: number): boolean {
  return confianza >= umbral;
}

/** Elimina números de tarjeta y CVV antes de guardar el mensaje. */
export function redactarDatosSensibles(texto: string): string {
  return texto
    .replace(SECUENCIA_LARGA_G, (m) =>
      pareceTarjeta(m.replace(/[ -]/g, "")) ? "[dato de pago removido]" : m,
    )
    .replace(CVV_G, "[dato de pago removido]");
}

/**
 * Última barrera, sobre la respuesta ya redactada. Si el modelo se inventó una
 * promesa que no le corresponde, la respuesta se descarta y el caso escala.
 */
const PROMESAS_PROHIBIDAS = [
  /\b(?:te\s+(?:hago|doy)|puedo\s+darte|aplico)\s+(?:un\s+)?descuento\b/,
  /\b(?:cancele|cancelo|ya\s+cancel)\w*\s+(?:tu|el)\s+pedido\b/,
  /\b(?:te\s+)?(?:devuelvo|reembolso|proceso\s+el\s+reembolso)\b/,
  /\b(?:genero|te\s+mando|emito)\s+(?:tu\s+)?(?:factura|guia)\b/,
  /\bgarantiz\w+\s+que\s+llega\b/,
];

export function respuestaViolaGuardrails(respuesta: string): string | null {
  const r = normalizar(respuesta);
  for (const patron of PROMESAS_PROHIBIDAS) {
    if (patron.test(r)) {
      return "El borrador prometía una acción que el agente no puede ejecutar";
    }
  }
  return null;
}

/**
 * Texto que se envía al cliente cuando el caso pasa a una persona. No promete
 * tiempos que no controlamos.
 */
export function mensajeDeEscalamiento(): string {
  return "Déjame pasar tu caso con una persona del equipo para darte una respuesta correcta. En breve te contactan por aquí.";
}
