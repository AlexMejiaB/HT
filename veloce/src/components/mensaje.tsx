import { site, paquetes, notaCostosExternos } from "@/lib/site";

/**
 * El bloque "El mensaje" del documento comercial, con la tabla comparativa
 * de los tres planes. En móvil la tabla se vuelve una lista de tarjetas.
 */
export function Mensaje() {
  return (
    <section className="px-5 py-20 sm:px-8 lg:px-12">
      <div className="mx-auto max-w-6xl">
        <p className="etiqueta">{site.mensaje.etiqueta}</p>
        <h2 className="titular mt-3 max-w-4xl text-titulo">
          {site.mensaje.titulo}
        </h2>
        <p className="mt-6 max-w-3xl text-base text-apagado sm:text-lg">
          {site.mensaje.cuerpo}
        </p>

        <div className="mt-12 overflow-x-auto">
          <table className="w-full min-w-[42rem] border-collapse text-left">
            <thead>
              <tr className="bg-tinta text-marca">
                <th className="px-5 py-5 text-sm font-extrabold uppercase tracking-wide">
                  Plan
                </th>
                <th className="px-5 py-5 text-sm font-extrabold uppercase tracking-wide">
                  Foco
                </th>
                <th className="px-5 py-5 text-sm font-extrabold uppercase tracking-wide">
                  Implementación
                </th>
                <th className="px-5 py-5 text-sm font-extrabold uppercase tracking-wide">
                  Mensualidad
                </th>
              </tr>
            </thead>
            <tbody>
              {paquetes.map((p) => (
                <tr key={p.id} className="border-b border-borde">
                  <td className="px-5 py-4 font-semibold">{p.nombre}</td>
                  <td className="px-5 py-4 text-apagado">{p.gancho}</td>
                  <td className="px-5 py-4 whitespace-nowrap">{p.implementacion}</td>
                  <td className="px-5 py-4 whitespace-nowrap">{p.mensualidad}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <p className="mt-5 max-w-3xl text-xs text-apagado">
          <span className="font-bold text-tinta">Importante:</span> {notaCostosExternos}
        </p>
      </div>
    </section>
  );
}
