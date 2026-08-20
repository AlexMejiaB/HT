"use client";

import { useActionState } from "react";
import {
  guardarProducto,
  importarCatalogo,
  type EstadoAccion,
} from "@/lib/acciones/configuracion";
import { Campo, Area, Guardar, Aviso } from "@/components/panel/campos";

export function FormularioProducto() {
  const [estado, accion] = useActionState(guardarProducto, {} as EstadoAccion);

  return (
    <form action={accion} className="space-y-4 border border-borde bg-papel p-6">
      <h2 className="titular text-lg">Agregar o actualizar</h2>
      <p className="text-xs text-apagado">
        Si el SKU ya existe, se actualiza en lugar de duplicarse.
      </p>
      <div className="grid gap-4 sm:grid-cols-2">
        <Campo etiqueta="SKU" nombre="sku" required maxLength={60} />
        <Campo etiqueta="Nombre" nombre="nombre" required maxLength={200} />
        <Campo etiqueta="Precio (MXN)" nombre="precio" tipo="number" step="0.01" min="0" required />
        <Campo etiqueta="Stock" nombre="stock" tipo="number" min="0" defaultValue={0} required />
      </div>
      <Area etiqueta="Descripción" nombre="descripcion" filas={2} />
      <Aviso estado={estado} />
      <Guardar>Guardar producto</Guardar>
    </form>
  );
}

export function FormularioImportar() {
  const [estado, accion] = useActionState(importarCatalogo, {} as EstadoAccion);

  return (
    <form action={accion} className="space-y-4 border border-borde bg-papel p-6">
      <h2 className="titular text-lg">Importar CSV</h2>
      <p className="text-xs text-apagado">
        Pega el contenido de tu hoja de cálculo. Encabezado obligatorio:{" "}
        <code className="bg-papel-tenue px-1">sku,nombre,precio</code> — opcionales{" "}
        <code className="bg-papel-tenue px-1">stock,descripcion</code>.
      </p>
      <Area
        etiqueta="Contenido CSV"
        nombre="csv"
        filas={7}
        required
        placeholder={"sku,nombre,precio,stock\nTEN-001,Tenis Runner Negro,1299,14"}
      />
      <Aviso estado={estado} />
      <Guardar>Importar</Guardar>
    </form>
  );
}
