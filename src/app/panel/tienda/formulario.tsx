"use client";

import { useActionState, useState } from "react";
import {
  guardarTienda,
  sincronizarDesdeTienda,
  type EstadoAccion,
} from "@/lib/acciones/configuracion";
import { Campo, Guardar, Aviso } from "@/components/panel/campos";

type Tipo = "NINGUNA" | "SHOPIFY" | "WOOCOMMERCE" | "TIENDANUBE";

const AYUDA: Record<Tipo, { dominio: string; token: string; secreto?: string }> = {
  NINGUNA: { dominio: "", token: "" },
  SHOPIFY: {
    dominio: "mi-tienda.myshopify.com",
    token: "Token de app privada con permisos read_products y read_orders",
  },
  WOOCOMMERCE: {
    dominio: "mitienda.mx",
    token: "Consumer key (ck_…)",
    secreto: "Consumer secret (cs_…)",
  },
  TIENDANUBE: {
    dominio: "Id numérico de la tienda, no la URL",
    token: "Access token de la app",
  },
};

export function FormularioTienda({
  tipoActual,
  dominioActual,
  tieneCredenciales,
}: {
  tipoActual: Tipo;
  dominioActual: string | null;
  tieneCredenciales: boolean;
}) {
  const [estado, accion] = useActionState(guardarTienda, {} as EstadoAccion);
  const [tipo, setTipo] = useState<Tipo>(tipoActual);
  const ayuda = AYUDA[tipo];

  return (
    <form action={accion} className="max-w-2xl space-y-5 border border-borde bg-papel p-6">
      <div>
        <label
          htmlFor="tiendaTipo"
          className="block text-xs font-bold uppercase tracking-[0.12em]"
        >
          Plataforma
        </label>
        <select
          id="tiendaTipo"
          name="tiendaTipo"
          defaultValue={tipoActual}
          onChange={(e) => setTipo(e.target.value as Tipo)}
          className="mt-2 w-full border border-borde bg-papel px-4 py-2.5 text-sm"
        >
          <option value="NINGUNA">Sin conectar</option>
          <option value="SHOPIFY">Shopify</option>
          <option value="WOOCOMMERCE">WooCommerce</option>
          <option value="TIENDANUBE">Tiendanube</option>
        </select>
      </div>

      {tipo !== "NINGUNA" && (
        <>
          <Campo
            etiqueta="Dominio o id"
            nombre="tiendaDominio"
            valor={dominioActual}
            ayuda={ayuda.dominio}
            required
          />
          <Campo
            etiqueta={ayuda.secreto ? "Consumer key" : "Token de acceso"}
            nombre="token"
            tipo="password"
            autoComplete="off"
            ayuda={
              tieneCredenciales
                ? "Ya hay credenciales guardadas. Deja el campo vacío para conservarlas."
                : ayuda.token
            }
          />
          {ayuda.secreto && (
            <Campo
              etiqueta="Consumer secret"
              nombre="secreto"
              tipo="password"
              autoComplete="off"
              ayuda={ayuda.secreto}
            />
          )}
          <p className="border-l-2 border-borde pl-4 text-xs text-apagado">
            Sólo se piden permisos de <strong>lectura</strong>. El agente consulta catálogo,
            inventario y estatus de pedido; nunca modifica, cancela ni reembolsa.
          </p>
        </>
      )}

      <Aviso estado={estado} />
      <Guardar>Guardar conexión</Guardar>
    </form>
  );
}

export function BotonSincronizar() {
  const [estado, accion] = useActionState(sincronizarDesdeTienda, {} as EstadoAccion);
  return (
    <form action={accion} className="mt-6 space-y-4">
      <Aviso estado={estado} />
      <Guardar>Sincronizar catálogo ahora</Guardar>
    </form>
  );
}
