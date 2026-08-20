"use client";

import { useActionState } from "react";
import { entrar, type EstadoLogin } from "@/lib/acciones/auth";

const estadoInicial: EstadoLogin = {};

export function FormularioEntrar({ siguiente }: { siguiente?: string }) {
  const [estado, accion, pendiente] = useActionState(entrar, estadoInicial);

  return (
    <form action={accion} className="mt-8 space-y-4">
      {siguiente && <input type="hidden" name="siguiente" value={siguiente} />}

      <div>
        <label htmlFor="email" className="block text-xs font-bold uppercase tracking-[0.12em]">
          Correo
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          autoComplete="email"
          className="mt-2 w-full border border-borde bg-papel px-4 py-3 text-sm"
        />
      </div>

      <div>
        <label htmlFor="password" className="block text-xs font-bold uppercase tracking-[0.12em]">
          Contraseña
        </label>
        <input
          id="password"
          name="password"
          type="password"
          required
          autoComplete="current-password"
          className="mt-2 w-full border border-borde bg-papel px-4 py-3 text-sm"
        />
      </div>

      {estado.error && (
        <p role="alert" className="border-l border-marca bg-marca-tenue px-4 py-3 text-sm text-marca-claro">
          {estado.error}
        </p>
      )}

      <button
        type="submit"
        disabled={pendiente}
        className="w-full bg-marca px-6 py-3.5 text-xs uppercase tracking-[0.2em] text-papel transition-colors hover:bg-marca-claro disabled:opacity-60"
      >
        {pendiente ? "Entrando…" : "Entrar"}
      </button>
    </form>
  );
}
