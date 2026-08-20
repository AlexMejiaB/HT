"use server";

import { revalidatePath } from "next/cache";
import { randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { db } from "@/lib/db";
import { exigirPermisoEnAccion } from "@/lib/permisos";

export type EstadoEquipo = { ok?: string; error?: string; passwordTemporal?: string };

const esquemaUsuario = z.object({
  email: z.email("Correo inválido").max(200),
  nombre: z.string().min(2, "Escribe el nombre").max(120),
  rol: z.enum(["DUENO", "AGENTE"]),
});

/**
 * Alta de un usuario del tenant.
 *
 * Se genera una contraseña temporal en vez de pedirla en el formulario: así no
 * viaja una contraseña elegida por otra persona, y queda claro que hay que
 * cambiarla. SOPORTE_VELOCE no se puede asignar desde aquí: ese rol lo otorga
 * la consola de administración, no un cliente.
 */
export async function invitarUsuario(
  _previo: EstadoEquipo,
  datos: FormData,
): Promise<EstadoEquipo> {
  const sesion = await exigirPermisoEnAccion("equipo");
  const r = esquemaUsuario.safeParse(Object.fromEntries(datos));
  if (!r.success) return { error: r.error.issues[0]?.message ?? "Datos inválidos" };

  const email = r.data.email.toLowerCase();
  const existe = await db.usuario.findUnique({
    where: { tenantId_email: { tenantId: sesion.tenantId, email } },
    select: { id: true },
  });
  if (existe) return { error: "Ya hay un usuario con ese correo en esta cuenta." };

  const temporal = randomBytes(9).toString("base64url");
  await db.usuario.create({
    data: {
      tenantId: sesion.tenantId,
      email,
      nombre: r.data.nombre,
      rol: r.data.rol,
      passwordHash: await bcrypt.hash(temporal, 12),
    },
  });

  await db.eventoAuditoria.create({
    data: {
      tenantId: sesion.tenantId,
      actor: sesion.nombre,
      accion: "usuario_invitado",
      detalle: { email, rol: r.data.rol },
    },
  });

  revalidatePath("/panel/equipo");
  return {
    ok: `Usuario creado. Contraseña temporal: ${temporal}`,
    passwordTemporal: temporal,
  };
}

export async function cambiarEstadoUsuario(datos: FormData) {
  const sesion = await exigirPermisoEnAccion("equipo");
  const id = String(datos.get("id") ?? "");
  const activar = datos.get("activar") === "1";

  // Nadie puede desactivarse a sí mismo: dejaría la cuenta sin acceso.
  if (id === sesion.usuarioId) return;

  await db.usuario.updateMany({
    where: { id, tenantId: sesion.tenantId },
    data: { activo: activar },
  });

  await db.eventoAuditoria.create({
    data: {
      tenantId: sesion.tenantId,
      actor: sesion.nombre,
      accion: activar ? "usuario_reactivado" : "usuario_desactivado",
      recurso: `usuario:${id}`,
    },
  });
  revalidatePath("/panel/equipo");
}

const esquemaContacto = z.object({
  nombre: z.string().min(2).max(120),
  telefono: z.string().min(10, "Incluye lada del país, p. ej. 5215512345678").max(20),
});

/** Contactos a los que se avisa cuando el agente escala un caso. */
export async function agregarContactoEquipo(
  _previo: EstadoEquipo,
  datos: FormData,
): Promise<EstadoEquipo> {
  const sesion = await exigirPermisoEnAccion("equipo");
  const r = esquemaContacto.safeParse(Object.fromEntries(datos));
  if (!r.success) return { error: r.error.issues[0]?.message ?? "Datos inválidos" };

  await db.contactoEquipo.create({
    data: {
      tenantId: sesion.tenantId,
      nombre: r.data.nombre,
      telefono: r.data.telefono.replace(/\D/g, ""),
    },
  });
  revalidatePath("/panel/equipo");
  return { ok: "Contacto agregado. Recibirá los avisos de escalamiento." };
}

export async function quitarContactoEquipo(datos: FormData) {
  const sesion = await exigirPermisoEnAccion("equipo");
  const id = String(datos.get("id") ?? "");
  await db.contactoEquipo.deleteMany({ where: { id, tenantId: sesion.tenantId } });
  revalidatePath("/panel/equipo");
}
