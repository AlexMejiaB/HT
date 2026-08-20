"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { exigirPermisoEnAccion } from "@/lib/permisos";

/**
 * Conexión de los canales de mensajería (WhatsApp e Instagram).
 *
 * Hasta ahora el webhook sabía leer estas credenciales y el envío sabía usarlas,
 * pero nadie las escribía: sólo se podían poner por SQL. Esto cierra ese hueco.
 *
 * Las credenciales se cifran en reposo igual que las de la tienda. El panel
 * nunca muestra un token guardado, así que un campo vacío significa "no lo
 * cambies", no "bórralo".
 */

export type EstadoCanal = { ok?: string; error?: string };

async function auditar(
  tenantId: string,
  actor: string,
  accion: string,
  detalle?: Record<string, unknown>,
) {
  await db.eventoAuditoria.create({
    data: { tenantId, actor, accion, detalle: detalle as never },
  });
}

/** Prisma lanza P2002 cuando otro negocio ya reclamó ese id. */
function esChoqueDeUnico(e: unknown): boolean {
  return (
    typeof e === "object" &&
    e !== null &&
    "code" in e &&
    (e as { code?: string }).code === "P2002"
  );
}

// ------------------------------------------------------------------ WhatsApp

const esquemaWhatsapp = z.object({
  // El id numérico que asigna Meta, NO el número de teléfono. Es el error más
  // común al configurar, así que se valida la forma.
  waPhoneNumberId: z
    .string()
    .trim()
    .regex(/^\d{10,20}$/, "El Phone Number ID son sólo dígitos, no el número telefónico")
    .optional()
    .or(z.literal("")),
  waNumeroVisible: z.string().trim().max(20).optional(),
  token: z.string().trim().max(1000).optional(),
});

export async function guardarWhatsapp(
  _previo: EstadoCanal,
  datos: FormData,
): Promise<EstadoCanal> {
  const sesion = await exigirPermisoEnAccion("configurar");
  const r = esquemaWhatsapp.safeParse(Object.fromEntries(datos));
  if (!r.success) return { error: r.error.issues[0]?.message ?? "Datos inválidos" };

  const { waPhoneNumberId, waNumeroVisible, token } = r.data;
  if (!waPhoneNumberId) return { error: "Falta el Phone Number ID." };

  const actual = await db.tenant.findUnique({
    where: { id: sesion.tenantId },
    select: { waTokenCifrado: true },
  });
  if (!token && !actual?.waTokenCifrado) {
    return { error: "Falta el token de acceso: es la primera vez que conectas." };
  }

  const { cifrar } = await import("@/lib/cifrado");

  try {
    await db.tenant.update({
      where: { id: sesion.tenantId },
      data: {
        waPhoneNumberId,
        waNumeroVisible: waNumeroVisible || null,
        ...(token ? { waTokenCifrado: cifrar(token) } : {}),
      },
    });
  } catch (e) {
    // El campo es @unique: sin este mensaje el dueño vería un P2002 crudo.
    if (esChoqueDeUnico(e)) {
      return {
        error:
          "Ese Phone Number ID ya está conectado a otra cuenta. Cada número sólo puede atender a un negocio.",
      };
    }
    throw e;
  }

  await auditar(sesion.tenantId, sesion.nombre, "whatsapp_conectado", { waPhoneNumberId });
  revalidatePath("/panel/canales");
  return { ok: "WhatsApp conectado. Pruébalo con el botón de abajo." };
}

export async function desconectarWhatsapp(datos: FormData) {
  const sesion = await exigirPermisoEnAccion("configurar");
  void datos;
  // Se limpian también las credenciales: dejarlas es superficie inútil.
  await db.tenant.update({
    where: { id: sesion.tenantId },
    data: { waPhoneNumberId: null, waTokenCifrado: null, waNumeroVisible: null },
  });
  await auditar(sesion.tenantId, sesion.nombre, "whatsapp_desconectado");
  revalidatePath("/panel/canales");
}

// ----------------------------------------------------------------- Instagram

