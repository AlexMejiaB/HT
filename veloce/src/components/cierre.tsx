import { cta, site } from "@/lib/site";
import { Logotipo } from "@/components/marca";
import { BotonAgendar, BotonWhatsapp } from "@/components/acciones";

export function Cierre() {
  return (
    <section className="px-5 py-20 sm:px-8 lg:px-12">
      <div className="mx-auto max-w-6xl bg-tinta px-6 py-16 text-papel sm:px-12 sm:py-24">
        <p className="etiqueta">{cta.etiqueta}</p>
        <h2 className="titular mt-3 max-w-3xl text-titulo">
          {cta.titulo}
        </h2>
        <p className="mt-6 max-w-2xl text-base text-papel/75 sm:text-lg">{cta.cuerpo}</p>
        <div className="mt-10 flex flex-col gap-3 sm:flex-row">
          <BotonAgendar variante="solido">Agenda una llamada</BotonAgendar>
          <BotonWhatsapp variante="claro">Prefiero escribir por WhatsApp</BotonWhatsapp>
        </div>
      </div>
    </section>
  );
}

export function Pie() {
  return (
    <footer className="mt-auto border-t border-borde px-5 py-10 sm:px-8 lg:px-12">
      <div className="mx-auto flex max-w-6xl flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
        <Logotipo />
        <p className="max-w-md text-xs text-apagado">{site.hero.pie}</p>
        <p className="text-xs text-apagado">
          © {new Date().getFullYear()} {site.marca} {site.marcaSufijo}
        </p>
      </div>
    </footer>
  );
}
