"use client";

import { useActionState } from "react";
import {
  invitarUsuario,
  agregarContactoEquipo,
  type EstadoEquipo,
} from "@/lib/acciones/equipo";
import { Campo, Guardar, Aviso } from "@/components/panel/campos";

export function FormularioInvitar() {
  const [estado, accion] = useActionState(invitarUsuario, {} as EstadoEquipo);

  return (
    <form action={accion} className="space-y-4 border border-borde bg-papel p-6">
      <h2 className="titular text-lg">Dar acceso al panel</h2>
      <div className="grid gap-4 sm:grid-cols-2">
        <Campo etiqueta="Nombre" nombre="nombre" required maxLength={120} />
        <Campo etiqueta="Correo" nombre="email" tipo="email" required maxLength={200} />
      </div>
      <div>
        <label htmlFor="rol" className="block text-xs font-bold uppercase tracking-[0.12em]">
          Rol
        </label>
        <select
          id="rol"
          name="rol"
          defaultValue="AGENTE"
          className="mt-2 w-full border border-borde bg-papel px-4 py-2.5 text-sm"
        >
          <option value="AGENTE">Agente — atiende y revisa la cola</option>
          <option value="DUENO">Dueño — además configura y autoriza dinero</option>
        </select>
        <p className="mt-1 text-xs text-apagado">
          Sólo un dueño puede autorizar acciones irreversibles o que mueven dinero.
        </p>
      </div>

      <Aviso estado={estado} />
      {estado.passwordTemporal && (
        <p className="border-l border-marca bg-papel-tenue px-4 py-3 text-sm">
          Comparte esta contraseña por un canal seguro. No volverá a mostrarse:{" "}
          <code className="font-mono font-bold">{estado.passwordTemporal}</code>
        </p>
      )}
      <Guardar>Crear usuario</Guardar>
    </form>
  );
}

export function FormularioContacto() {
  const [estado, accion] = useActionState(agregarContactoEquipo, {} as EstadoEquipo);

  return (
    <form action={accion} className="space-y-4 border border-borde bg-papel p-6">
      <h2 className="titular text-lg">Avisos de escalamiento</h2>
      <p className="text-xs text-apagado">
        A quién se le manda un WhatsApp cuando el agente entrega un caso a una persona.
      </p>
      <div className="grid gap-4 sm:grid-cols-2">
        <Campo etiqueta="Nombre" nombre="nombre" required maxLength={120} />
        <Campo
          etiqueta="WhatsApp"
          nombre="telefono"
          required
          placeholder="5215512345678"
          ayuda="Con lada de país, sin espacios ni signos."
        />
      </div>
      <Aviso estado={estado} />
      <Guardar>Agregar contacto</Guardar>
    </form>
  );
}
