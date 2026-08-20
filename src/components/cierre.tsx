import { cta, site } from "@/lib/site";
import { Logotipo, Simbolo } from "@/components/marca";
import { BotonAgendar, BotonWhatsapp } from "@/components/acciones";

export function Cierre() {
  return (
    <section className="relative overflow-hidden border-t border-borde px-6 py-32 sm:px-10 lg:px-14">
      <Simbolo className="pointer-events-none absolute -left-20 bottom-0 h-96 opacity-[0.04]" />

      <div className="relative mx-auto max-w-6xl">
        <p className="etiqueta">{cta.etiqueta}</p>
        <div className="filete mt-6 w-32" />
        <h2 className="titular mt-12 max-w-3xl text-titulo">
          Agenda una <span className="acento">llamada de diagnóstico</span>.
        </h2>
        <p className="mt-10 max-w-xl text-lg font-light leading-relaxed text-apagado">
          {cta.cuerpo}
        </p>
        <div className="mt-14 flex flex-col gap-4 sm:flex-row">
          <BotonAgendar variante="solido">Agenda una llamada</BotonAgendar>
          <BotonWhatsapp variante="contorno">Prefiero escribir</BotonWhatsapp>
        </div>
      </div>
    </section>
  );
}

export function Pie() {
  return (
    <footer className="mt-auto border-t border-borde px-6 py-12 sm:px-10 lg:px-14">
      <div className="mx-auto flex max-w-6xl flex-col gap-8 sm:flex-row sm:items-center sm:justify-between">
        <Logotipo />
        <p className="max-w-md text-xs font-light leading-relaxed text-apagado">
          {site.hero.pie}
        </p>
        <p className="text-xs text-apagado">
          © {new Date().getFullYear()} {site.marca}
        </p>
      </div>
    </footer>
  );
}
