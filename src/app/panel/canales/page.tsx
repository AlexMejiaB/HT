import type { Metadata } from "next";
import { db } from "@/lib/db";
import { exigirPermiso } from "@/lib/permisos";
import { desconectarWhatsapp, desconectarInstagram } from "@/lib/acciones/canales";
import {
  FormularioWhatsapp,
  FormularioInstagram,
  FormularioPrueba,
} from "@/app/panel/canales/formularios";

export const metadata: Metadata = {
  title: "Canales",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

const urlWebhook = `${process.env.NEXT_PUBLIC_SITE_URL ?? ""}/api/webhooks/whatsapp`;

export default async function Canales() {
  const sesion = await exigirPermiso("configurar");

  const t = await db.tenant.findUniqueOrThrow({
    where: { id: sesion.tenantId },
    select: {
      waPhoneNumberId: true,
      waNumeroVisible: true,
      waTokenCifrado: true,
      igCuentaId: true,
      igTokenCifrado: true,
    },
  });

  const waConectado = Boolean(t.waPhoneNumberId && t.waTokenCifrado);
  const igConectado = Boolean(t.igCuentaId && t.igTokenCifrado);

  return (
    <>
      <h1 className="titular text-3xl">Canales</h1>
      <p className="mt-2 max-w-2xl text-sm text-apagado">
        Por dónde recibe y responde mensajes tu agente. Sin esto conectado, el agente no
        puede atender a nadie.
      </p>

      {/* ------------------------------------------------------- WhatsApp */}
      <section className="mt-10">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <h2 className="titular text-xl">WhatsApp</h2>
          <span
            className={`px-2 py-1 text-[0.65rem] uppercase tracking-[0.15em] ${
              waConectado ? "bg-marca text-papel" : "border border-borde text-apagado"
            }`}
          >
            {waConectado ? "Conectado" : "Sin conectar"}
          </span>
        </div>

        <div className="mt-5 grid gap-6 lg:grid-cols-[1.3fr_1fr]">
          <FormularioWhatsapp
            phoneNumberId={t.waPhoneNumberId}
            numeroVisible={t.waNumeroVisible}
            tieneToken={Boolean(t.waTokenCifrado)}
          />

          <div className="border-l border-borde pl-6 text-sm">
            <h3 className="text-xs font-bold uppercase tracking-[0.12em]">
              Antes de conectar
            </h3>
            <ol className="mt-3 space-y-2.5 text-apagado">
              <li>
                1. Crea una app en Meta for Developers y agrégale el producto WhatsApp.
              </li>
              <li>2. Registra y verifica tu número. No puede estar activo en la app normal de WhatsApp.</li>
              <li>
                3. En el webhook de la app, pega esta URL y suscríbete al campo{" "}
                <code className="bg-papel-tenue px-1">messages</code>:
              </li>
            </ol>
            <p className="mt-2 break-all border border-borde bg-papel-tenue p-2 font-mono text-xs">
              {urlWebhook || "Configura NEXT_PUBLIC_SITE_URL para ver la URL"}
            </p>
            <p className="mt-3 text-xs text-apagado">
              El token de verificación y la clave de la app son globales del sistema, no de
              tu cuenta: los administra Highticket.
            </p>
          </div>
        </div>

        {waConectado && (
          <div className="mt-6 border border-borde bg-papel p-6">
            <h3 className="titular text-lg">Probar la conexión</h3>
            <p className="mt-1 text-xs text-apagado">
              Unas credenciales pueden guardarse bien y aun así fallar por un token
              caducado. La única forma de saberlo es mandar un mensaje real.
            </p>
            <div className="mt-4">
              <FormularioPrueba />
            </div>
            <form action={desconectarWhatsapp} className="mt-6 border-t border-borde pt-4">
              <button
                type="submit"
                className="text-xs font-bold uppercase tracking-wide text-apagado hover:text-marca"
              >
                Desconectar WhatsApp
              </button>
            </form>
          </div>
        )}
      </section>

      {/* ------------------------------------------------------ Instagram */}
      <section className="mt-14">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <h2 className="titular text-xl">Instagram</h2>
          <span
            className={`px-2 py-1 text-[0.65rem] uppercase tracking-[0.15em] ${
              igConectado ? "bg-marca text-papel" : "border border-borde text-apagado"
            }`}
          >
            {igConectado ? "Conectado" : "Sin conectar"}
          </span>
        </div>
        <p className="mt-2 max-w-2xl text-sm text-apagado">
          Los mensajes directos de Instagram llegan por el mismo webhook y los atiende el
          mismo agente, con el mismo catálogo y las mismas reglas.
        </p>

        <div className="mt-5 max-w-2xl">
          <FormularioInstagram
            cuentaId={t.igCuentaId}
            tieneToken={Boolean(t.igTokenCifrado)}
          />
        </div>

        {igConectado && (
          <form action={desconectarInstagram} className="mt-4">
            <button
              type="submit"
              className="text-xs font-bold uppercase tracking-wide text-apagado hover:text-marca"
            >
              Desconectar Instagram
            </button>
          </form>
        )}
      </section>
    </>
  );
}
