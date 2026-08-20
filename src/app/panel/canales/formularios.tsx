"use client";

import { useActionState } from "react";
import {
  guardarWhatsapp,
  guardarInstagram,
  probarWhatsapp,
  type EstadoCanal,
} from "@/lib/acciones/canales";
import { Campo, Guardar, Aviso } from "@/components/panel/campos";

export function FormularioWhatsapp({
  phoneNumberId,
  numeroVisible,
  tieneToken,
}: {
  phoneNumberId: string | null;
  numeroVisible: string | null;
  tieneToken: boolean;
}) {
  const [estado, accion] = useActionState(guardarWhatsapp, {} as EstadoCanal);

  return (
    <form action={accion} className="space-y-5 border border-borde bg-papel p-6">
      <Campo
        etiqueta="Phone Number ID"
        nombre="waPhoneNumberId"
        valor={phoneNumberId}
        required
        inputMode="numeric"
        placeholder="123456789012345"
        ayuda="El id numérico que te da Meta, NO tu número de teléfono. Está en WhatsApp → Configuración de la API."
      />
      <Campo
        etiqueta="Número visible"
        nombre="waNumeroVisible"
        valor={numeroVisible}
        placeholder="+52 444 558 7796"
        ayuda="Sólo para que lo reconozcas en el panel. No se usa para enviar."
      />
      <Campo
        etiqueta="Token de acceso"
        nombre="token"
        tipo="password"
        autoComplete="off"
        ayuda={
          tieneToken
            ? "Ya hay un token guardado. Deja el campo vacío para conservarlo."
            : "Token permanente de un usuario del sistema. Los temporales caducan en 24 horas."
        }
      />
      <Aviso estado={estado} />
      <Guardar>Guardar conexión</Guardar>
    </form>
  );
}

export function FormularioInstagram({
  cuentaId,
  tieneToken,
}: {
  cuentaId: string | null;
  tieneToken: boolean;
}) {
  const [estado, accion] = useActionState(guardarInstagram, {} as EstadoCanal);

  return (
    <form action={accion} className="space-y-5 border border-borde bg-papel p-6">
      <Campo
        etiqueta="Id de la cuenta"
        nombre="igCuentaId"
        valor={cuentaId}
        required
        inputMode="numeric"
        placeholder="17841400000000000"
        ayuda="El id de tu cuenta profesional de Instagram vinculada a la página de Facebook."
      />
      <Campo
        etiqueta="Token de acceso"
        nombre="token"
        tipo="password"
        autoComplete="off"
        ayuda={
          tieneToken
            ? "Ya hay un token guardado. Deja el campo vacío para conservarlo."
            : "Token con permisos de mensajería de Instagram."
        }
      />
      <Aviso estado={estado} />
      <Guardar>Guardar conexión</Guardar>
    </form>
  );
}

export function FormularioPrueba() {
  const [estado, accion] = useActionState(probarWhatsapp, {} as EstadoCanal);

  return (
    <form action={accion} className="max-w-md space-y-4">
      <Campo
        etiqueta="Enviar prueba a"
        nombre="telefono"
        required
        inputMode="numeric"
        placeholder="5214441234567"
        ayuda="Con lada de país y sólo dígitos. Te llegará un mensaje del número conectado."
      />
      <Aviso estado={estado} />
      <Guardar>Enviar mensaje de prueba</Guardar>
    </form>
  );
}
