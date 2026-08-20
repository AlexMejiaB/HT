import type { Metadata } from "next";
import { db } from "@/lib/db";
import { exigirCapacidad } from "@/lib/permisos";
import { eliminarLinea, eliminarEjemplo } from "@/lib/acciones/lineas";
import {
  FormularioLinea,
  FormularioAsignar,
  FormularioEjemplo,
} from "@/app/panel/lineas/formularios";

export const metadata: Metadata = {
  title: "Líneas y contexto",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function Lineas() {
  const sesion = await exigirCapacidad("configurar", "lineas");

  const [lineas, ejemplos, sinLinea] = await Promise.all([
    db.lineaProducto.findMany({
      where: { tenantId: sesion.tenantId, activo: true },
      orderBy: { creadoEn: "asc" },
      select: {
        id: true,
        nombre: true,
        contexto: true,
        porDefecto: true,
        _count: { select: { productos: true } },
      },
    }),
    db.ejemploRespuesta.findMany({
      where: { tenantId: sesion.tenantId, activo: true },
      orderBy: { creadoEn: "desc" },
      select: {
        id: true,
        pregunta: true,
        respuesta: true,
        linea: { select: { nombre: true } },
      },
    }),
    db.producto.count({
      where: { tenantId: sesion.tenantId, activo: true, lineaId: null },
    }),
  ]);

  const opciones = lineas.map((l) => ({ id: l.id, nombre: l.nombre }));

  return (
    <>
      <h1 className="titular text-3xl">Líneas y contexto</h1>
      <p className="mt-2 max-w-2xl text-sm text-apagado">
        El contexto general del negocio va en Configuración. Aquí defines lo que cambia por
        marca o línea: el agente sólo carga el contexto de la línea por la que preguntan, no
        el de todo el catálogo.
      </p>

      {sinLinea > 0 && lineas.length > 0 && (
        <p className="mt-6 max-w-2xl border-l border-marca bg-marca-tenue px-4 py-3 text-sm text-marca-claro">
          {sinLinea} producto(s) sin línea asignada. Preguntas sobre ellos usarán la línea
          por defecto, o sólo el contexto general si no hay ninguna marcada.
        </p>
      )}

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <FormularioLinea />
        <FormularioAsignar lineas={opciones} />
      </div>

      <h2 className="titular mt-12 text-xl">
        {lineas.length} línea{lineas.length === 1 ? "" : "s"}
      </h2>
      {lineas.length === 0 ? (
        <p className="mt-4 text-sm text-apagado">
          Todavía no hay líneas. Sin ellas el agente usa sólo el contexto general del
          negocio, que para un catálogo de una sola marca es suficiente.
        </p>
      ) : (
        <ul className="mt-4 space-y-3">
          {lineas.map((l) => (
            <li key={l.id} className="border-l-2 border-borde bg-papel p-5">
              <div className="flex flex-wrap items-baseline justify-between gap-3">
                <p className="font-semibold">
                  {l.nombre}
                  {l.porDefecto && (
                    <span className="ml-2 border border-marca px-1.5 py-0.5 text-[0.6rem] uppercase tracking-[0.1em] text-marca">
                      por defecto
                    </span>
                  )}
                </p>
                <span className="text-xs text-apagado">
                  {l._count.productos} producto(s)
                </span>
              </div>
              <p className="mt-2 whitespace-pre-wrap text-sm text-apagado">{l.contexto}</p>
              <form action={eliminarLinea} className="mt-3">
                <input type="hidden" name="id" value={l.id} />
                <button
                  type="submit"
                  className="text-xs font-bold uppercase tracking-wide text-apagado hover:text-marca"
                >
                  Quitar línea
                </button>
              </form>
            </li>
          ))}
        </ul>
      )}

      <h2 className="titular mt-14 text-xl">Ejemplos de estilo</h2>
      <div className="mt-4 max-w-2xl">
        <FormularioEjemplo lineas={opciones} />
      </div>

      {ejemplos.length > 0 && (
        <ul className="mt-6 space-y-2">
          {ejemplos.map((e) => (
            <li key={e.id} className="border border-borde bg-papel px-5 py-4 text-sm">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-apagado">Cliente: {e.pregunta}</p>
                  <p className="mt-1 font-semibold">Agente: {e.respuesta}</p>
                  <p className="mt-1.5 text-xs text-apagado">
                    {e.linea ? `Sólo ${e.linea.nombre}` : "Todo el negocio"}
                  </p>
                </div>
                <form action={eliminarEjemplo}>
                  <input type="hidden" name="id" value={e.id} />
                  <button
                    type="submit"
                    className="shrink-0 text-xs font-bold uppercase tracking-wide text-apagado hover:text-marca"
                  >
                    Quitar
                  </button>
                </form>
              </div>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
