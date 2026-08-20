import { fases, site } from "@/lib/site";

export function Proceso() {
  return (
    <section
      id="proceso"
      className="scroll-mt-8 bg-papel-tenue px-5 py-20 sm:px-8 lg:px-12"
    >
      <div className="mx-auto max-w-6xl">
        <p className="etiqueta">Arquitectura y fases</p>
        <h2 className="titular mt-3 max-w-3xl text-titulo">
          Construir primero lo vendible.
        </h2>
        <p className="mt-6 max-w-3xl text-base text-apagado sm:text-lg">
          {site.promesa}
        </p>

        <ol className="mt-12 grid gap-6 md:grid-cols-3">
          {fases.map((f) => (
            <li key={f.fase} className="border-t-2 border-tinta bg-papel p-6">
              <p className="etiqueta">{f.fase}</p>
              <h3 className="titular mt-2 text-xl">{f.nombre}</h3>
              <p className="mt-3 text-sm text-apagado">{f.detalle}</p>
            </li>
          ))}
        </ol>

        <div className="mt-10 border-l-2 border-marca bg-papel p-6">
          <h3 className="text-xs font-extrabold uppercase tracking-[0.12em] text-marca">
            Cliente ideal
          </h3>
          <p className="mt-2 max-w-4xl text-sm text-tinta-suave">{site.clienteIdeal}</p>
        </div>
      </div>
    </section>
  );
}
