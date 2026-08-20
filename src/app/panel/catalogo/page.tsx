import type { Metadata } from "next";
import { db } from "@/lib/db";
import { exigirPermiso } from "@/lib/permisos";
import { eliminarProducto } from "@/lib/acciones/configuracion";
import { FormularioProducto, FormularioImportar } from "@/app/panel/catalogo/formularios";

export const metadata: Metadata = {
  title: "Catálogo",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

const pesos = new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" });

export default async function Catalogo() {
  const sesion = await exigirPermiso("configurar");

  const productos = await db.producto.findMany({
    where: { tenantId: sesion.tenantId, activo: true },
    orderBy: { nombre: "asc" },
    select: {
      id: true,
      sku: true,
      nombre: true,
      precioCentavos: true,
      moneda: true,
      stock: true,
      fuente: true,
    },
  });

  return (
    <>
      <h1 className="titular text-3xl">Catálogo</h1>
      <p className="mt-2 max-w-2xl text-sm text-apagado">
        La fuente de la que el agente lee precios y existencias. Si un producto no está
        aquí, el agente no lo cotiza.
      </p>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <FormularioProducto />
        <FormularioImportar />
      </div>

      <h2 className="titular mt-12 text-xl">
        {productos.length} producto{productos.length === 1 ? "" : "s"}
      </h2>

      {productos.length === 0 ? (
        <p className="mt-4 text-sm text-apagado">
          Todavía no hay catálogo. Agrega uno arriba o importa tu CSV.
        </p>
      ) : (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[40rem] border-collapse text-left text-sm">
            <thead>
              <tr className="border-b-2 border-tinta">
                <th className="py-3 pr-4 font-extrabold uppercase tracking-wide">SKU</th>
                <th className="py-3 pr-4 font-extrabold uppercase tracking-wide">Nombre</th>
                <th className="py-3 pr-4 font-extrabold uppercase tracking-wide">Precio</th>
                <th className="py-3 pr-4 font-extrabold uppercase tracking-wide">Stock</th>
                <th className="py-3 pr-4 font-extrabold uppercase tracking-wide">Origen</th>
                <th className="py-3" />
              </tr>
            </thead>
            <tbody>
              {productos.map((p) => (
                <tr key={p.id} className="border-b border-borde">
                  <td className="py-3 pr-4 font-mono text-xs">{p.sku}</td>
                  <td className="py-3 pr-4 font-semibold">{p.nombre}</td>
                  <td className="py-3 pr-4 whitespace-nowrap tabular-nums">
                    {pesos.format(p.precioCentavos / 100)}
                  </td>
                  <td className="py-3 pr-4 tabular-nums">
                    {p.stock === 0 ? (
                      <span className="font-bold text-marca">Agotado</span>
                    ) : (
                      p.stock
                    )}
                  </td>
                  <td className="py-3 pr-4 text-xs text-apagado">{p.fuente}</td>
                  <td className="py-3 text-right">
                    <form action={eliminarProducto}>
                      <input type="hidden" name="id" value={p.id} />
                      <button
                        type="submit"
                        className="text-xs font-bold uppercase tracking-wide text-apagado hover:text-marca"
                      >
                        Quitar
                      </button>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
