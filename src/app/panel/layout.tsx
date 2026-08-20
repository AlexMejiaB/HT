import { redirect } from "next/navigation";
import Link from "next/link";
import { leerSesion } from "@/lib/sesion";
import { salir } from "@/lib/acciones/auth";
import { puede, ETIQUETA_ROL } from "@/lib/permisos";
import { Logotipo } from "@/components/marca";

export default async function LayoutPanel({ children }: LayoutProps<"/panel">) {
  // Verificación real de la sesión: el proxy sólo mira que exista la cookie.
  const sesion = await leerSesion();
  if (!sesion) redirect("/entrar?siguiente=/panel");

  return (
    <div className="min-h-screen bg-papel-tenue">
      <header className="border-b border-borde bg-papel">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-8 gap-y-3 px-5 py-4">
          <Logotipo />
          <nav className="flex items-center gap-6 text-sm font-semibold">
            <Link href="/panel" className="hover:text-marca">
              Resumen
            </Link>
            <Link href="/panel/conversaciones" className="hover:text-marca">
              Conversaciones
            </Link>
            <Link href="/panel/aprobaciones" className="hover:text-marca">
              Aprobaciones
            </Link>
            {puede(sesion.rol, "configurar") && (
              <>
                <Link href="/panel/canales" className="hover:text-marca">
                  Canales
                </Link>
                <Link href="/panel/catalogo" className="hover:text-marca">
                  Catálogo
                </Link>
                <Link href="/panel/faqs" className="hover:text-marca">
                  Preguntas
                </Link>
                <Link href="/panel/lineas" className="hover:text-marca">
                  Líneas
                </Link>
                <Link href="/panel/tienda" className="hover:text-marca">
                  Tienda
                </Link>
                <Link href="/panel/configuracion" className="hover:text-marca">
                  Configuración
                </Link>
              </>
            )}
            {puede(sesion.rol, "equipo") && (
              <Link href="/panel/equipo" className="hover:text-marca">
                Equipo
              </Link>
            )}
            {puede(sesion.rol, "admin") && (
              <Link href="/admin" className="font-bold text-marca hover:underline">
                Admin
              </Link>
            )}
          </nav>
          <form action={salir} className="ml-auto">
            <span className="mr-4 text-sm text-apagado">
              {sesion.nombre}
              <span className="ml-2 text-xs">({ETIQUETA_ROL[sesion.rol] ?? sesion.rol})</span>
            </span>
            <button type="submit" className="text-sm font-semibold hover:text-marca">
              Salir
            </button>
          </form>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-5 py-10">{children}</main>
    </div>
  );
}
