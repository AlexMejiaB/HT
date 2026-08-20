import { guardrails } from "@/lib/site";

/**
 * Los límites del agente son el argumento de venta más fuerte: el miedo real
 * del dueño no es que el bot no conteste, es que invente un precio o cancele
 * un pedido.
 */
export function Guardrails() {
  return (
    <section
      id="guardrails"
      className="scroll-mt-8 border-t border-borde px-6 py-28 sm:px-10 lg:px-14"
    >
      <div className="mx-auto max-w-6xl">
        <p className="etiqueta">{guardrails.etiqueta}</p>
        <h2 className="titular mt-8 max-w-3xl text-titulo">
          El agente ayuda. <span className="acento">No improvisa.</span>
        </h2>

        <div className="mt-20 grid gap-16 lg:grid-cols-[1.2fr_1fr]">
          <div>
            <h3 className="text-[0.65rem] uppercase tracking-[0.25em] text-marca">
              Restricciones críticas
            </h3>
            <ul className="mt-8">
              {guardrails.restricciones.map((r, i) => (
                <li
                  key={r}
                  className="flex gap-6 border-b border-borde py-5 text-sm font-light leading-relaxed"
                >
                  <span className="cifra shrink-0 text-xs text-marca">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <span className="text-tinta-suave">{r}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="space-y-14">
            <div>
              <h3 className="text-[0.65rem] uppercase tracking-[0.25em] text-marca">
                {guardrails.escalamiento.titulo}
              </h3>
              <p className="mt-6 text-sm font-light leading-relaxed text-apagado">
                {guardrails.escalamiento.cuerpo}
              </p>
            </div>
            <div>
              <h3 className="text-[0.65rem] uppercase tracking-[0.25em] text-marca">
                {guardrails.alEscalar.titulo}
              </h3>
              <p className="mt-6 text-sm font-light leading-relaxed text-apagado">
                {guardrails.alEscalar.cuerpo}
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
