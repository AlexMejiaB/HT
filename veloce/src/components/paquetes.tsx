import { Check } from "lucide-react";
import { paquetes, loQueCompran, type Paquete } from "@/lib/site";
import { BotonAgendar, BotonWhatsapp } from "@/components/acciones";
import { cn } from "@/lib/utils";

export function Paquetes() {
  return (
    <section id="paquetes" className="scroll-mt-8 bg-papel-tenue px-5 py-20 sm:px-8 lg:px-12">
      <div className="mx-auto max-w-6xl">
        <p className="etiqueta">Los paquetes</p>
        <h2 className="titular mt-3 max-w-3xl text-titulo">
          Empieza pequeño. Automatiza sólo lo que ya esté probado.
        </h2>

        <div className="mt-12 grid gap-6 lg:grid-cols-3">
          {paquetes.map((p) => (
            <TarjetaPaquete key={p.id} paquete={p} />
          ))}
        </div>

        <p className="mt-10 max-w-3xl text-sm">
          <span className="font-bold">Lo que compran:</span>{" "}
          <span className="text-apagado">{loQueCompran.toLowerCase()}</span>
        </p>
      </div>
    </section>
  );
}

function TarjetaPaquete({ paquete }: { paquete: Paquete }) {
  return (
    <article
      className={cn(
        "flex flex-col border bg-papel",
        paquete.destacado ? "border-marca shadow-[0_0_0_1px_var(--color-marca)]" : "border-borde",
      )}
    >
      {paquete.destacado && (
        <p className="bg-marca px-6 py-2 text-xs font-extrabold uppercase tracking-[0.14em] text-papel">
          El más contratado
        </p>
      )}

      <div className="flex flex-1 flex-col p-6 sm:p-7">
        <p className="etiqueta">Paquete {paquete.orden}</p>
        <h3 className="titular mt-2 text-2xl">{paquete.nombre}</h3>
        <p className="mt-3 text-sm text-apagado">{paquete.gancho}</p>

        <div className="mt-6 border-y border-borde py-5">
          <p className="text-[0.7rem] font-bold uppercase tracking-[0.12em] text-apagado">
            Implementación
          </p>
          <p className="titular text-3xl text-marca">{paquete.implementacion}</p>
          <p className="mt-3 text-[0.7rem] font-bold uppercase tracking-[0.12em] text-apagado">
            Mensualidad
          </p>
          <p className="titular text-3xl text-marca">{paquete.mensualidad}</p>
        </div>

        <h4 className="mt-6 text-xs font-extrabold uppercase tracking-[0.12em]">
          Qué resuelve
        </h4>
        <ul className="mt-3 space-y-2 text-sm">
          {paquete.resuelve.map((item) => (
            <li key={item} className="flex gap-2.5">
              <Check className="mt-0.5 size-4 shrink-0 text-marca" aria-hidden="true" />
              <span>{item}</span>
            </li>
          ))}
        </ul>

        <h4 className="mt-6 text-xs font-extrabold uppercase tracking-[0.12em]">
          Ideal para
        </h4>
        <p className="mt-2 text-sm text-apagado">{paquete.idealPara}</p>

        <div className="mt-6 bg-marca-suave p-4">
          <h4 className="text-xs font-extrabold uppercase tracking-[0.12em] text-marca-oscuro">
            Nota operativa
          </h4>
          <p className="mt-1.5 text-xs text-tinta-suave">{paquete.notaOperativa}</p>
        </div>

        {/* Los paquetes de ticket alto se venden en llamada; los demás por WhatsApp. */}
        <div className="mt-7 pt-1">
          {paquete.ticketAlto ? (
            <BotonAgendar variante="solido" className="w-full">
              Agenda una llamada
            </BotonAgendar>
          ) : (
            <BotonWhatsapp
              variante="contorno"
              className="w-full"
              mensaje={`Hola, me interesa ${paquete.nombre}.`}
            >
              Me interesa este plan
            </BotonWhatsapp>
          )}
        </div>
      </div>
    </article>
  );
}
