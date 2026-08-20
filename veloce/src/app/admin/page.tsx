import type { Metadata } from "next";
import Link from "next/link";
import { db } from "@/lib/db";
import { exigirPermiso } from "@/lib/permisos";
import { cambiarEstadoTenant } from "@/lib/acciones/admin";
import { FormularioTenant } from "@/app/admin/formulario";
import { Logotipo } from "@/components/marca";
import { salir } from "@/lib/acciones/auth";

export const metadata: Metadata = {
  title: "Administración",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function Admin() {
  const sesion = await exigirPermiso("admin");

  const tenants = await db.tenant.findMany({
    orderBy: { creadoEn: "desc" },
    select: {
      id: true,
      nombre: true,
      slug: true,
      plan: true,
      activo: true,
      creadoEn: true,
      waPhoneNumberId: true,
      tiendaTipo: true,
      _count: { select: { conversaciones: true, usuarios: true } },
    },
  });

  return (
    <div className="min-h-screen bg-papel-tenue">
      <header className="border-b border-borde bg-papel">
        <div className="mx-auto flex max-w-6xl items-center gap-6 px-5 py-4">
          <Logotipo />
          <span className="text-xs font-bold uppercase tracking-[0.2em] text-marca">
            Administración
          </span>
          <Link href="/panel" className="text-sm font-semibold hover:text-marca">
            Ir al panel
          </Link>
          <form action={salir} className="ml-auto">
            <span className="mr-4 text-sm text-apagado">{sesion.nombre}</span>
            <button type="submit" className="text-sm font-semibold hover:text-marca">
              Salir
            </button>
          </form>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-5 py-10">
        <h1 className="titular text-3xl">Negocios</h1>
        <p className="mt-2 max-w-2xl text-sm text-apagado">
          Alta de clientes nuevos. Cada negocio queda aislado: sus conversaciones y su
          catálogo no son visibles desde otra cuenta.
        </p>

        <div className="mt-8">
          <FormularioTenant />
        </div>

        <h2 className="titular mt-12 text-xl">
          {tenants.length} negocio{tenants.length === 1 ? "" : "s"}
        </h2>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[52rem] border-collapse text-left text-sm">
            <thead>
              <tr className="border-b-2 border-tinta">
                {["Negocio", "Plan", "WhatsApp", "Tienda", "Conversaciones", "Usuarios", ""].map(
                  (h) => (
                    <th key={h} className="py-3 pr-4 font-extrabold uppercase tracking-wide">
                      {h}
                    </th>
                  ),
                )}
              </tr>
            </thead>
            <tbody>
              {tenants.map((t) => (
                <tr key={t.id} className="border-b border-borde">
                  <td className="py-3 pr-4">
                    <span className="font-semibold">{t.nombre}</span>
                    <span className="block text-xs text-apagado">{t.slug}</span>
                  </td>
                  <td className="py-3 pr-4">{t.plan}</td>
                  <td className="py-3 pr-4 text-apagado">
                    {t.waPhoneNumberId ? "Conectado" : "—"}
                  </td>
                  <td className="py-3 pr-4 text-apagado">
                    {t.tiendaTipo === "NINGUNA" ? "—" : t.tiendaTipo}
                  </td>
                  <td className="py-3 pr-4 tabular-nums">{t._count.conversaciones}</td>
                  <td className="py-3 pr-4 tabular-nums">{t._count.usuarios}</td>
                  <td className="py-3 text-right">
                    <form action={cambiarEstadoTenant}>
                      <input type="hidden" name="id" value={t.id} />
                      <input type="hidden" name="activar" value={t.activo ? "0" : "1"} />
                      <button
                        type="submit"
                        className="text-xs font-bold uppercase tracking-wide text-apagado hover:text-marca"
                      >
                        {t.activo ? "Suspender" : "Reactivar"}
                      </button>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  );
}
