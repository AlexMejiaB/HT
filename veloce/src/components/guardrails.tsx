import { ShieldAlert, UserRound, Send } from "lucide-react";
import { guardrails } from "@/lib/site";

/**
 * Los límites del agente son argumento de venta: el miedo real del dueño
 * es que un bot invente precios o cancele pedidos.
 */
export function Guardrails() {
  return (
    <section
      id="guardrails"
      className="scroll-mt-8 bg-tinta px-5 py-20 text-papel sm:px-8 lg:px-12"
    >
      <div className="mx-auto max-w-6xl">
        <p className="etiqueta">{guardrails.etiqueta}</p>
        <h2 className="titular mt-3 max-w-3xl text-titulo">
          {guardrails.titulo}
        </h2>

        <div className="mt-12 grid gap-10 lg:grid-cols-2">
          <div>
            <h3 className="flex items-center gap-2 text-sm font-extrabold uppercase tracking-[0.12em] text-marca">
              <ShieldAlert className="size-4" aria-hidden="true" />
              Restricciones críticas
            </h3>
            <ul className="mt-5 space-y-3">
              {guardrails.restricciones.map((r) => (
                <li key={r} className="flex gap-3 border-b border-borde-oscuro pb-3 text-sm">
                  <span className="text-marca" aria-hidden="true">
                    —
                  </span>
                  <span className="text-papel/85">{r}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="space-y-8">
            <div>
              <h3 className="flex items-center gap-2 text-sm font-extrabold uppercase tracking-[0.12em] text-marca">
                <UserRound className="size-4" aria-hidden="true" />
                {guardrails.escalamiento.titulo}
              </h3>
              <p className="mt-4 text-sm text-papel/85">{guardrails.escalamiento.cuerpo}</p>
            </div>
            <div>
              <h3 className="flex items-center gap-2 text-sm font-extrabold uppercase tracking-[0.12em] text-marca">
                <Send className="size-4" aria-hidden="true" />
                {guardrails.alEscalar.titulo}
              </h3>
              <p className="mt-4 text-sm text-papel/85">{guardrails.alEscalar.cuerpo}</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
