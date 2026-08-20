/**
 * Contenido comercial de Highticket. Misma oferta que la marca hermana, con
 * identidad y lenguaje propios. Cambiar la oferta aquí se refleja en toda la
 * página.
 */

export type Paquete = {
  id: string;
  orden: string;
  nombre: string;
  gancho: string;
  resuelve: string[];
  idealPara: string;
  implementacion: string;
  mensualidad: string;
  notaOperativa: string;
  /** Los paquetes de ticket alto agendan llamada; el resto va directo a WhatsApp. */
  ticketAlto: boolean;
  destacado: boolean;
};

export const site = {
  marca: "Highticket",
  marcaSufijo: "AI",
  dominio: "highticket.mx",
  tagline: "Agentes de IA para e-commerce.",
  descripcion:
    "Highticket atiende las conversaciones repetitivas de tu tienda, consulta información real y entrega los casos importantes a tu equipo.",

  hero: {
    etiqueta: "Paquetes comerciales",
    titulo: ["Tu operación", "en piloto asistido."],
    subtitulo: "Más control en tu operación. Menos tareas repetitivas en tus manos.",
    pie: "Diseñado para e-commerce mexicano que ya vende y necesita dejar de operar cada mensaje personalmente.",
  },

  mensaje: {
    etiqueta: "El mensaje",
    titulo: "Tu tienda ya vende. Ahora deja de operar cada mensaje personalmente.",
    cuerpo:
      "Highticket atiende conversaciones repetitivas, consulta información real y entrega los casos importantes a tu equipo. Empieza pequeño; agrega automatizaciones sólo cuando estén probadas.",
  },

  clienteIdeal:
    "E-commerce mexicano que factura aproximadamente $50,000–$500,000 MXN mensuales, recibe mensajes de campañas de Meta por WhatsApp o Instagram y cuyo dueño sigue atrapado en atención, preguntas y seguimiento.",

  promesa:
    "Si tu tienda ya vende, pero tú sigues respondiendo cada mensaje de WhatsApp, Highticket responde la operación repetitiva para que tú te enfoques en vender y surtir.",
} as const;

export const paquetes: Paquete[] = [
  {
    id: "responde",
    orden: "01",
    nombre: "Highticket Responde",
    gancho: "Para tiendas que reciben mensajes de campañas y tardan demasiado en contestar.",
    resuelve: [
      "Agente en WhatsApp.",
      "Preguntas frecuentes de productos, envíos, cambios y políticas.",
      "Captura de nombre, interés y datos de prospecto.",
      "Escalamiento al dueño cuando se requiere una persona.",
      "Configuración de tono de marca.",
      "Reporte mensual básico.",
    ],
    idealPara:
      "E-commerce que ya vende y necesita responder rápido sin contratar a otra persona.",
    implementacion: "$6,900 MXN",
    mensualidad: "$2,990 MXN",
    notaOperativa:
      "No autoriza descuentos, reembolsos, cambios de pedido ni movimientos de inventario.",
    ticketAlto: false,
    destacado: false,
  },
  {
    id: "operador",
    orden: "02",
    nombre: "Highticket Operador",
    gancho: "Para tiendas con pedidos constantes que necesitan quitarse carga operativa.",
    resuelve: [
      "Todo lo de Highticket Responde.",
      "WhatsApp e Instagram.",
      "Consulta de estatus de pedido.",
      "Consulta de catálogo, precio e inventario en modo lectura.",
      "Etiquetado: venta, pedido, devolución, incidencia o humano.",
      "Registro de leads y flujos para campañas de Meta.",
      "Ajustes mensuales y reporte de resultados.",
    ],
    idealPara:
      "Tiendas que facturan aprox. $100k–$500k MXN al mes y ya viven entre mensajes y seguimiento.",
    implementacion: "$14,900 MXN",
    mensualidad: "$5,990 MXN",
    notaOperativa:
      "Información crítica siempre viene de las fuentes reales del negocio; no se inventa nada.",
    ticketAlto: false,
    destacado: true,
  },
  {
    id: "autopilot",
    orden: "03",
    nombre: "Highticket Autopilot",
    gancho: "Operación asistida por IA, construida alrededor de cómo funciona tu tienda.",
    resuelve: [
      "Todo lo de Highticket Operador.",
      "Integración a Shopify, Tiendanube, WooCommerce o sistema disponible.",
      "Flujos para inventario bajo, pedidos y casos especiales.",
      "Automatizaciones personalizadas.",
      "Panel de métricas y revisión mensual.",
      "Soporte prioritario.",
    ],
    idealPara:
      "E-commerce consolidado con volumen de mensajes, inventario físico y procesos claros.",
    implementacion: "Desde $29,900 MXN",
    mensualidad: "Desde $9,990 MXN",
    notaOperativa:
      "Las acciones sensibles se habilitan sólo después de aprobación, pruebas y reglas por cliente.",
    ticketAlto: true,
    destacado: false,
  },
];

