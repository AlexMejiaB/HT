"use client";

import { useActionState } from "react";
import { guardarConfiguracion, type EstadoAccion } from "@/lib/acciones/configuracion";
import { Campo, Area, Guardar, Aviso } from "@/components/panel/campos";

type Config = {
  tonoMarca: string;
  mensajeBienvenida: string;
  politicaEnvios: string | null;
  politicaCambios: string | null;
  politicaDevoluciones: string | null;
  horarios: string | null;
  umbralConfianza: number;
  llmModelo: string | null;
  llmTemperatura: number | null;
  llmRazonamiento: string | null;
  instruccionesExtra: string | null;
  limiteMensajesMes: number | null;
};

const MODELOS = [
  { id: "", nombre: "Usar el del sistema" },
  { id: "gemini-3.7-flash", nombre: "Gemini 3.7 Flash — equilibrado" },
  { id: "gemini-3.1-flash-lite", nombre: "Gemini 3.1 Flash Lite — más barato" },
  { id: "gemini-2.5-flash-lite", nombre: "Gemini 2.5 Flash Lite — el más barato" },
];

export function FormularioConfiguracion({ config }: { config: Config }) {
  const [estado, accion] = useActionState(guardarConfiguracion, {} as EstadoAccion);

  return (
    <form action={accion} className="mt-8 max-w-2xl space-y-6">
      <Area
        etiqueta="Tono de marca"
        nombre="tonoMarca"
        valor={config.tonoMarca}
        ayuda="Cómo debe sonar el agente. Es lo que más cambia la percepción del cliente."
        required
      />
      <Area
        etiqueta="Mensaje de bienvenida"
        nombre="mensajeBienvenida"
        valor={config.mensajeBienvenida}
        filas={2}
        required
      />
      <Area
        etiqueta="Política de envíos"
        nombre="politicaEnvios"
        valor={config.politicaEnvios}
        ayuda="El agente sólo puede citar lo que escribas aquí. Si falta, dirá que el equipo confirmará."
      />
      <Area etiqueta="Política de cambios" nombre="politicaCambios" valor={config.politicaCambios} />
      <Area
        etiqueta="Política de devoluciones"
        nombre="politicaDevoluciones"
        valor={config.politicaDevoluciones}
      />
      <Campo etiqueta="Horarios" nombre="horarios" valor={config.horarios} />
      <Campo
        etiqueta="Umbral de confianza"
        nombre="umbralConfianza"
        tipo="number"
        step="0.05"
        min="0.3"
        max="0.95"
        valor={config.umbralConfianza}
        ayuda="Por debajo de este valor el agente no responde: pasa el caso a una persona. Subirlo escala más y arriesga menos."
        required
      />
      <Area
        etiqueta="Indicaciones propias del negocio"
        nombre="instruccionesExtra"
        valor={config.instruccionesExtra}
        filas={4}
        ayuda="Reglas tuyas que se suman al prompt. No pueden saltarse los guardrails: esos se evalúan en código, fuera del alcance del texto."
        placeholder="Si preguntan por mayoreo, pide que dejen su correo. Nunca digas que somos distribuidor oficial."
      />

      <div className="border-t border-borde pt-6">
        <h2 className="titular text-lg">Modelo</h2>
        <p className="mt-1 text-xs text-apagado">
          Déjalo en blanco para usar la configuración del sistema.
        </p>

        <div className="mt-4 space-y-5">
          <div>
            <label
              htmlFor="llmModelo"
              className="block text-xs font-bold uppercase tracking-[0.12em]"
            >
              Modelo
            </label>
            <select
              id="llmModelo"
              name="llmModelo"
              defaultValue={config.llmModelo ?? ""}
              className="mt-2 w-full border border-borde bg-papel px-4 py-2.5 text-sm"
            >
              {MODELOS.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.nombre}
                </option>
              ))}
            </select>
          </div>

          <Campo
            etiqueta="Creatividad"
            nombre="llmTemperatura"
            tipo="number"
            step="0.1"
            min="0"
            max="1"
            valor={config.llmTemperatura}
            ayuda="0 = siempre igual y predecible. 1 = más variado y con más riesgo de salirse del guion. Vacío usa 0.3."
          />

          <div>
            <label
              htmlFor="llmRazonamiento"
              className="block text-xs font-bold uppercase tracking-[0.12em]"
            >
              Razonamiento
            </label>
            <select
              id="llmRazonamiento"
              name="llmRazonamiento"
              defaultValue={config.llmRazonamiento ?? ""}
              className="mt-2 w-full border border-borde bg-papel px-4 py-2.5 text-sm"
            >
              <option value="">Usar el del sistema</option>
              <option value="none">Ninguno — más rápido y barato</option>
              <option value="low">Bajo</option>
              <option value="medium">Medio</option>
              <option value="high">Alto — para casos difíciles</option>
            </select>
            <p className="mt-1 text-xs text-apagado">
              El modelo piensa antes de responder y esos tokens se cobran. Para responder
              dudas de catálogo no hace falta.
            </p>
          </div>

          <Campo
            etiqueta="Límite de mensajes al mes"
            nombre="limiteMensajesMes"
            tipo="number"
            min="1"
            valor={config.limiteMensajesMes}
            ayuda="Al alcanzarlo el agente entrega los casos a una persona en vez de seguir gastando. Vacío = sin tope."
          />
        </div>
      </div>

      <Aviso estado={estado} />
      <Guardar />
    </form>
  );
}
