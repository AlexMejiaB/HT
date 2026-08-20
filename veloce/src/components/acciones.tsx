"use client";

import { useEffect, useRef, useState } from "react";
import { CalendarDays, MessageCircle, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { contacto, urlWhatsapp } from "@/lib/site";

const estiloBase =
  "inline-flex items-center justify-center gap-2 px-6 py-3.5 text-sm font-bold tracking-tight transition-colors duration-150";

export function BotonWhatsapp({
  children = "Escríbenos por WhatsApp",
  mensaje,
  variante = "solido",
  className,
}: {
  children?: React.ReactNode;
  mensaje?: string;
  variante?: "solido" | "contorno" | "claro";
  className?: string;
}) {
  return (
    <a
      href={urlWhatsapp(mensaje)}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        estiloBase,
        variante === "solido" && "bg-marca text-papel hover:bg-marca-oscuro",
        variante === "contorno" &&
          "border border-tinta text-tinta hover:bg-tinta hover:text-papel",
        variante === "claro" && "bg-papel text-tinta hover:bg-marca hover:text-papel",
        className,
      )}
    >
      <MessageCircle className="size-4" aria-hidden="true" />
      {children}
    </a>
  );
}

/**
 * Agendado de llamada para los paquetes de ticket alto. Si no hay una URL de
 * Calendly configurada, el botón cae a WhatsApp en vez de romperse.
 */
export function BotonAgendar({
  children = "Agenda una llamada",
  variante = "solido",
  className,
}: {
  children?: React.ReactNode;
  variante?: "solido" | "contorno" | "claro";
  className?: string;
}) {
  const [abierto, setAbierto] = useState(false);

  if (!contacto.calendly) {
    return (
      <BotonWhatsapp variante={variante} className={className}>
        {children}
      </BotonWhatsapp>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setAbierto(true)}
        className={cn(
          estiloBase,
          variante === "solido" && "bg-marca text-papel hover:bg-marca-oscuro",
          variante === "contorno" &&
            "border border-tinta text-tinta hover:bg-tinta hover:text-papel",
          variante === "claro" && "bg-papel text-tinta hover:bg-marca hover:text-papel",
          className,
        )}
      >
        <CalendarDays className="size-4" aria-hidden="true" />
        {children}
      </button>
      {abierto && <ModalCalendly alCerrar={() => setAbierto(false)} />}
    </>
  );
}

function ModalCalendly({ alCerrar }: { alCerrar: () => void }) {
  const contenedor = useRef<HTMLDivElement>(null);

  // Cerrar con Escape y bloquear el scroll del fondo mientras está abierto.
  useEffect(() => {
    const alTeclear = (e: KeyboardEvent) => {
      if (e.key === "Escape") alCerrar();
    };
    document.addEventListener("keydown", alTeclear);
    const overflowPrevio = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    contenedor.current?.focus();
    return () => {
      document.removeEventListener("keydown", alTeclear);
      document.body.style.overflow = overflowPrevio;
    };
  }, [alCerrar]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-tinta/80 p-4"
      onClick={alCerrar}
      role="dialog"
      aria-modal="true"
      aria-label="Agendar llamada de diagnóstico"
    >
      <div
        ref={contenedor}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-3xl h-[80vh] bg-papel"
      >
        <button
          type="button"
          onClick={alCerrar}
          aria-label="Cerrar"
          className="absolute -top-11 right-0 inline-flex items-center gap-1.5 text-sm font-bold text-papel hover:text-marca"
        >
          Cerrar <X className="size-4" aria-hidden="true" />
        </button>
        <iframe
          src={contacto.calendly}
          title="Agendar llamada de diagnóstico"
          className="size-full border-0"
          loading="lazy"
        />
      </div>
    </div>
  );
}