export const loQueCompran =
  "Menos mensajes sin contestar, respuestas más rápidas y una operación menos dependiente del dueño.";

export const notaCostosExternos =
  "Costos externos de Meta/WhatsApp, IA y plataformas se cotizan por separado o se incluyen con un límite de uso definido en propuesta.";

export const guardrails = {
  etiqueta: "Guardrails y experiencia",
  titulo: "El agente ayuda. No improvisa.",
  restricciones: [
    "Nunca inventar precios, stock, políticas ni fechas.",
    "No cambiar inventario, cancelar pedidos, emitir reembolsos, generar facturas o guías.",
    "No prometer descuentos.",
    "No resolver quejas graves sin una persona.",
    "No continuar si el usuario pide explícitamente hablar con un humano.",
    "Si no tiene información verificada, explicar que un miembro del equipo dará seguimiento.",
  ],
  escalamiento: {
    titulo: "Escalamiento inmediato",
    cuerpo:
      "Escala si el usuario pide persona, cancelación, devolución, reembolso, descuento, factura, guía, cambio de pedido; existe pago/fraude/pedido perdido/producto dañado; hay molestia; falta información; o el agente tiene baja confianza.",
  },
  alEscalar: {
    titulo: "Al escalar, envía al equipo",
    cuerpo:
      "Nombre y teléfono, resumen, motivo del escalamiento, pedido o producto relacionado y acción sugerida.",
  },
};

export const fases = [
  {
    fase: "Fase 1",
    nombre: "Highticket Responde",
    detalle:
      "WhatsApp, base de conocimiento, FAQs/productos, captura de lead, escalamiento, historial y métricas.",
  },
  {
    fase: "Fase 2",
    nombre: "Highticket Operador",
    detalle:
      "Instagram, pedido, inventario de lectura, Shopify/Tiendanube/WooCommerce, etiquetas, reportes y flujos de Meta.",
  },
  {
    fase: "Fase 3",
    nombre: "Highticket Autopilot",
    detalle:
      "Alertas de inventario, automatizaciones, acciones operativas con aprobación y, sólo cuando sea seguro, facturación o guías.",
  },
];

export const conversacionDemo = [
  {
    de: "cliente" as const,
    texto: "¿Todavía tienen disponible el producto X? ¿Cuánto tarda en llegar a León?",
  },
  {
    de: "agente" as const,
    texto:
      "¡Hola! Sí, tenemos disponible el producto X. A León el envío tarda 2 a 3 días hábiles.",
  },
  {
    de: "agente" as const,
    texto: "¿Te gustaría que te aparte una pieza?",
  },
  {
    de: "cliente" as const,
    texto: "Sí, pero quiero factura y cambiar la dirección de un pedido anterior.",
  },
  {
    de: "sistema" as const,
    texto: "Escalado a una persona del equipo · Motivo: factura y cambio de pedido",
  },
];

export const cta = {
  etiqueta: "Siguiente paso",
  titulo: "Agenda una llamada de diagnóstico.",
  cuerpo:
    "Revisamos qué mensajes recibes, qué información ya tienes y qué parte de la operación sí conviene automatizar primero.",
};

export const contacto = {
  whatsapp: process.env.NEXT_PUBLIC_WHATSAPP_NUMERO ?? "5215500000000",
  mensajeWhatsapp:
    "Hola, vengo de la página de Highticket y quiero saber más sobre los paquetes.",
  calendly: process.env.NEXT_PUBLIC_CALENDLY_URL ?? "",
};

export function urlWhatsapp(mensaje: string = contacto.mensajeWhatsapp): string {
  return `https://wa.me/${contacto.whatsapp}?text=${encodeURIComponent(mensaje)}`;
}
