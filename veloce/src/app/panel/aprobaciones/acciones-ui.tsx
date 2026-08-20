"use client";

import { useActionState } from "react";
import {
  aprobarAccion,
  rechazarAccion,
  type EstadoAprobacionUI,
} from "@/lib/acciones/aprobaciones";

export function BotonesDecision({
  id,
  puedeDecidir,
}: {
  id: string;
  puedeDecidir: boolean;
}) {
  const [estadoA, aprobarFn, pendienteA] = useActionState(
    aprobarAccion,
    {} as EstadoAprobacionUI,
  );
  const [estadoR, rechazarFn, pendienteR] = useActionState(
    rechazarAccion,
    {} as EstadoAprobacionUI,
  );
  const mensaje = estadoA.error ?? estadoR.error ?? estadoA.ok ?? estadoR.ok;
  const esError = Boolean(estadoA.error ?? estadoR.error);

  if (!puedeDecidir) {
    return (
      <p className="mt-4 text-xs uppercase tracking-[0.1em] text-apagado">
        Requiere autorización del dueño de la cuenta
      </p>
    );
  }

  return (
    <div className="mt-4">
      <div className="flex flex-wrap items-center gap-3">
        <form action={aprobarFn}>
          <input type="hidden" name="id" value={id} />
          <button
            type="submit"
            disabled={pendienteA || pendienteR}
            className="bg-tinta px-5 py-2.5 text-xs font-bold uppercase tracking-wide text-papel hover:bg-marca disabled:opacity-60"
          >
            {pendienteA ? "Ejecutando…" : "Aprobar y ejecutar"}
          </button>
        </form>
        <form action={rechazarFn}>
          <input type="hidden" name="id" value={id} />
          <button
            type="submit"
            disabled={pendienteA || pendienteR}
            className="border border-borde px-5 py-2.5 text-xs font-bold uppercase tracking-wide hover:border-tinta disabled:opacity-60"
          >
            {pendienteR ? "Rechazando…" : "Rechazar"}
          </button>
        </form>
      </div>
      {mensaje && (
        <p
          role="status"
          className={`mt-3 text-sm ${esError ? "text-marca-oscuro" : "text-apagado"}`}
        >
          {mensaje}
        </p>
      )}
    </div>
  );
}
