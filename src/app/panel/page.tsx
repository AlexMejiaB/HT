import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { leerSesion } from "@/lib/sesion";
import Link from "next/link";
import { metricasDe, escalamientosPendientes } from "@/lib/metricas";
import { marcarEscalamientoAtendido } from "@/lib/acciones/configuracion";
import { consultarUso } from "@/lib/agente/uso";

export const metadata: Metadata = {
  title: "Resumen",
  robots: { index: false, follow: false },
};

// Los datos cambian con cada conversación: nunca se sirven cacheados.
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

export default async function Resumen({ searchParams }: PageProps<"/panel">) {
  const sesion = await leerSesion();
  if (!sesion) redirect("/entrar");
  const { sinpermiso } = await searchParams;

  const [m, pendientes, uso] = await Promise.all([
    metricasDe(sesion.tenantId),
    escalamientosPendientes(sesion.tenantId),
    consultarUso(sesion.tenantId),
  ]);

  return (
    <>
      {sinpermiso && (
        <p className="mb-6 border-l border-marca bg-marca-tenue px-4 py-3 text-sm text-marca-claro">
          Tu rol no tiene acceso a esa sección. Pídeselo al dueño de la cuenta.
        </p>
      )}

      <h1 className="titular text-3xl">Últimos {m.dias} días</h1>

      <div className="mt-8 grid gap-px bg-borde sm:grid-cols-2 lg:grid-cols-4">
        <Tarjeta titulo="Conversaciones" valor={m.conversaciones} />
        <Tarjeta titulo="Leads capturados" valor={m.leads} />
        <Tarjeta titulo="Casos escalados" valor={m.escalados} />
        <Tarjeta
          titulo="Resueltas sin persona"
          valor={`${m.tasaAutonomia}%`}
          acento
        />
      </div>

      <div className="mt-4 grid gap-px bg-borde sm:grid-cols-2">
        <Tarjeta
          titulo="Primera respuesta promedio"
          valor={m.primeraRespuestaSeg === null ? "—" : `${m.primeraRespuestaSeg}s`}
        />
        <Tarjeta titulo="Escalados sin atender" valor={m.pendientes} acento={m.pendientes > 0} />
      </div>

      <div className="mt-4 grid gap-px bg-borde sm:grid-cols-2">
        <Tarjeta
          titulo="Mensajes este mes"
          valor={uso.limite ? `${uso.mensajes} / ${uso.limite}` : uso.mensajes}
          acento={uso.agotado}
        />
        <Tarjeta
          titulo="Tokens consumidos"
          valor={(uso.tokensEntrada + uso.tokensSalida).toLocaleString("es-MX")}
        />
      </div>

      {uso.agotado && (
        <p className="mt-4 border-l border-marca bg-marca-tenue px-4 py-3 text-sm text-marca-claro">
          Alcanzaste el límite mensual. El agente está entregando los casos a una persona en
          vez de contestar. Sube el tope en Configuración para reanudarlo.
        </p>
      )}

      <section className="mt-12">
        <h2 className="titular text-xl">Qué preguntan</h2>
        {m.porIntencion.length === 0 ? (
          <p className="mt-4 text-sm text-apagado">Todavía no hay conversaciones registradas.</p>
        ) : (
          <ul className="mt-4 space-y-2">
            {m.porIntencion.map((i) => {
              const max = m.porIntencion[0].total || 1;
              return (
                <li key={i.intencion} className="flex items-center gap-4 bg-papel p-3">
                  <span className="w-44 shrink-0 text-sm font-semibold">
                    {ETIQUETA_INTENCION[i.intencion ?? "OTRO"] ?? i.intencion}
                  </span>
                  <span className="h-2 flex-1 bg-papel-tenue">
                    <span
                      className="block h-full bg-marca"
                      style={{ width: `${Math.round((i.total / max) * 100)}%` }}
                    />
                  </span>
                  <span className="w-10 shrink-0 text-right text-sm tabular-nums">{i.total}</span>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="mt-12">
        <h2 className="titular text-xl">Casos que esperan a una persona</h2>
        {pendientes.length === 0 ? (
          <p className="mt-4 text-sm text-apagado">Nada pendiente. El agente resolvió todo.</p>
        ) : (
          <ul className="mt-4 space-y-3">
            {pendientes.map((e) => (
              <li key={e.id} className="border-l-2 border-marca bg-papel p-5">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="font-semibold">
                    {e.conversacion.contacto.nombre ?? e.conversacion.contacto.telefono}
                  </p>
                  <p className="text-xs text-apagado">
                    {e.creadoEn.toLocaleString("es-MX")}
                  </p>
                </div>
                <p className="mt-1 text-xs font-bold uppercase tracking-[0.1em] text-marca">
                  {e.motivo}
                </p>
                <p className="mt-2 text-sm">{e.resumen}</p>
                {e.accionSugerida && (
                  <p className="mt-2 text-sm text-apagado">
                    Sugerido: {e.accionSugerida}
                  </p>
                )}
                <div className="mt-3 flex items-center gap-4">
                  <form action={marcarEscalamientoAtendido}>
                    <input type="hidden" name="id" value={e.id} />
                    <button
                      type="submit"
                      className="bg-marca px-4 py-2 text-[0.65rem] uppercase tracking-[0.2em] text-papel hover:bg-marca-claro"
                    >
                      Marcar como atendido
                    </button>
                  </form>
                  <Link
                    href={`/panel/conversaciones/${e.conversacion.id}`}
                    className="text-xs font-bold uppercase tracking-wide hover:text-marca"
                  >
                    Ver conversación
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}

function Tarjeta({
  titulo,
  valor,
  acento = false,
}: {
  titulo: string;
  valor: string | number;
  acento?: boolean;
}) {
  return (
    <div className="bg-papel p-6">
      <p className="text-xs font-bold uppercase tracking-[0.12em] text-apagado">{titulo}</p>
      <p className={`titular mt-2 text-4xl ${acento ? "text-marca" : ""}`}>{valor}</p>
    </div>
  );
}
