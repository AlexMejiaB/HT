import type { Metadata } from "next";
import { redirect } from "next/navigation";
import Link from "next/link";
import { db } from "@/lib/db";
import { leerSesion } from "@/lib/sesion";
import { puede } from "@/lib/permisos";
import { BotonesDecision } from "@/app/panel/aprobaciones/acciones-ui";
import { vencerPendientes } from "@/lib/aprobaciones/motor";

export const metadata: Metadata = {
  title: "Aprobaciones",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

const ETIQUETA_NIVEL: Record<string, string> = {
  AUTOMATICO: "Automática",
  REVISION: "Revisión",
  BLOQUEO: "Requiere autorización",
};

const ETIQUETA_ESTADO: Record<string, string> = {
  PENDIENTE: "Pendiente",
  APROBADA: "Aprobada",
  RECHAZADA: "Rechazada",
  EJECUTADA: "Ejecutada",
  FALLIDA: "Falló",
  ESCALADA: "Escalada por plazo",
};

export default async function Aprobaciones() {
  const sesion = await leerSesion();
  if (!sesion) redirect("/entrar");

  // Al abrir la cola se vencen las solicitudes de revisión caducadas. Vencer
  // significa ESCALAR, nunca aprobar sola.
  await vencerPendientes();

  const [pendientes, historial] = await Promise.all([
    db.aprobacion.findMany({
      where: { tenantId: sesion.tenantId, estado: "PENDIENTE" },
      orderBy: [{ nivel: "desc" }, { solicitadaEn: "asc" }],
      select: {
        id: true,
        accion: true,
        nivel: true,
        contexto: true,
        solicitadaEn: true,
        venceEn: true,
        conversacionId: true,
      },
    }),
    db.aprobacion.findMany({
      where: { tenantId: sesion.tenantId, estado: { not: "PENDIENTE" } },
      orderBy: { solicitadaEn: "desc" },
      take: 25,
      select: {
        id: true,
        accion: true,
        nivel: true,
        estado: true,
        contexto: true,
        resueltaPor: true,
        resueltaEn: true,
        comentario: true,
        error: true,
      },
    }),
  ]);

  return (
    <>
      <h1 className="titular text-3xl">Aprobaciones</h1>
      <p className="mt-2 max-w-2xl text-sm text-apagado">
        Acciones que el agente quiere ejecutar y necesitan una persona. Lo irreversible o
        que mueve dinero no ocurre hasta que alguien lo autoriza: no hay plazo que lo
        apruebe solo.
      </p>

      <h2 className="titular mt-10 text-xl">
        {pendientes.length} pendiente{pendientes.length === 1 ? "" : "s"}
      </h2>

      {pendientes.length === 0 ? (
        <p className="mt-4 text-sm text-apagado">Nada esperando decisión.</p>
      ) : (
        <ul className="mt-4 space-y-4">
          {pendientes.map((a) => {
            const bloqueo = a.nivel === "BLOQUEO";
            const puedeDecidir = puede(
              sesion.rol,
              bloqueo ? "aprobar_bloqueo" : "aprobar_revision",
            );
            return (
              <li
                key={a.id}
                className={`border-l-2 bg-papel-tenue p-6 ${bloqueo ? "border-marca" : "border-borde-claro"}`}
              >
                <div className="flex flex-wrap items-baseline justify-between gap-3">
                  <p className="font-semibold">{a.accion.replace(/_/g, " ")}</p>
                  <span
                    className={`px-2 py-0.5 text-[0.65rem] font-bold uppercase tracking-[0.1em] ${
                      bloqueo ? "bg-marca text-papel" : "border border-borde text-apagado"
                    }`}
                  >
                    {ETIQUETA_NIVEL[a.nivel]}
                  </span>
                </div>

                <pre className="mt-3 whitespace-pre-wrap font-sans text-sm text-tinta-suave">
                  {a.contexto}
                </pre>

                <p className="mt-3 text-xs text-apagado">
                  Solicitada {a.solicitadaEn.toLocaleString("es-MX")}
                  {a.venceEn && ` · Vence ${a.venceEn.toLocaleString("es-MX")} (escala, no se aprueba sola)`}
                  {!a.venceEn && bloqueo && " · Sin plazo: espera indefinidamente"}
                </p>

                {a.conversacionId && (
                  <Link
                    href={`/panel/conversaciones/${a.conversacionId}`}
                    className="mt-2 inline-block text-xs font-bold uppercase tracking-wide hover:text-marca"
                  >
                    Ver conversación
                  </Link>
                )}

                <BotonesDecision id={a.id} puedeDecidir={puedeDecidir} />
              </li>
            );
          })}
        </ul>
      )}

      <h2 className="titular mt-14 text-xl">Historial</h2>
      {historial.length === 0 ? (
        <p className="mt-4 text-sm text-apagado">Todavía no hay decisiones registradas.</p>
      ) : (
        <ul className="mt-4 space-y-2">
          {historial.map((a) => (
            <li key={a.id} className="border border-borde bg-papel px-5 py-3 text-sm">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <span className="font-semibold">{a.accion.replace(/_/g, " ")}</span>
                <span className="text-xs uppercase tracking-[0.1em] text-apagado">
                  {ETIQUETA_ESTADO[a.estado] ?? a.estado}
                </span>
              </div>
              <p className="mt-1 text-xs text-apagado">
                {a.resueltaPor ? `Por ${a.resueltaPor}` : "Por el sistema"}
                {a.resueltaEn && ` · ${a.resueltaEn.toLocaleString("es-MX")}`}
                {a.comentario && ` · "${a.comentario}"`}
              </p>
              {a.error && <p className="mt-1 text-xs text-marca-claro">{a.error}</p>}
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
