import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { db } from "@/lib/db";
import { leerSesion } from "@/lib/sesion";
import { marcarEscalamientoAtendido } from "@/lib/acciones/configuracion";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Conversación",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

const ETIQUETA_INTENCION: Record<string, string> = {
  PRODUCTO: "Producto",
  PRECIO_STOCK: "Precio o stock",
  ENVIO: "Envío",
  ESTATUS_PEDIDO: "Estatus de pedido",
  DEVOLUCION: "Devolución",
  LEAD_CAMPANA: "Lead de campaña",
  HUMANO: "Pidió persona",
  QUEJA: "Queja",
  OTRO: "Otro",
};

export default async function DetalleConversacion({
  params,
}: PageProps<"/panel/conversaciones/[id]">) {
  const sesion = await leerSesion();
  if (!sesion) redirect("/entrar");

  const { id } = await params;

  // El tenantId va en el where, no sólo el id: si no, cualquiera con un id
  // válido leería la conversación de otra tienda.
  const conversacion = await db.conversacion.findFirst({
    where: { id, tenantId: sesion.tenantId },
    select: {
      id: true,
      estado: true,
      intencion: true,
      resumen: true,
      canal: true,
      etiquetas: true,
      creadoEn: true,
      primeraRespuestaMs: true,
      contacto: { select: { nombre: true, telefono: true } },
      mensajes: {
        orderBy: { creadoEn: "asc" },
        select: {
          id: true,
          direccion: true,
          texto: true,
          intencion: true,
          confianza: true,
          generadoPorIA: true,
          creadoEn: true,
        },
      },
      escalamientos: {
        orderBy: { creadoEn: "desc" },
        select: {
          id: true,
          motivo: true,
          resumen: true,
          accionSugerida: true,
          estado: true,
          creadoEn: true,
          atendidoEn: true,
        },
      },
    },
  });

  if (!conversacion) notFound();

  return (
    <>
      <Link
        href="/panel/conversaciones"
        className="inline-flex items-center gap-1.5 text-sm font-semibold hover:text-marca"
      >
        <ArrowLeft className="size-4" aria-hidden="true" />
        Conversaciones
      </Link>

      <h1 className="titular mt-4 text-3xl">
        {conversacion.contacto.nombre ?? conversacion.contacto.telefono}
      </h1>
      {conversacion.etiquetas.length > 0 && (
        <p className="mt-3 flex flex-wrap gap-1.5">
          {conversacion.etiquetas.map((e) => (
            <span
              key={e}
              className="border border-marca px-2 py-0.5 text-[0.6rem] uppercase tracking-[0.12em] text-marca"
            >
              {e}
            </span>
          ))}
        </p>
      )}
      <p className="mt-3 text-sm text-apagado">
        {conversacion.canal === "INSTAGRAM" ? "Instagram" : "WhatsApp"} ·{" "}
        {conversacion.contacto.telefono} · Iniciada el{" "}
        {conversacion.creadoEn.toLocaleString("es-MX")}
        {conversacion.primeraRespuestaMs !== null &&
          ` · Primera respuesta en ${Math.round(conversacion.primeraRespuestaMs / 1000)}s`}
      </p>

      {conversacion.escalamientos.length > 0 && (
        <section className="mt-8">
          <h2 className="titular text-lg">Escalamientos</h2>
          <ul className="mt-3 space-y-3">
            {conversacion.escalamientos.map((e) => (
              <li key={e.id} className="border-l-2 border-marca bg-papel p-5">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="text-xs font-bold uppercase tracking-[0.1em] text-marca">
                    {e.motivo}
                  </p>
                  <p className="text-xs text-apagado">{e.creadoEn.toLocaleString("es-MX")}</p>
                </div>
                <p className="mt-2 text-sm">{e.resumen}</p>
                {e.accionSugerida && (
                  <p className="mt-1 text-sm text-apagado">Sugerido: {e.accionSugerida}</p>
                )}
                <div className="mt-3">
                  {e.estado === "PENDIENTE" ? (
                    <form action={marcarEscalamientoAtendido}>
                      <input type="hidden" name="id" value={e.id} />
                      <button
                        type="submit"
                        className="bg-marca px-4 py-2 text-[0.65rem] uppercase tracking-[0.2em] text-papel hover:bg-marca-claro"
                      >
                        Marcar como atendido
                      </button>
                    </form>
                  ) : (
                    <p className="text-xs font-bold uppercase tracking-wide text-apagado">
                      Atendido {e.atendidoEn?.toLocaleString("es-MX")}
                    </p>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="mt-10">
        <h2 className="titular text-lg">Hilo completo</h2>
        <ol className="mt-4 space-y-3">
          {conversacion.mensajes.map((m) => {
            const entrante = m.direccion === "ENTRANTE";
            return (
              <li
                key={m.id}
                className={cn(
                  "max-w-[80%] px-4 py-3 text-sm",
                  entrante ? "border border-borde bg-papel-tenue" : "ml-auto bg-papel-alto text-tinta",
                )}
              >
                <div className="mb-1 flex items-center gap-2 text-[0.65rem] font-bold uppercase tracking-[0.12em] opacity-60">
                  <span>{entrante ? "Cliente" : m.generadoPorIA ? "Agente" : "Equipo"}</span>
                  <span>{m.creadoEn.toLocaleTimeString("es-MX")}</span>
                  {m.intencion && <span>· {ETIQUETA_INTENCION[m.intencion] ?? m.intencion}</span>}
                  {m.confianza !== null && <span>· conf. {m.confianza.toFixed(2)}</span>}
                </div>
                {m.texto}
              </li>
            );
          })}
        </ol>
      </section>
    </>
  );
}
