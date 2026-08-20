import { after } from "next/server";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { firmaMetaValida } from "@/lib/cifrado";
import {
  extraerMensajes,
  enviarTexto,
  enviarTextoInstagram,
  type MensajeEntrante,
} from "@/lib/whatsapp";
import { responder } from "@/lib/agente/motor";
import { redactarDatosSensibles } from "@/lib/agente/guardrails";
import { avisarAlEquipo } from "@/lib/agente/notificar";

/** El webhook escribe en base de datos: nunca debe cachearse ni prerenderizarse. */
export const dynamic = "force-dynamic";

/**
 * Verificación del webhook. Meta llama con un reto y espera el eco exacto.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const modo = url.searchParams.get("hub.mode");
  const token = url.searchParams.get("hub.verify_token");
  const reto = url.searchParams.get("hub.challenge");

  if (modo === "subscribe" && token === env().META_VERIFY_TOKEN && reto) {
    return new Response(reto, { status: 200, headers: { "content-type": "text/plain" } });
  }
  return new Response("Forbidden", { status: 403 });
}

/**
 * Recepción de mensajes.
 *
 * Meta reintenta si no respondemos rápido, así que confirmamos de inmediato y
 * procesamos después: contestar tarde provoca mensajes duplicados.
 */
export async function POST(request: Request) {
  const cuerpoCrudo = await request.text();

  if (!firmaMetaValida(cuerpoCrudo, request.headers.get("x-hub-signature-256"))) {
    return new Response("Firma inválida", { status: 401 });
  }

  let payload: unknown;
  try {
    payload = JSON.parse(cuerpoCrudo);
  } catch {
    return new Response("JSON inválido", { status: 400 });
  }

  const mensajes = extraerMensajes(payload);

  // Se responde 200 ya; el trabajo real corre después de enviar la respuesta.
  after(async () => {
    for (const m of mensajes) {
      try {
        await procesarMensaje(m);
      } catch (e) {
        console.error("[webhook whatsapp] fallo al procesar", m.waMessageId, e);
      }
    }
  });

  return new Response(null, { status: 200 });
}

