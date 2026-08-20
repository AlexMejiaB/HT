import type { Metadata } from "next";
import { db } from "@/lib/db";
import { exigirPermiso } from "@/lib/permisos";
import { FormularioConfiguracion } from "@/app/panel/configuracion/formulario";

export const metadata: Metadata = {
  title: "Configuración",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function Configuracion() {
  const sesion = await exigirPermiso("configurar");

  const config = await db.tenant.findUniqueOrThrow({
    where: { id: sesion.tenantId },
    select: {
      tonoMarca: true,
      mensajeBienvenida: true,
      politicaEnvios: true,
      politicaCambios: true,
      politicaDevoluciones: true,
      horarios: true,
      umbralConfianza: true,
      llmModelo: true,
      llmTemperatura: true,
      llmRazonamiento: true,
      instruccionesExtra: true,
      limiteMensajesMes: true,
    },
  });

  return (
    <>
      <h1 className="titular text-3xl">Configuración</h1>
      <p className="mt-2 max-w-2xl text-sm text-apagado">
        Esto es lo único que el agente puede afirmar. Lo que no esté aquí, no lo sabe: lo
        dirá y pasará el caso a una persona.
      </p>
      <FormularioConfiguracion config={config} />
    </>
  );
}
