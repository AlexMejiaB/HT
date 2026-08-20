import { site } from "@/lib/site";
import { Logotipo } from "@/components/marca";
import { BotonAgendar, BotonWhatsapp } from "@/components/acciones";

export function Hero() {
  return (
    <section className="px-5 pt-8 pb-20 sm:px-8 lg:px-12">
      <div className="mx-auto max-w-6xl">
        <header className="flex items-center justify-between py-6">
          <Logotipo />
          <nav className="hidden items-center gap-8 text-sm font-semibold sm:flex">
            <a href="#paquetes" className="hover:text-marca">
              Paquetes
            </a>
            <a href="#guardrails" className="hover:text-marca">
              Guardrails
            </a>
            <a href="#proceso" className="hover:text-marca">
              Proceso
            </a>
          </nav>
        </header>

        <div className="mt-6 bg-tinta px-6 py-16 text-papel sm:px-12 sm:py-24 lg:py-32 animate-entrada">
          <p className="etiqueta">{site.hero.etiqueta}</p>
          <h1 className="titular mt-10 text-display sm:mt-16">
            {site.hero.titulo[0]}
            <br />
            {site.hero.titulo[1]}
          </h1>
          <p className="mt-10 max-w-xl text-lg text-papel/75 sm:mt-16">
            {site.hero.subtitulo}
          </p>
          <div className="mt-10 flex flex-col gap-3 sm:flex-row">
            <BotonAgendar variante="solido">Agenda un diagnóstico</BotonAgendar>
            <BotonWhatsapp variante="claro">Escríbenos por WhatsApp</BotonWhatsapp>
          </div>
        </div>

        <p className="mt-6 max-w-3xl text-sm text-tinta">{site.hero.pie}</p>
        <p className="mt-1 text-xs text-apagado">
          Documento comercial · {new Date().getFullYear()}
        </p>
      </div>
    </section>
  );
}
