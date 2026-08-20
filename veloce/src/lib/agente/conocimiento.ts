import { db } from "@/lib/db";

/**
 * Recuperación de contexto desde la fuente estructurada del tenant.
 *
 * Nada de lo que el agente afirme sobre precio, stock o políticas sale del
 * modelo: sale de aquí. Si no está en estas funciones, el agente no lo sabe.
 *
 * El contexto tiene dos niveles:
 *
 *   general    el negocio completo: tono, políticas, horarios, reglas propias
 *   por línea  la marca o línea de producto concreta por la que preguntan
 *
 * El subcontexto de la línea se carga sólo cuando el cliente menciona un
 * producto de ESA línea. Meter las reglas de todas las marcas en cada mensaje
 * encarece el prompt y distrae al modelo con lo que no aplica.
 */

export type ContextoTenant = {
  nombre: string;
  tonoMarca: string;
  politicaEnvios: string | null;
  politicaCambios: string | null;
  politicaDevoluciones: string | null;
  horarios: string | null;
  umbralConfianza: number;
  instruccionesExtra: string | null;
  llmModelo: string | null;
  llmTemperatura: number | null;
  llmRazonamiento: string | null;
};

export async function cargarContexto(tenantId: string): Promise<ContextoTenant | null> {
  const t = await db.tenant.findUnique({
    where: { id: tenantId },
    select: {
      nombre: true,
      tonoMarca: true,
      politicaEnvios: true,
      politicaCambios: true,
      politicaDevoluciones: true,
      horarios: true,
      umbralConfianza: true,
      instruccionesExtra: true,
      llmModelo: true,
      llmTemperatura: true,
      llmRazonamiento: true,
      activo: true,
    },
  });
  if (!t || !t.activo) return null;
  return t;
}

/** Términos útiles para buscar: se descartan las palabras cortas y vacías. */
function terminos(consulta: string, minimo = 3): string[] {
  return consulta
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter((t) => t.length > minimo)
    .slice(0, 8);
}

export async function buscarProductos(tenantId: string, consulta: string, limite = 5) {
  const t = terminos(consulta);
  if (t.length === 0) return [];

  return db.producto.findMany({
    where: {
      tenantId,
      activo: true,
      OR: t.flatMap((x) => [
        { nombre: { contains: x, mode: "insensitive" as const } },
        { sku: { contains: x, mode: "insensitive" as const } },
        { descripcion: { contains: x, mode: "insensitive" as const } },
      ]),
    },
    select: {
      sku: true,
      nombre: true,
      precioCentavos: true,
      moneda: true,
      stock: true,
      lineaId: true,
    },
    take: limite,
  });
}

export async function buscarFaqs(tenantId: string, consulta: string, limite = 4) {
  const t = terminos(consulta);
  if (t.length === 0) return [];

  return db.faq.findMany({
    where: {
      tenantId,
      activo: true,
      OR: t.map((x) => ({ pregunta: { contains: x, mode: "insensitive" as const } })),
    },
    select: { pregunta: true, respuesta: true },
    take: limite,
  });
}

export type Linea = { id: string; nombre: string; contexto: string };

/**
 * Elige la línea cuyo subcontexto se inyecta.
 *
 * Manda el producto que el cliente mencionó. Si los productos encontrados son
 * de varias líneas se toma la más repetida, y si ninguno tiene línea asignada
 * se recurre a la marcada por defecto.
 */
export async function elegirLinea(
  tenantId: string,
  productos: { lineaId: string | null }[],
): Promise<Linea | null> {
  const conteo = new Map<string, number>();
  for (const p of productos) {
    if (p.lineaId) conteo.set(p.lineaId, (conteo.get(p.lineaId) ?? 0) + 1);
  }

  if (conteo.size > 0) {
    const [ganadora] = [...conteo.entries()].sort((a, b) => b[1] - a[1])[0];
    const linea = await db.lineaProducto.findFirst({
      where: { id: ganadora, tenantId, activo: true },
      select: { id: true, nombre: true, contexto: true },
    });
    if (linea) return linea;
  }

  return db.lineaProducto.findFirst({
    where: { tenantId, activo: true, porDefecto: true },
    select: { id: true, nombre: true, contexto: true },
  });
}

/**
 * Ejemplos de estilo. Mostrar cómo se responde funciona mejor que describir el
 * tono con adjetivos. Se prefieren los de la línea concreta.
 */
export async function buscarEjemplos(tenantId: string, lineaId: string | null, limite = 4) {
  const deLinea = lineaId
    ? await db.ejemploRespuesta.findMany({
        where: { tenantId, lineaId, activo: true },
        select: { pregunta: true, respuesta: true },
        take: limite,
      })
    : [];

  if (deLinea.length >= limite) return deLinea;

  const generales = await db.ejemploRespuesta.findMany({
    where: { tenantId, lineaId: null, activo: true },
    select: { pregunta: true, respuesta: true },
    take: limite - deLinea.length,
  });
  return [...deLinea, ...generales];
}

/**
 * Arma el bloque de datos verificados que se entrega al modelo. Texto plano y
 * explícito, para que el modelo no tenga que interpretar estructura.
 */
export function formatearContexto(
  contexto: ContextoTenant,
  productos: Awaited<ReturnType<typeof buscarProductos>>,
  faqs: Awaited<ReturnType<typeof buscarFaqs>>,
  linea?: Linea | null,
): string {
  const partes: string[] = [`NEGOCIO: ${contexto.nombre}`];

  if (linea) {
    partes.push(`LÍNEA CONSULTADA: ${linea.nombre}\n${linea.contexto}`);
  }

  if (productos.length > 0) {
    partes.push(
      "PRODUCTOS ENCONTRADOS (datos verificados):\n" +
        productos
          .map(
            (p) =>
              `- ${p.nombre} (SKU ${p.sku}): $${(p.precioCentavos / 100).toFixed(2)} ${p.moneda}. ` +
              (p.stock > 0 ? `Disponible: ${p.stock} piezas.` : "Sin existencia."),
          )
          .join("\n"),
    );
  } else {
    partes.push("PRODUCTOS ENCONTRADOS: ninguno coincide con la consulta.");
  }

  if (faqs.length > 0) {
    partes.push(
      "PREGUNTAS FRECUENTES:\n" +
        faqs.map((f) => `- P: ${f.pregunta}\n  R: ${f.respuesta}`).join("\n"),
    );
  }

  if (contexto.politicaEnvios) partes.push(`POLÍTICA DE ENVÍOS: ${contexto.politicaEnvios}`);
  if (contexto.politicaCambios) partes.push(`POLÍTICA DE CAMBIOS: ${contexto.politicaCambios}`);
  if (contexto.politicaDevoluciones)
    partes.push(`POLÍTICA DE DEVOLUCIONES: ${contexto.politicaDevoluciones}`);
  if (contexto.horarios) partes.push(`HORARIOS: ${contexto.horarios}`);

  return partes.join("\n\n");
}

/** Los ejemplos van aparte del bloque de datos: enseñan forma, no contenido. */
export function formatearEjemplos(
  ejemplos: { pregunta: string; respuesta: string }[],
): string {
  if (ejemplos.length === 0) return "";
  return (
    "EJEMPLOS DE CÓMO RESPONDER (imita el estilo, no copies los datos):\n" +
    ejemplos.map((e) => `Cliente: ${e.pregunta}\nTú: ${e.respuesta}`).join("\n\n")
  );
}
