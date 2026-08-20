import type { Metadata } from "next";
import { db } from "@/lib/db";
import { exigirCapacidad } from "@/lib/permisos";
import { FormularioTienda, BotonSincronizar } from "@/app/panel/tienda/formulario";

export const metadata: Metadata = {
  title: "Tienda",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function Tienda() {
  const sesion = await exigirCapacidad("configurar", "conector_tienda");

  const t = await db.tenant.findUniqueOrThrow({
    where: { id: sesion.tenantId },
    select: {
      tiendaTipo: true,
      tiendaDominio: true,
      tiendaTokenCifrado: true,
    },
  });

  const conectada = t.tiendaTipo !== "NINGUNA" && Boolean(t.tiendaTokenCifrado);

  return (
    <>
      <h1 className="titular text-3xl">Tienda conectada</h1>
      <p className="mt-2 max-w-2xl text-sm text-apagado">
        Conectar tu tienda permite al agente responder el estatus de un pedido y mantener
        precios y existencias al día sin que los cargues a mano.
      </p>

      <div className="mt-8">
        <FormularioTienda
          tipoActual={t.tiendaTipo}
          dominioActual={t.tiendaDominio}
          tieneCredenciales={Boolean(t.tiendaTokenCifrado)}
        />
      </div>

      {conectada && (
        <section className="mt-12 max-w-2xl">
          <h2 className="titular text-xl">Sincronización</h2>
          <p className="mt-2 text-sm text-apagado">
            Trae el catálogo a tu base. El agente lee de la base, no de la tienda en cada
            mensaje, para que una caída de la plataforma no lo deje mudo.
          </p>
          <BotonSincronizar />
        </section>
      )}
    </>
  );
}
