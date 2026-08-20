import { descifrar } from "@/lib/cifrado";

const VERSION_API = "v23.0";

/**
 * Envía un mensaje de texto por WhatsApp Cloud API con el token del tenant.
 * El token se guarda cifrado y sólo se descifra en el momento del envío.
 */
export async function enviarTexto(
  phoneNumberId: string,
  tokenCifrado: string,
  para: string,
  texto: string,
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  let token: string;
  try {
    token = descifrar(tokenCifrado);
  } catch {
    return { ok: false, error: "No se pudo descifrar el token del tenant" };
  }

  try {
    const r = await fetch(`https://graph.facebook.com/${VERSION_API}/${phoneNumberId}/messages`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: para,
        type: "text",
        text: { preview_url: false, body: texto },
      }),
      signal: AbortSignal.timeout(15_000),
    });

    if (!r.ok) {
      const detalle = await r.text().catch(() => "");
      return { ok: false, error: `Meta respondió ${r.status}: ${detalle.slice(0, 300)}` };
    }

    const datos = (await r.json()) as { messages?: { id: string }[] };
    return { ok: true, id: datos.messages?.[0]?.id ?? "" };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Error de red" };
  }
}

/** Forma mínima del webhook de Meta que nos interesa procesar. */
export type MensajeEntrante = {
  /** phone_number_id en WhatsApp; id de la cuenta en Instagram. */
  phoneNumberId: string;
  waMessageId: string;
  de: string;
  nombrePerfil?: string;
  texto: string;
  /** Campaña de Meta cuando el mensaje viene de un anuncio click-to-WhatsApp. */
  origenCampana?: string;
  canal: "WHATSAPP" | "INSTAGRAM";
};

/**
 * Extrae los mensajes de texto de un payload de webhook. Ignora estados de
 * entrega, reacciones y todo lo que no sea un mensaje de texto entrante.
 */
export function extraerMensajes(payload: unknown): MensajeEntrante[] {
  const salida: MensajeEntrante[] = [];
  // `null` es JSON válido y Meta puede mandar cuerpos inesperados: no reventamos.
  const p = (payload ?? {}) as {
    entry?: {
      changes?: {
        value?: {
          metadata?: { phone_number_id?: string };
          contacts?: { profile?: { name?: string }; wa_id?: string }[];
          messages?: {
            id?: string;
            from?: string;
            type?: string;
            text?: { body?: string };
            referral?: { source_id?: string; headline?: string };
          }[];
        };
      }[];
    }[];
  };

  for (const entry of p.entry ?? []) {
    for (const change of entry.changes ?? []) {
      const value = change.value;
      const phoneNumberId = value?.metadata?.phone_number_id;
      if (!phoneNumberId) continue;

      const nombrePerfil = value?.contacts?.[0]?.profile?.name;

      for (const m of value?.messages ?? []) {
        if (m.type !== "text" || !m.text?.body || !m.id || !m.from) continue;
        salida.push({
          phoneNumberId,
          waMessageId: m.id,
          de: m.from,
          nombrePerfil,
          texto: m.text.body,
          origenCampana: m.referral?.source_id ?? m.referral?.headline,
          canal: "WHATSAPP",
        });
      }
    }
  }

  salida.push(...extraerMensajesInstagram(payload));
  return salida;
}

/**
 * Instagram Messaging usa otra forma: `messaging` en lugar de `messages`, y el
 * emisor viene como IGSID en `sender.id`. Se normaliza al mismo tipo para que
 * el resto del sistema no tenga que distinguir el canal.
 */
export function extraerMensajesInstagram(payload: unknown): MensajeEntrante[] {
  const salida: MensajeEntrante[] = [];
  const p = (payload ?? {}) as {
    object?: string;
    entry?: {
      id?: string;
      messaging?: {
        sender?: { id?: string };
        recipient?: { id?: string };
        message?: { mid?: string; text?: string; is_echo?: boolean };
        referral?: { ref?: string; source?: string };
      }[];
    }[];
  };

  if (p.object !== "instagram") return salida;

  for (const entry of p.entry ?? []) {
    const cuenta = entry.id;
    if (!cuenta) continue;

    for (const m of entry.messaging ?? []) {
      // is_echo marca los mensajes que enviamos nosotros: procesarlos crearía
      // un bucle en el que el agente se responde a sí mismo.
      if (m.message?.is_echo) continue;
      const texto = m.message?.text;
      const mid = m.message?.mid;
      const de = m.sender?.id;
      if (!texto || !mid || !de) continue;

      salida.push({
        phoneNumberId: cuenta,
        waMessageId: mid,
        de,
        texto,
        origenCampana: m.referral?.ref,
        canal: "INSTAGRAM",
      });
    }
  }

  return salida;
}

/**
 * Envío por Instagram Messaging. Usa la Graph API de la cuenta, no la de
 * WhatsApp, y el destinatario es el IGSID del usuario.
 */
export async function enviarTextoInstagram(
  cuentaId: string,
  tokenCifrado: string,
  para: string,
  texto: string,
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  let token: string;
  try {
    token = descifrar(tokenCifrado);
  } catch {
    return { ok: false, error: "No se pudo descifrar el token del tenant" };
  }

  try {
    const r = await fetch(`https://graph.facebook.com/${VERSION_API}/${cuentaId}/messages`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
      body: JSON.stringify({ recipient: { id: para }, message: { text: texto } }),
      signal: AbortSignal.timeout(15_000),
    });

    if (!r.ok) {
      const detalle = await r.text().catch(() => "");
      return { ok: false, error: `Meta respondió ${r.status}: ${detalle.slice(0, 300)}` };
    }

    const datos = (await r.json()) as { message_id?: string };
    return { ok: true, id: datos.message_id ?? "" };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Error de red" };
  }
}