async function procesarMensaje(m: MensajeEntrante) {
  // Enrutado multi-tenant: la cuenta que recibió el mensaje define el negocio.
  // WhatsApp enruta por phone_number_id; Instagram por id de cuenta.
  const tenant =
    m.canal === "INSTAGRAM"
      ? await db.tenant.findUnique({
          where: { igCuentaId: m.phoneNumberId },
          select: {
            id: true,
            activo: true,
            waTokenCifrado: true,
            igTokenCifrado: true,
            waPhoneNumberId: true,
          },
        })
      : await db.tenant.findUnique({
          where: { waPhoneNumberId: m.phoneNumberId },
          select: {
            id: true,
            activo: true,
            waTokenCifrado: true,
            igTokenCifrado: true,
            waPhoneNumberId: true,
          },
        });

  const tokenDelCanal = m.canal === "INSTAGRAM" ? tenant?.igTokenCifrado : tenant?.waTokenCifrado;
  if (!tenant?.activo || !tokenDelCanal) return;

  // Deduplicación: Meta reentrega el mismo mensaje ante cualquier duda.
  // El unique sobre waMessageId hace que el segundo intento falle y se corte.
  const yaVisto = await db.mensaje.findUnique({
    where: { waMessageId: m.waMessageId },
    select: { id: true },
  });
  if (yaVisto) return;

  const contacto = await db.contacto.upsert({
    where: { tenantId_telefono: { tenantId: tenant.id, telefono: m.de } },
    create: { tenantId: tenant.id, telefono: m.de, nombre: m.nombrePerfil },
    update: m.nombrePerfil ? { nombre: m.nombrePerfil } : {},
    select: { id: true, nombre: true },
  });

  // Se reutiliza la conversación abierta para no fragmentar el historial.
  const conversacion =
    (await db.conversacion.findFirst({
      where: {
        tenantId: tenant.id,
        contactoId: contacto.id,
        estado: "ABIERTA",
        canal: m.canal,
      },
      select: { id: true, creadoEn: true, primeraRespuestaMs: true, etiquetas: true },
    })) ??
    (await db.conversacion.create({
      data: { tenantId: tenant.id, contactoId: contacto.id, canal: m.canal },
      select: { id: true, creadoEn: true, primeraRespuestaMs: true, etiquetas: true },
    }));

  const textoSeguro = redactarDatosSensibles(m.texto);

  try {
    await db.mensaje.create({
      data: {
        conversacionId: conversacion.id,
        direccion: "ENTRANTE",
        texto: textoSeguro,
        waMessageId: m.waMessageId,
      },
    });
  } catch {
    // Choque con el unique: otra entrega ganó la carrera. No duplicamos.
    return;
  }

  const previos = await db.mensaje.findMany({
    where: { conversacionId: conversacion.id },
    orderBy: { creadoEn: "desc" },
    take: 10,
    select: { direccion: true, texto: true },
  });
  const historial = previos
    .reverse()
    .map((p) => `${p.direccion === "ENTRANTE" ? "Cliente" : "Agente"}: ${p.texto}`)
    .join("\n");

  const resultado = await responder(tenant.id, textoSeguro, historial, m.de);

  const envio =
    m.canal === "INSTAGRAM"
      ? await enviarTextoInstagram(m.phoneNumberId, tokenDelCanal, m.de, resultado.respuesta)
      : await enviarTexto(m.phoneNumberId, tokenDelCanal, m.de, resultado.respuesta);

  const ahora = Date.now();
  // Las etiquetas se acumulan a lo largo de la conversación, sin repetirse.
  const etiquetas = [...new Set([...conversacion.etiquetas, ...resultado.etiquetas])];
  let escalamientoId: string | null = null;

  await db.$transaction(async (tx) => {
    await tx.mensaje.create({
      data: {
        conversacionId: conversacion.id,
        direccion: "SALIENTE",
        texto: resultado.respuesta,
        intencion: resultado.intencion,
        confianza: resultado.confianza,
        generadoPorIA: true,
        waMessageId: envio.ok && envio.id ? envio.id : null,
      },
    });

    await tx.conversacion.update({
      where: { id: conversacion.id },
      data: {
        intencion: resultado.intencion,
        resumen: resultado.resumen,
        estado: resultado.escalar ? "ESCALADA" : "ABIERTA",
        etiquetas,
        // Sólo se registra la primera vez, para la métrica de primera respuesta.
        ...(conversacion.primeraRespuestaMs === null
          ? { primeraRespuestaMs: ahora - conversacion.creadoEn.getTime() }
          : {}),
      },
    });

    if (resultado.escalar) {
      const e = await tx.escalamiento.create({
        data: {
          tenantId: tenant.id,
          conversacionId: conversacion.id,
          motivo: resultado.motivoEscalamiento ?? "Sin motivo especificado",
          resumen: resultado.resumen,
          accionSugerida: resultado.accionSugerida,
          referencia: resultado.lead?.productoInteres,
        },
        select: { id: true },
      });
      escalamientoId = e.id;
    }

    // Se registra el prospecto cuando hay señal real de interés de compra.
    const intencionesDeLead = ["PRODUCTO", "PRECIO_STOCK", "ENVIO", "LEAD_CAMPANA"] as const;
    if (intencionesDeLead.includes(resultado.intencion as (typeof intencionesDeLead)[number])) {
      await tx.lead.create({
        data: {
          tenantId: tenant.id,
          contactoId: contacto.id,
          conversacionId: conversacion.id,
          nombre: resultado.lead?.nombre ?? contacto.nombre ?? m.nombrePerfil,
          telefono: m.de,
          productoInteres: resultado.lead?.productoInteres,
          intencion: resultado.intencion,
          resumen: resultado.resumen,
          origenCampana: m.origenCampana,
        },
      });
    }

    await tx.eventoAuditoria.create({
      data: {
        tenantId: tenant.id,
        actor: "agente",
        accion: resultado.escalar ? "escalamiento" : "respuesta_enviada",
        recurso: `conversacion:${conversacion.id}`,
        detalle: {
          intencion: resultado.intencion,
          confianza: resultado.confianza,
          motivo: resultado.motivoEscalamiento ?? null,
          envioOk: envio.ok,
          errorEnvio: envio.ok ? null : envio.error,
        },
      },
    });
  });

  // Fuera de la transacción a propósito: enviar mensajes es una llamada de red
  // y mantener la transacción abierta durante ella bloquea la base.
  if (escalamientoId && tenant.waPhoneNumberId && tenant.waTokenCifrado) {
    await avisarAlEquipo({
      tenantId: tenant.id,
      // El aviso al equipo siempre va por WhatsApp, aunque el cliente haya
      // escrito por Instagram: es donde el equipo mira.
      phoneNumberId: tenant.waPhoneNumberId,
      tokenCifrado: tenant.waTokenCifrado,
      escalamientoId,
      contacto: { nombre: contacto.nombre, telefono: m.de },
      motivo: resultado.motivoEscalamiento ?? "Sin motivo especificado",
      resumen: resultado.resumen,
      accionSugerida: resultado.accionSugerida,
      referencia: resultado.lead?.productoInteres,
    });
  }
}
