"use client";

import { useActionState } from "react";
import {
  guardarLinea,
  asignarProductos,
  guardarEjemplo,
  type EstadoLinea,
} from "@/lib/acciones/lineas";
import { Campo, Area, Guardar, Aviso } from "@/components/panel/campos";

type OpcionLinea = { id: string; nombre: string };

export function FormularioLinea() {
  const [estado, accion] = useActionState(guardarLinea, {} as EstadoLinea);

  return (
    <form action={accion} className="space-y-4 border border-borde bg-papel p-6">
      <h2 className="titular text-lg">Nueva línea o marca</h2>
      <p className="text-xs text-apagado">
        Si el nombre ya existe, se actualiza en lugar de duplicarse.
      </p>
      <Campo etiqueta="Nombre" nombre="nombre" required maxLength={120} placeholder="Deportivo" />
      <Area
        etiqueta="Contexto de esta línea"
        nombre="contexto"
        required
        filas={5}
        ayuda="Lo que el agente debe saber SÓLO cuando pregunten por productos de esta línea: garantías, tallas, cuidados, tono propio."
        placeholder="Los tenis deportivos tienen garantía de 6 meses en suela. Las tallas corren medio número chicas."
      />
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="porDefecto" value="true" className="size-4" />
        Usar como línea por defecto cuando el producto no tenga una asignada
      </label>
      <Aviso estado={estado} />
      <Guardar>Guardar línea</Guardar>
    </form>
  );
}

export function FormularioAsignar({ lineas }: { lineas: OpcionLinea[] }) {
  const [estado, accion] = useActionState(asignarProductos, {} as EstadoLinea);

  if (lineas.length === 0) return null;

  return (
    <form action={accion} className="space-y-4 border border-borde bg-papel p-6">
      <h2 className="titular text-lg">Asignar productos</h2>
      <p className="text-xs text-apagado">
        El agente elige el contexto según la línea del producto por el que preguntan.
      </p>
      <div>
        <label htmlFor="lineaId" className="block text-xs font-bold uppercase tracking-[0.12em]">
          Línea
        </label>
        <select
          id="lineaId"
          name="lineaId"
          className="mt-2 w-full border border-borde bg-papel px-4 py-2.5 text-sm"
        >
          {lineas.map((l) => (
            <option key={l.id} value={l.id}>
              {l.nombre}
            </option>
          ))}
        </select>
      </div>
      <Area
        etiqueta="SKUs"
        nombre="skus"
        required
        filas={3}
        ayuda="Separados por coma, espacio o salto de línea."
        placeholder="TEN-001, TEN-002"
      />
      <Aviso estado={estado} />
      <Guardar>Asignar</Guardar>
    </form>
  );
}

export function FormularioEjemplo({ lineas }: { lineas: OpcionLinea[] }) {
  const [estado, accion] = useActionState(guardarEjemplo, {} as EstadoLinea);

  return (
    <form action={accion} className="space-y-4 border border-borde bg-papel p-6">
      <h2 className="titular text-lg">Ejemplo de respuesta</h2>
      <p className="text-xs text-apagado">
        Mostrarle una respuesta buena enseña el estilo mejor que describirlo con adjetivos.
      </p>
      <Campo etiqueta="Pregunta del cliente" nombre="pregunta" required maxLength={300} />
      <Area etiqueta="Cómo debería responder" nombre="respuesta" required filas={3} />
      <div>
        <label htmlFor="lineaId" className="block text-xs font-bold uppercase tracking-[0.12em]">
          Aplica a
        </label>
        <select
          id="lineaId"
          name="lineaId"
          className="mt-2 w-full border border-borde bg-papel px-4 py-2.5 text-sm"
        >
          <option value="">Todo el negocio</option>
          {lineas.map((l) => (
            <option key={l.id} value={l.id}>
              Sólo {l.nombre}
            </option>
          ))}
        </select>
      </div>
      <Aviso estado={estado} />
      <Guardar>Agregar ejemplo</Guardar>
    </form>
  );
}
