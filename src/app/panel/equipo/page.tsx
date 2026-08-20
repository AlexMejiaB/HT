import type { Metadata } from "next";
import { db } from "@/lib/db";
import { exigirPermiso, ETIQUETA_ROL } from "@/lib/permisos";
import { cambiarEstadoUsuario, quitarContactoEquipo } from "@/lib/acciones/equipo";
import { FormularioInvitar, FormularioContacto } from "@/app/panel/equipo/formularios";

export const metadata: Metadata = {
  title: "Equipo",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function Equipo() {
  const sesion = await exigirPermiso("equipo");

  const [usuarios, contactos] = await Promise.all([
    db.usuario.findMany({
      where: { tenantId: sesion.tenantId },
      orderBy: { creadoEn: "asc" },
      select: {
        id: true,
        nombre: true,
        email: true,
        rol: true,
        activo: true,
        ultimoAcceso: true,
      },
    }),
    db.contactoEquipo.findMany({
      where: { tenantId: sesion.tenantId },
      orderBy: { nombre: "asc" },
      select: { id: true, nombre: true, telefono: true },
    }),
  ]);

  return (
    <>
      <h1 className="titular text-3xl">Equipo</h1>
      <p className="mt-2 max-w-2xl text-sm text-apagado">
        Quién entra al panel y quién recibe los avisos cuando el agente escala.
      </p>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <FormularioInvitar />
        <FormularioContacto />
      </div>

      <h2 className="titular mt-12 text-xl">Accesos al panel</h2>
      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[42rem] border-collapse text-left text-sm">
          <thead>
            <tr className="border-b-2 border-tinta">
              <th className="py-3 pr-4 font-extrabold uppercase tracking-wide">Nombre</th>
              <th className="py-3 pr-4 font-extrabold uppercase tracking-wide">Correo</th>
              <th className="py-3 pr-4 font-extrabold uppercase tracking-wide">Rol</th>
              <th className="py-3 pr-4 font-extrabold uppercase tracking-wide">Último acceso</th>
              <th className="py-3" />
            </tr>
          </thead>
          <tbody>
            {usuarios.map((u) => (
              <tr key={u.id} className="border-b border-borde">
                <td className="py-3 pr-4 font-semibold">
                  {u.nombre}
                  {u.id === sesion.usuarioId && (
                    <span className="ml-2 text-xs text-apagado">(tú)</span>
                  )}
                </td>
                <td className="py-3 pr-4 text-apagado">{u.email}</td>
                <td className="py-3 pr-4">{ETIQUETA_ROL[u.rol] ?? u.rol}</td>
                <td className="py-3 pr-4 text-apagado">
                  {u.ultimoAcceso ? u.ultimoAcceso.toLocaleString("es-MX") : "Nunca"}
                </td>
                <td className="py-3 text-right">
                  {u.id !== sesion.usuarioId && (
                    <form action={cambiarEstadoUsuario}>
                      <input type="hidden" name="id" value={u.id} />
                      <input type="hidden" name="activar" value={u.activo ? "0" : "1"} />
                      <button
                        type="submit"
                        className="text-xs font-bold uppercase tracking-wide text-apagado hover:text-marca"
                      >
                        {u.activo ? "Desactivar" : "Reactivar"}
                      </button>
                    </form>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2 className="titular mt-12 text-xl">Contactos de escalamiento</h2>
      {contactos.length === 0 ? (
        <p className="mt-4 max-w-2xl border-l border-marca bg-marca-tenue p-4 text-sm text-marca-claro">
          No hay contactos: cuando el agente escale un caso, nadie recibirá aviso. El caso
          quedará visible en el panel, pero sin notificación.
        </p>
      ) : (
        <ul className="mt-4 space-y-2">
          {contactos.map((c) => (
            <li
              key={c.id}
              className="flex items-center justify-between border border-borde bg-papel px-5 py-3 text-sm"
            >
              <span>
                <span className="font-semibold">{c.nombre}</span>{" "}
                <span className="text-apagado">· {c.telefono}</span>
              </span>
              <form action={quitarContactoEquipo}>
                <input type="hidden" name="id" value={c.id} />
                <button
                  type="submit"
                  className="text-xs font-bold uppercase tracking-wide text-apagado hover:text-marca"
                >
                  Quitar
                </button>
              </form>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
