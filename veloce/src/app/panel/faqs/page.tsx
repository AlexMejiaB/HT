import type { Metadata } from "next";
import { db } from "@/lib/db";
import { exigirPermiso } from "@/lib/permisos";
import { eliminarFaq } from "@/lib/acciones/configuracion";
import { FormularioFaq } from "@/app/panel/faqs/formulario";

export const metadata: Metadata = {
  title: "Preguntas frecuentes",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function Faqs() {
  const sesion = await exigirPermiso("configurar");

  const faqs = await db.faq.findMany({
    where: { tenantId: sesion.tenantId, activo: true },
    orderBy: { actualEn: "desc" },
    select: { id: true, pregunta: true, respuesta: true },
  });

  return (
    <>
      <h1 className="titular text-3xl">Preguntas frecuentes</h1>
      <p className="mt-2 max-w-2xl text-sm text-apagado">
        Cada pregunta que agregues es una que el agente deja de escalar. Revisa el resumen
        para ver qué te preguntan más.
      </p>

      <div className="mt-8">
        <FormularioFaq />
      </div>

      <h2 className="titular mt-12 text-xl">
        {faqs.length} pregunta{faqs.length === 1 ? "" : "s"} cargada{faqs.length === 1 ? "" : "s"}
      </h2>

      {faqs.length === 0 ? (
        <p className="mt-4 text-sm text-apagado">Todavía no hay preguntas cargadas.</p>
      ) : (
        <ul className="mt-4 space-y-3">
          {faqs.map((f) => (
            <li key={f.id} className="border-l-2 border-borde bg-papel p-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="font-semibold">{f.pregunta}</p>
                  <p className="mt-1.5 text-sm text-apagado">{f.respuesta}</p>
                </div>
                <form action={eliminarFaq}>
                  <input type="hidden" name="id" value={f.id} />
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
