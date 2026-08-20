import { site } from "@/lib/site";
import { Logotipo, Simbolo } from "@/components/marca";
import { BotonAgendar, BotonWhatsapp } from "@/components/acciones";

/**
 * Portada a pantalla completa. El titular ocupa el espacio que en una landing
 * convencional ocuparían tres secciones: el vacío es parte del argumento.
 */
export function Hero() {
  return (
    <section className="relative min-h-screen overflow-hidden">
      {/* Marca de agua: el símbolo del logo, enorme y apenas visible. */}
      <Simbolo
        className="pointer-events-none absolute -right-24 top-1/4 h-[36rem] opacity-[0.04]"
      />

      <div className="relative mx-auto flex min-h-screen max-w-6xl flex-col px-6 sm:px-10 lg:px-14">
        <header className="flex items-center justify-between py-8">
          <Logotipo />
          <nav className="hidden items-center gap-10 text-[0.7rem] uppercase tracking-[0.25em] text-apagado md:flex">
            <a href="#paquetes" className="transition-colors hover:text-marca">
              Paquetes
            </a>
            <a href="#guardrails" className="transition-colors hover:text-marca">
              Criterio
            </a>
            <a href="#proceso" className="transition-colors hover:text-marca">
              Método
            </a>
          </nav>
        </header>

        <div className="flex flex-1 flex-col justify-center py-24 animate-surgir">
          <p className="etiqueta">{site.hero.etiqueta}</p>
          <div className="filete mt-6 w-32" />

          <h1 className="titular mt-12 max-w-4xl text-display">
            {site.hero.titulo[0]}
            <br />
            <span className="acento">{site.hero.titulo[1]}</span>
          </h1>

          <p className="mt-14 max-w-lg text-lg font-light leading-relaxed text-apagado">
            {site.hero.subtitulo}
          </p>

          <div className="mt-14 flex flex-col gap-4 sm:flex-row">
            <BotonAgendar variante="solido">Agenda un diagnóstico</BotonAgendar>
            <BotonWhatsapp variante="contorno">Escríbenos</BotonWhatsapp>
          </div>
        </div>

        <div className="border-t border-borde py-8">
          <p className="max-w-2xl text-sm font-light leading-relaxed text-apagado">
            {site.hero.pie}
          </p>
        </div>
      </div>
    </section>
  );
}
