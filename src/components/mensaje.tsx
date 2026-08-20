import { site, paquetes, notaCostosExternos } from "@/lib/site";

/**
 * Planteamiento del problema y comparativa de los tres planes. La tabla se
 * apoya en filetes finos, no en cajas: el bloque tabular pesa demasiado en un
 * diseño con este aire.
 */
export function Mensaje() {
  return (
    <section className="border-t border-borde px-6 py-28 sm:px-10 lg:px-14">
      <div className="mx-auto max-w-6xl">
        <p className="etiqueta">{site.mensaje.etiqueta}</p>
        <h2 className="titular mt-8 max-w-4xl text-titulo">
          Tu tienda ya vende. Ahora deja de <span className="acento">operar cada mensaje</span>{" "}
          personalmente.
        </h2>
        <p className="mt-10 max-w-2xl text-lg font-light leading-relaxed text-apagado">
          {site.mensaje.cuerpo}
        </p>

        <div className="mt-20 overflow-x-auto">
          <table className="w-full min-w-[44rem] border-collapse text-left">
            <thead>
              <tr className="border-b border-marca/40">
                {["Plan", "Foco", "Implementación", "Mensualidad"].map((h) => (
                  <th
                    key={h}
                    className="pb-5 text-[0.65rem] font-normal uppercase tracking-[0.25em] text-marca"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {paquetes.map((p) => (
                <tr key={p.id} className="border-b border-borde">
                  <td className="py-7 pr-6 font-display text-xl font-light">{p.nombre}</td>
                  <td className="py-7 pr-6 text-sm font-light text-apagado">{p.gancho}</td>
                  <td className="cifra py-7 pr-6 whitespace-nowrap text-lg">
                    {p.implementacion}
                  </td>
                  <td className="cifra py-7 whitespace-nowrap text-lg text-marca">
                    {p.mensualidad}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <p className="mt-8 max-w-3xl text-xs font-light leading-relaxed text-apagado">
          <span className="text-tinta">Importante.</span> {notaCostosExternos}
        </p>
      </div>
    </section>
  );
}
