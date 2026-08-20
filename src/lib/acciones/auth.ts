"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { db } from "@/lib/db";
import { crearSesion, cerrarSesion } from "@/lib/sesion";
import { permitir } from "@/lib/rate-limit";

const esquema = z.object({
  email: z.email("Correo inválido").max(200),
  password: z.string().min(1, "Escribe tu contraseña").max(200),
  siguiente: z.string().optional(),
});

export type EstadoLogin = { error?: string };

export async function entrar(
  _previo: EstadoLogin,
  datos: FormData,
): Promise<EstadoLogin> {
  const r = esquema.safeParse({
    email: datos.get("email"),
    password: datos.get("password"),
    siguiente: datos.get("siguiente"),
  });
  if (!r.success) {
    return { error: r.error.issues[0]?.message ?? "Datos inválidos" };
  }

  // Freno a la fuerza bruta, por IP y por correo.
  const cabeceras = await headers();
  const ip = cabeceras.get("x-forwarded-for")?.split(",")[0].trim() ?? "desconocida";
  const limite = permitir(`login:${ip}:${r.data.email}`, 5, 15 * 60_000);
  if (!limite.ok) {
    return {
      error: `Demasiados intentos. Vuelve a intentar en ${Math.ceil(limite.reintentarEnSeg / 60)} minutos.`,
    };
  }

  const usuario = await db.usuario.findFirst({
    where: { email: r.data.email.toLowerCase(), activo: true },
    select: {
      id: true,
      passwordHash: true,
      nombre: true,
      rol: true,
      tenantId: true,
      tenant: { select: { activo: true } },
    },
  });

  // Se compara siempre, exista o no el usuario, para no revelar por tiempo de
  // respuesta qué correos están registrados.
  const hashSenuelo = "$2b$12$abcdefghijklmnopqrstuvwxyz0123456789ABCDEFGHIJKLMNOP";
  const coincide = await bcrypt.compare(
    r.data.password,
    usuario?.passwordHash ?? hashSenuelo,
  );

  if (!usuario || !coincide || !usuario.tenant.activo) {
    return { error: "Correo o contraseña incorrectos." };
  }

  await db.usuario.update({
    where: { id: usuario.id },
    data: { ultimoAcceso: new Date() },
  });

  await crearSesion({
    usuarioId: usuario.id,
    tenantId: usuario.tenantId,
    rol: usuario.rol,
    nombre: usuario.nombre,
  });

  // Sólo rutas internas: un `siguiente` absoluto sería redirección abierta.
  const siguiente = r.data.siguiente;
  const destino =
    siguiente && siguiente.startsWith("/") && !siguiente.startsWith("//")
      ? siguiente
      : "/panel";
  redirect(destino);
}

export async function salir() {
  await cerrarSesion();
  redirect("/entrar");
}
