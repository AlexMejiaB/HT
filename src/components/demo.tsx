import { conversacionDemo } from "@/lib/site";
import { cn } from "@/lib/utils";

/**
 * El primer flujo que el brief exige que quede perfecto, mostrado como
 * conversación real: pregunta de anuncio, consulta a la fuente y escalamiento.
 */
export function Demo() {
  return (
    <section className="border-t border-borde bg-papel-tenue px-6 py-28 sm:px-10 lg:px-14">
      <div className="mx-auto grid max-w-6xl gap-20 lg:grid-cols-2 lg:items-center">
        <div>
          <p className="etiqueta">Así se ve</p>
          <h2 className="titular mt-8 text-titulo">
            Contesta en segundos. <span className="acento">Sabe cuándo callarse.</span>
          </h2>
          <p className="mt-10 max-w-md text-lg font-light leading-relaxed text-apagado">
            Responde con catálogo, precios, stock y políticas configuradas por ti. Cuando
            aparece una factura, un cambio de pedido o una molestia, se detiene y entrega
            el caso a una persona con el contexto listo.
          </p>
        </div>

        <ol className="space-y-4">
          {conversacionDemo.map((m, i) => (
            <li
              key={i}
              className={cn(
                "px-6 py-4 text-sm font-light leading-relaxed",
                m.de === "cliente" && "max-w-[88%] border border-borde bg-papel",
                m.de === "agente" && "ml-auto max-w-[88%] bg-papel-alto text-tinta",
                m.de === "sistema" &&
                  "border-l border-marca bg-marca-tenue text-xs uppercase tracking-[0.15em] text-marca",
              )}
            >
              {m.de !== "sistema" && (
                <span className="mb-2 block text-[0.6rem] uppercase tracking-[0.25em] text-apagado">
                  {m.de === "cliente" ? "Cliente" : "Agente"}
                </span>
              )}
              {m.texto}
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
