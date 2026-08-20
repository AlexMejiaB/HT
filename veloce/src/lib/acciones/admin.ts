"use server";

import { revalidatePath } from "next/cache";
import { randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { db } from "@/lib/db";
import { exigirPermisoEnAccion } from "@/lib/permisos";

export type EstadoAdmin = { ok?: string; error?: string; credenciales?: string };

const esquemaTenant = z.object({
  nombre: z.string().min(2, "Nombre del negocio").max(160),
  slug: z
    .string()
    .min(2)
    .max(60)
    .regex(/^[a-z0-9-]+$/, "Sólo minúsculas, números y guiones"),
  plan: z.enum(["RESPONDE", "OPERADOR", "AUTOPILOT"]),
  emailDueno: z.email("Correo del dueño inválido").max(200),
  nombreDueno: z.string().min(2, "Nombre del dueño").max(120),
});

/**
 * Alta de un negocio nuevo con su primer usuario.
 *
 * Se crean juntos en una transacción: un tenant sin dueño es una cuenta a la
 * que nadie puede entrar, y habría que arreglarla por SQL.
 */
export async function crearTenant(
  _previo: EstadoAdmin,
  datos: FormData,
): Promise<EstadoAdmin> {
  const sesion = await exigirPermisoEnAccion("admin");
  const r = esquemaTenant.safeParse(Object.fromEntries(datos));
  if (!r.success) return { error: r.error.issues[0]?.message ?? "Datos inválidos" };

  const { nombre, slug, plan, emailDueno, nombreDueno } = r.data;

  const existe = await db.tenant.findUnique({ where: { slug }, select: { id: true } });
  if (existe) return { error: `Ya existe un negocio con el identificador "${slug}".` };

  const temporal = randomBytes(9).toString("base64url");

  await db.$transaction(async (tx) => {
    const t = await tx.tenant.create({
      data: { nombre, slug, plan },
      select: { id: true },
    });
    await tx.usuario.create({
      data: {
        tenantId: t.id,
        email: emailDueno.toLowerCase(),
        nombre: nombreDueno,
        rol: "DUENO",
        passwordHash: await bcrypt.hash(temporal, 12),
      },
    });
    await tx.eventoAuditoria.create({
      data: {
        tenantId: t.id,
        actor: sesion.nombre,
        accion: "tenant_creado",
        detalle: { slug, plan, dueno: emailDueno },
      },
    });
  });

  revalidatePath("/admin");
  return {
    ok: `Negocio "${nombre}" creado.`,
    credenciales: `${emailDueno} · ${temporal}`,
  };
}

export async function cambiarEstadoTenant(datos: FormData) {
  const sesion = await exigirPermisoEnAccion("admin");
  const id = String(datos.get("id") ?? "");
  const activar = datos.get("activar") === "1";

  await db.tenant.update({ where: { id }, data: { activo: activar } });
  await db.eventoAuditoria.create({
    data: {
      tenantId: id,
      actor: sesion.nombre,
      accion: activar ? "tenant_reactivado" : "tenant_suspendido",
    },
  });
  revalidatePath("/admin");
}
