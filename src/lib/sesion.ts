import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { env } from "@/lib/env";

const NOMBRE_COOKIE = "highticket_sesion";
const DURACION_SEG = 60 * 60 * 8;

export type Sesion = {
  usuarioId: string;
  tenantId: string;
  rol: string;
  nombre: string;
};

function clave() {
  return new TextEncoder().encode(env().SECRETO_SESION);
}

export async function crearSesion(sesion: Sesion) {
  const token = await new SignJWT({ ...sesion })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${DURACION_SEG}s`)
    .sign(clave());

  const almacen = await cookies();
  almacen.set(NOMBRE_COOKIE, token, {
    httpOnly: true,
    // Sin JS del cliente, sobre HTTPS en producción y sin envío entre sitios.
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: DURACION_SEG,
  });
}

export async function leerSesion(): Promise<Sesion | null> {
  const almacen = await cookies();
  const token = almacen.get(NOMBRE_COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, clave(), { algorithms: ["HS256"] });
    const { usuarioId, tenantId, rol, nombre } = payload as Record<string, unknown>;
    if (typeof usuarioId !== "string" || typeof tenantId !== "string") return null;
    return {
      usuarioId,
      tenantId,
      rol: String(rol ?? "DUENO"),
      nombre: String(nombre ?? ""),
    };
  } catch {
    return null;
  }
}

export async function cerrarSesion() {
  const almacen = await cookies();
  almacen.delete(NOMBRE_COOKIE);
}

export const nombreCookieSesion = NOMBRE_COOKIE;
