import { NextResponse, type NextRequest } from "next/server";
import { nombreCookieSesion } from "@/lib/sesion";

/**
 * Puerta de entrada al panel.
 *
 * Sólo comprueba la presencia de la cookie para redirigir temprano; la
 * verificación real de la firma ocurre en cada página con `leerSesion()`.
 * Una cookie inventada pasa por aquí pero no sobrevive a la verificación.
 */
export function proxy(request: NextRequest) {
  const tieneCookie = request.cookies.has(nombreCookieSesion);

  if (!tieneCookie) {
    const destino = new URL("/entrar", request.url);
    destino.searchParams.set("siguiente", request.nextUrl.pathname);
    return NextResponse.redirect(destino);
  }

  return NextResponse.next();
}

export const config = {
  // /admin también pasa por aquí; el rol se comprueba dentro de la página con
  // `exigirPermiso("admin")`, porque el proxy no debe confiar en el contenido
  // de la cookie sin verificar su firma.
  matcher: ["/panel/:path*", "/admin/:path*"],
};