const esquemaInstagram = z.object({
  igCuentaId: z
    .string()
    .trim()
    .regex(/^\d{10,20}$/, "El id de la cuenta son sólo dígitos")
    .optional()
    .or(z.literal("")),
  token: z.string().trim().max(1000).optional(),
});

export async function guardarInstagram(
  _previo: EstadoCanal,
  datos: FormData,
): Promise<EstadoCanal> {
  const sesion = await exigirPermisoEnAccion("configurar");
  const r = esquemaInstagram.safeParse(Object.fromEntries(datos));
  if (!r.success) return { error: r.error.issues[0]?.message ?? "Datos inválidos" };

  const { igCuentaId, token } = r.data;
  if (!igCuentaId) return { error: "Falta el id de la cuenta de Instagram." };

  const actual = await db.tenant.findUnique({
    where: { id: sesion.tenantId },
    select: { igTokenCifrado: true },
  });
  if (!token && !actual?.igTokenCifrado) {
    return { error: "Falta el token de acceso: es la primera vez que conectas." };
  }

  const { cifrar } = await import("@/lib/cifrado");

  try {
    await db.tenant.update({
      where: { id: sesion.tenantId },
      data: {
        igCuentaId,
        ...(token ? { igTokenCifrado: cifrar(token) } : {}),
      },
    });
  } catch (e) {
    if (esChoqueDeUnico(e)) {
      return { error: "Esa cuenta de Instagram ya está conectada a otro negocio." };
    }
    throw e;
  }

  await auditar(sesion.tenantId, sesion.nombre, "instagram_conectado", { igCuentaId });
  revalidatePath("/panel/canales");
  return { ok: "Instagram conectado." };
}

export async function desconectarInstagram(datos: FormData) {
  const sesion = await exigirPermisoEnAccion("configurar");
  void datos;
  await db.tenant.update({
    where: { id: sesion.tenantId },
    data: { igCuentaId: null, igTokenCifrado: null },
  });
  await auditar(sesion.tenantId, sesion.nombre, "instagram_desconectado");
  revalidatePath("/panel/canales");
}

// ------------------------------------------------------------------- Prueba

const esquemaPrueba = z.object({
  telefono: z
    .string()
    .trim()
    .regex(/^\d{10,15}$/, "Escribe el número con lada de país y sólo dígitos"),
});

/**
 * Envía un mensaje real al número que indique el dueño.
 *
 * Es la única forma de saber que la conexión sirve: unas credenciales pueden
 * guardarse bien y aun así fallar por un token caducado o sin permisos.
 */
export async function probarWhatsapp(
  _previo: EstadoCanal,
  datos: FormData,
): Promise<EstadoCanal> {
  const sesion = await exigirPermisoEnAccion("configurar");
  const r = esquemaPrueba.safeParse(Object.fromEntries(datos));
  if (!r.success) return { error: r.error.issues[0]?.message ?? "Número inválido" };

  const t = await db.tenant.findUniqueOrThrow({
    where: { id: sesion.tenantId },
    select: { waPhoneNumberId: true, waTokenCifrado: true, nombre: true },
  });
  if (!t.waPhoneNumberId || !t.waTokenCifrado) {
    return { error: "Conecta WhatsApp antes de probarlo." };
  }

  const { enviarTexto } = await import("@/lib/whatsapp");
  const envio = await enviarTexto(
    t.waPhoneNumberId,
    t.waTokenCifrado,
    r.data.telefono,
    `Prueba de conexión de ${t.nombre}. Si lees esto, el canal quedó bien configurado.`,
  );

  await auditar(
    sesion.tenantId,
    sesion.nombre,
    envio.ok ? "prueba_whatsapp_ok" : "prueba_whatsapp_fallida",
    { destino: r.data.telefono, error: envio.ok ? null : envio.error },
  );

  if (!envio.ok) {
    return { error: `No se pudo enviar: ${envio.error}` };
  }
  return { ok: "Mensaje enviado. Revisa ese teléfono." };
}
