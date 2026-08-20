import { conversacionDemo } from "@/lib/site";
import { cn } from "@/lib/utils";

/**
 * El primer flujo que el brief exige que quede perfecto, mostrado como
 * conversación real: pregunta de anuncio, consulta a fuente real y escalamiento.
 */
export function Demo() {
  return (
    <section className="px-5 py-20 sm:px-8 lg:px-12">
      <div className="mx-auto grid max-w-6xl gap-12 lg:grid-cols-2 lg:items-center">
        <div>
          <p className="etiqueta">Así se ve</p>
          <h2 className="titular mt-3 text-titulo">
            Contesta en segundos. Sabe cuándo callarse.
          </h2>
          <p className="mt-6 text-base text-apagado sm:text-lg">
            Responde con catálogo, precios, stock y políticas configuradas por ti. Cuando
            aparece una factura, un cambio de pedido o una molestia, se detiene y pasa el
            caso a una persona con el contexto listo.
          </p>
        </div>

        <div className="border border-borde bg-papel-tenue p-5 sm:p-7">
          <ol className="space-y-3">
            {conversacionDemo.map((m, i) => (
              <li
                key={i}
                className={cn(
                  "max-w-[85%] px-4 py-3 text-sm",
                  m.de === "cliente" && "bg-papel border border-borde",
                  m.de === "agente" && "ml-auto bg-tinta text-papel",
                  m.de === "sistema" &&
                    "mx-auto max-w-full border border-marca bg-marca-suave text-center text-xs font-semibold text-marca-oscuro",
                )}
              >
                {m.de !== "sistema" && (
                  <span className="mb-1 block text-[0.65rem] font-bold uppercase tracking-[0.12em] opacity-60">
                    {m.de === "cliente" ? "Cliente" : "Agente"}
                  </span>
                )}
                {m.texto}
              </li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}
