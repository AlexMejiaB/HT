"use client";

import { useActionState } from "react";
import { guardarFaq, type EstadoAccion } from "@/lib/acciones/configuracion";
import { Campo, Area, Guardar, Aviso } from "@/components/panel/campos";

export function FormularioFaq() {
  const [estado, accion] = useActionState(guardarFaq, {} as EstadoAccion);

  return (
    <form action={accion} className="max-w-2xl space-y-4 border border-borde bg-papel p-6">
      <Campo
        etiqueta="Pregunta"
        nombre="pregunta"
        required
        maxLength={300}
        placeholder="¿Hacen envíos a todo México?"
      />
      <Area
        etiqueta="Respuesta"
        nombre="respuesta"
        required
        filas={3}
        placeholder="Sí, enviamos a todo el país. El envío es gratis arriba de $999 MXN."
      />
      <Aviso estado={estado} />
      <Guardar>Agregar</Guardar>
    </form>
  );
}
