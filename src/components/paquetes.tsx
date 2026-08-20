import { paquetes, loQueCompran, type Paquete } from "@/lib/site";
import { BotonAgendar, BotonWhatsapp } from "@/components/acciones";
import { cn } from "@/lib/utils";

export function Paquetes() {
  return (
    <section
      id="paquetes"
      className="scroll-mt-8 border-t border-borde bg-papel-tenue px-6 py-28 sm:px-10 lg:px-14"
    >
      <div className="mx-auto max-w-6xl">
        <p className="etiqueta">Los paquetes</p>
        <h2 className="titular mt-8 max-w-3xl text-titulo">
          Empieza pequeño. Automatiza sólo lo <span className="acento">ya probado</span>.
        </h2>

        <div className="mt-20 grid gap-px bg-borde lg:grid-cols-3">
          {paquetes.map((p) => (
            <TarjetaPaquete key={p.id} paquete={p} />
          ))}
        </div>

        <p className="mt-12 max-w-2xl text-sm font-light leading-relaxed text-apagado">
          <span className="text-tinta">Lo que compran.</span> {loQueCompran.toLowerCase()}
        </p>
      </div>
    </section>
  );
}

function TarjetaPaquete({ paquete }: { paquete: Paquete }) {
  return (
    <article
      className={cn(
        "flex flex-col p-9",
        paquete.destacado ? "bg-papel-alto" : "bg-papel-tenue",
      )}
    >
      <div className="flex items-baseline justify-between">
        <p className="text-[0.65rem] uppercase tracking-[0.25em] text-apagado">
          {paquete.orden}
        </p>
        {paquete.destacado && (
          <p className="text-[0.6rem] uppercase tracking-[0.25em] text-marca">
            El más contratado
          </p>
        )}
      </div>

      <h3 className="titular mt-6 text-3xl">{paquete.nombre}</h3>
      <p className="mt-4 text-sm font-light leading-relaxed text-apagado">{paquete.gancho}</p>

      <div className="filete mt-9 w-16" />

      <div className="mt-9">
        <p className="text-[0.6rem] uppercase tracking-[0.25em] text-apagado">
          Implementación
        </p>
        <p className="cifra mt-2 text-4xl">{paquete.implementacion}</p>
        <p className="mt-6 text-[0.6rem] uppercase tracking-[0.25em] text-apagado">
          Mensualidad
        </p>
        <p className="cifra mt-2 text-4xl text-marca">{paquete.mensualidad}</p>
      </div>

      <h4 className="mt-10 text-[0.65rem] uppercase tracking-[0.25em] text-marca">
        Qué resuelve
      </h4>
      <ul className="mt-5 space-y-3">
        {paquete.resuelve.map((item) => (
          <li key={item} className="flex gap-3 text-sm font-light leading-relaxed">
            <span className="mt-2 size-1 shrink-0 rounded-full bg-marca" aria-hidden="true" />
            <span className="text-tinta-suave">{item}</span>
          </li>
        ))}
      </ul>

      <h4 className="mt-9 text-[0.65rem] uppercase tracking-[0.25em] text-marca">
        Ideal para
      </h4>
      <p className="mt-3 text-sm font-light leading-relaxed text-apagado">
        {paquete.idealPara}
      </p>

      <div className="mt-9 border-l border-marca/40 pl-5">
        <p className="text-[0.6rem] uppercase tracking-[0.25em] text-apagado">
          Nota operativa
        </p>
        <p className="mt-2 text-xs font-light leading-relaxed text-apagado">
          {paquete.notaOperativa}
        </p>
      </div>

      {/* El paquete de ticket alto se cierra en llamada; el resto, por WhatsApp. */}
      <div className="mt-auto pt-10">
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
            Me interesa
          </BotonWhatsapp>
        )}
      </div>
    </article>
  );
}
