import { db } from "@/lib/db";
import { enviarTexto } from "@/lib/whatsapp";

/**
 * Aviso al equipo cuando el agente escala un caso.
 *
 * El brief lo pide explícitamente: al escalar hay que entregar nombre y
 * teléfono, resumen, motivo, producto o pedido relacionado y acción sugerida.
 * Sin esto, un escalamiento sólo existe en la base de datos y nadie se entera
 * hasta que alguien entra al panel.
 *
 * Limitación conocida: fuera de la ventana de 24 horas de WhatsApp, Meta sólo
 * admite plantillas aprobadas. Si el equipo no ha escrito recientemente, el
 * envío falla y queda registrado en auditoría; el caso sigue visible en el
 * panel. Para avisos garantizados hace falta registrar una plantilla de
 * utilidad y enviarla por aquí.
 */
export type DatosAviso = {
  tenantId: string;
  phoneNumberId: string;
  tokenCifrado: string;
  escalamientoId: string;
  contacto: { nombre: string | null; telefono: string };
  motivo: string;
  resumen: string;
  accionSugerida?: string | null;
  referencia?: string | null;
};

export function componerAviso(d: DatosAviso): string {
  const lineas = [
    "🔔 Caso escalado",
    "",
    `Cliente: ${d.contacto.nombre ?? "sin nombre"} · ${d.contacto.telefono}`,
    `Motivo: ${d.motivo}`,
    `Resumen: ${d.resumen}`,
  ];
  if (d.referencia) lineas.push(`Relacionado: ${d.referencia}`);
  if (d.accionSugerida) lineas.push(`Acción sugerida: ${d.accionSugerida}`);
  return lineas.join("\n");
}

export async function avisarAlEquipo(d: DatosAviso): Promise<void> {
  const equipo = await db.contactoEquipo.findMany({
    where: { tenantId: d.tenantId, activo: true },
    select: { id: true, nombre: true, telefono: true },
  });

  if (equipo.length === 0) return;

  const texto = componerAviso(d);

  // Idempotencia: un reintento del webhook no debe volver a sonarle el
  // teléfono a todo el equipo. La clave incluye el escalamiento concreto.
  for (const persona of equipo) {
    const clave = `aviso:${d.escalamientoId}:${persona.id}`;
    try {
      await db.claveIdempotencia.create({
        data: { tenantId: d.tenantId, clave, operacion: "aviso_escalamiento" },
      });
    } catch {
      continue; // ya se avisó a esta persona por este escalamiento
    }

    const envio = await enviarTexto(d.phoneNumberId, d.tokenCifrado, persona.telefono, texto);

    await db.eventoAuditoria.create({
      data: {
        tenantId: d.tenantId,
        actor: "sistema",
        accion: envio.ok ? "aviso_equipo_enviado" : "aviso_equipo_fallido",
        recurso: `escalamiento:${d.escalamientoId}`,
        detalle: {
          destinatario: persona.telefono,
          error: envio.ok ? null : envio.error,
        },
      },
    });
  }
}
