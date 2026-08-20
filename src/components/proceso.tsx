import { fases, site } from "@/lib/site";

export function Proceso() {
  return (
    <section
      id="proceso"
      className="scroll-mt-8 border-t border-borde px-6 py-28 sm:px-10 lg:px-14"
    >
      <div className="mx-auto max-w-6xl">
        <p className="etiqueta">Arquitectura y fases</p>
        <h2 className="titular mt-8 max-w-3xl text-titulo">
          Construir primero <span className="acento">lo vendible</span>.
        </h2>
        <p className="mt-10 max-w-2xl text-lg font-light leading-relaxed text-apagado">
          {site.promesa}
        </p>

        <ol className="mt-20 grid gap-px bg-borde md:grid-cols-3">
          {fases.map((f, i) => (
            <li key={f.fase} className="bg-papel p-9">
              <p className="cifra text-5xl text-marca/30">
                {String(i + 1).padStart(2, "0")}
              </p>
              <p className="mt-6 text-[0.65rem] uppercase tracking-[0.25em] text-marca">
                {f.fase}
              </p>
              <h3 className="titular mt-3 text-2xl">{f.nombre}</h3>
              <p className="mt-5 text-sm font-light leading-relaxed text-apagado">
                {f.detalle}
              </p>
            </li>
          ))}
        </ol>

        <div className="mt-16 border-l border-marca/40 pl-8">
          <h3 className="text-[0.65rem] uppercase tracking-[0.25em] text-marca">
            Cliente ideal
          </h3>
          <p className="mt-4 max-w-3xl text-sm font-light leading-relaxed text-tinta-suave">
            {site.clienteIdeal}
          </p>
        </div>
      </div>
    </section>
  );
}
