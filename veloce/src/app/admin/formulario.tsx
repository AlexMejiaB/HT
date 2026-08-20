"use client";

import { useActionState } from "react";
import { crearTenant, type EstadoAdmin } from "@/lib/acciones/admin";
import { Campo, Guardar, Aviso } from "@/components/panel/campos";

export function FormularioTenant() {
  const [estado, accion] = useActionState(crearTenant, {} as EstadoAdmin);

  return (
    <form action={accion} className="max-w-2xl space-y-4 border border-borde bg-papel p-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <Campo etiqueta="Nombre del negocio" nombre="nombre" required maxLength={160} />
        <Campo
          etiqueta="Identificador"
          nombre="slug"
          required
          maxLength={60}
          placeholder="tienda-ejemplo"
          ayuda="Minúsculas, números y guiones."
        />
      </div>
      <div>
        <label htmlFor="plan" className="block text-xs font-bold uppercase tracking-[0.12em]">
          Plan
        </label>
        <select
          id="plan"
          name="plan"
          defaultValue="RESPONDE"
          className="mt-2 w-full border border-borde bg-papel px-4 py-2.5 text-sm"
        >
          <option value="RESPONDE">Responde</option>
          <option value="OPERADOR">Operador</option>
          <option value="AUTOPILOT">Autopilot</option>
        </select>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Campo etiqueta="Nombre del dueño" nombre="nombreDueno" required maxLength={120} />
        <Campo etiqueta="Correo del dueño" nombre="emailDueno" tipo="email" required />
      </div>

      <Aviso estado={estado} />
      {estado.credenciales && (
        <p className="border-l-2 border-tinta bg-papel-tenue px-4 py-3 text-sm">
          Credenciales iniciales, no vuelven a mostrarse:{" "}
          <code className="font-mono font-bold">{estado.credenciales}</code>
        </p>
      )}
      <Guardar>Crear negocio</Guardar>
    </form>
  );
}
