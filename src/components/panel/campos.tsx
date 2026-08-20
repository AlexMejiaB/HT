"use client";

import { useFormStatus } from "react-dom";
import type { EstadoAccion } from "@/lib/acciones/configuracion";

export function Campo({
  etiqueta,
  nombre,
  valor,
  tipo = "text",
  ayuda,
  ...resto
}: {
  etiqueta: string;
  nombre: string;
  valor?: string | number | null;
  tipo?: string;
  ayuda?: string;
} & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div>
      <label htmlFor={nombre} className="block text-xs font-bold uppercase tracking-[0.12em]">
        {etiqueta}
      </label>
      <input
        id={nombre}
        name={nombre}
        type={tipo}
        defaultValue={valor ?? ""}
        className="mt-2 w-full border border-borde bg-papel px-4 py-2.5 text-sm"
        {...resto}
      />
      {ayuda && <p className="mt-1 text-xs text-apagado">{ayuda}</p>}
    </div>
  );
}

export function Area({
  etiqueta,
  nombre,
  valor,
  ayuda,
  filas = 3,
  ...resto
}: {
  etiqueta: string;
  nombre: string;
  valor?: string | null;
  ayuda?: string;
  filas?: number;
} & React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <div>
      <label htmlFor={nombre} className="block text-xs font-bold uppercase tracking-[0.12em]">
        {etiqueta}
      </label>
      <textarea
        id={nombre}
        name={nombre}
        rows={filas}
        defaultValue={valor ?? ""}
        className="mt-2 w-full border border-borde bg-papel px-4 py-2.5 text-sm"
        {...resto}
      />
      {ayuda && <p className="mt-1 text-xs text-apagado">{ayuda}</p>}
    </div>
  );
}

export function Guardar({ children = "Guardar" }: { children?: React.ReactNode }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="bg-marca px-6 py-3 text-xs uppercase tracking-[0.2em] text-papel transition-colors hover:bg-marca-claro disabled:opacity-60"
    >
      {pending ? "Guardando…" : children}
    </button>
  );
}

export function Aviso({ estado }: { estado: EstadoAccion }) {
  if (!estado.ok && !estado.error) return null;
  const esError = Boolean(estado.error);
  return (
    <p
      role="status"
      className={`border-l-2 px-4 py-3 text-sm ${
        esError
          ? "border-marca bg-marca-tenue text-marca-claro"
          : "border-marca/40 bg-papel-tenue text-tinta-suave"
      }`}
    >
      {estado.error ?? estado.ok}
    </p>
  );
}
