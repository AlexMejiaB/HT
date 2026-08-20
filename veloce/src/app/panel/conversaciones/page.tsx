import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { leerSesion } from "@/lib/sesion";
import Link from "next/link";
import { conversacionesRecientes } from "@/lib/metricas";

export const metadata: Metadata = {
  title: "Conversaciones",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

const COLOR_ESTADO: Record<string, string> = {
  ABIERTA: "bg-papel-tenue text-tinta",
  ESCALADA: "bg-marca text-papel",
  CERRADA: "bg-borde text-apagado",
};

export default async function Conversaciones() {
  const sesion = await leerSesion();
  if (!sesion) redirect("/entrar");

  const conversaciones = await conversacionesRecientes(sesion.tenantId);

  return (
    <>
      <h1 className="titular text-3xl">Conversaciones</h1>
      <p className="mt-2 text-sm text-apagado">
        Historial revisable de lo que el agente contestó y de lo que entregó a una persona.
      </p>

      {conversaciones.length === 0 ? (
        <p className="mt-8 text-sm text-apagado">
          Todavía no hay conversaciones. Conecta tu número de WhatsApp para empezar a recibirlas.
        </p>
      ) : (
        <div className="mt-8 overflow-x-auto">
          <table className="w-full min-w-[46rem] border-collapse text-left text-sm">
            <thead>
              <tr className="border-b-2 border-tinta">
                <th className="py-3 pr-4 font-extrabold uppercase tracking-wide">Contacto</th>
                <th className="py-3 pr-4 font-extrabold uppercase tracking-wide">Estado</th>
                <th className="py-3 pr-4 font-extrabold uppercase tracking-wide">Etiquetas</th>
                <th className="py-3 pr-4 font-extrabold uppercase tracking-wide">Resumen</th>
                <th className="py-3 pr-4 font-extrabold uppercase tracking-wide">Mensajes</th>
                <th className="py-3 font-extrabold uppercase tracking-wide">Actualizada</th>
              </tr>
            </thead>
            <tbody>
              {conversaciones.map((c) => (
                <tr key={c.id} className="border-b border-borde align-top">
                  <td className="py-4 pr-4 font-semibold">
                    <Link
                      href={`/panel/conversaciones/${c.id}`}
                      className="underline decoration-borde underline-offset-4 hover:text-marca"
                    >
                      {c.contacto.nombre ?? c.contacto.telefono}
                    </Link>
                  </td>
                  <td className="py-4 pr-4">
                    <span
                      className={`inline-block px-2 py-1 text-[0.65rem] font-bold uppercase tracking-[0.1em] ${COLOR_ESTADO[c.estado]}`}
                    >
                      {c.estado}
                    </span>
                  </td>
                  <td className="py-4 pr-4">
                    {c.etiquetas.length === 0 ? (
                      <span className="text-apagado">—</span>
                    ) : (
                      <span className="flex flex-wrap gap-1">
                        {c.etiquetas.map((e) => (
                          <span
                            key={e}
                            className="border border-borde px-1.5 py-0.5 text-[0.6rem] uppercase tracking-[0.1em] text-apagado"
                          >
                            {e}
                          </span>
                        ))}
                      </span>
                    )}
                  </td>
                  <td className="py-4 pr-4 text-apagado">{c.resumen ?? "—"}</td>
                  <td className="py-4 pr-4 tabular-nums">{c._count.mensajes}</td>
                  <td className="py-4 whitespace-nowrap text-apagado">
                    {c.actualEn.toLocaleString("es-MX")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
