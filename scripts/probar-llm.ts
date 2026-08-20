import "dotenv/config";

/**
 * Prueba de conexión con el modelo, de punta a punta.
 *
 * No basta con que la llave sea válida: hay que comprobar que ESTE proveedor
 * devuelve JSON parseable para el clasificador y español correcto para el
 * redactor. Un proveedor puede autenticar bien y aun así ser inservible aquí.
 *
 *   pnpm llm:probar
 */

const RESET = "\x1b[0m";
const rojo = (s: string) => `\x1b[31m${s}${RESET}`;
const verde = (s: string) => `\x1b[32m${s}${RESET}`;
const gris = (s: string) => `\x1b[90m${s}${RESET}`;

let fallos = 0;

function paso(titulo: string) {
  process.stdout.write(`\n${titulo}\n`);
}
function ok(msg: string, detalle?: string) {
  console.log(`  ${verde("✓")} ${msg}${detalle ? gris("  " + detalle) : ""}`);
}
function mal(msg: string, pista?: string) {
  fallos++;
  console.log(`  ${rojo("✗")} ${msg}`);
  if (pista) console.log(`    ${gris("→ " + pista)}`);
}

async function main() {
  const base = process.env.LLM_BASE_URL?.replace(/\/$/, "");
  const modelo = process.env.LLM_MODELO;
  const llave = process.env.LLM_API_KEY;

  console.log("Probando conexión con el modelo");
  console.log(gris(`  proveedor: ${base}`));
  console.log(gris(`  modelo:    ${modelo}`));
  console.log(
    gris(`  llave:     ${llave ? llave.slice(0, 6) + "…" + llave.slice(-4) : "(sin definir)"}`),
  );

  if (!base || !modelo || !llave || llave.startsWith("cambiame")) {
    mal(
      "Falta configuración",
      "Define LLM_BASE_URL, LLM_MODELO y LLM_API_KEY en .env",
    );
    process.exit(1);
  }

  // Se importan después de validar el entorno para que el error sea legible.
  const { completar, extraerJson, ErrorLLM } = await import("../src/lib/agente/llm");

  // ---------------------------------------------------------------- 1
  paso("1. Autenticación y modelo");
  const t0 = Date.now();
  try {
    const { texto: r, uso } = await completar([{ role: "user", content: "Responde exactamente: listo" }], {
      maxTokens: 400,
      temperatura: 0,
    });
    ok(`el modelo responde`, `${Date.now() - t0}ms · "${r.trim().slice(0, 40)}" · ${uso.total} tokens`);
  } catch (e) {
    if (e instanceof ErrorLLM) {
      mal(e.message.slice(0, 160), e.pista);
    } else {
      mal(String(e));
    }
    console.log(rojo("\nSin conexión al modelo no tiene sentido seguir."));
    process.exit(1);
  }

  // ---------------------------------------------------------------- 2
  paso("2. Salida JSON para el clasificador");
  try {
    const t = Date.now();
    const { texto: salida, uso: usoJson } = await completar(
      [
        {
          role: "system",
          content:
            'Clasificas mensajes. Devuelve SOLO JSON: {"intencion":"PRECIO_STOCK"|"ENVIO"|"OTRO","confianza":0.0-1.0,"resumen":"una frase"}',
        },
        { role: "user", content: "¿cuánto cuestan los tenis negros?" },
      ],
      { json: true, temperatura: 0, maxTokens: 800 },
    );
    const obj = extraerJson<{ intencion?: string; confianza?: number }>(salida);
    if (typeof obj.intencion === "string" && typeof obj.confianza === "number") {
      ok(
        `JSON válido y con la forma esperada`,
        `${Date.now() - t}ms · ${obj.intencion} (${obj.confianza}) · ${usoJson.total} tokens`,
      );
      if (!/^\s*\{/.test(salida)) {
        console.log(
          gris("    nota: vino envuelto en texto; la extracción tolerante lo resolvió"),
        );
      }
    } else {
      mal(
        "El JSON no trae los campos esperados",
        `recibido: ${JSON.stringify(obj).slice(0, 120)}`,
      );
    }
  } catch (e) {
    mal(
      e instanceof Error ? e.message.slice(0, 160) : String(e),
      "Este modelo no sirve para clasificar. Prueba uno más capaz.",
    );
  }

  // ---------------------------------------------------------------- 3
  paso("3. Redacción en español mexicano");
  try {
    const t = Date.now();
    const { texto: r, uso: usoRed } = await completar(
      [
        {
          role: "system",
          content:
            "Eres el asistente de una tienda mexicana. Responde en español, máximo 2 frases. Sólo puedes afirmar lo que esté en DATOS. DATOS: Tenis Runner Negro, $1,299.00 MXN, 14 piezas disponibles.",
        },
        { role: "user", content: "¿tienen los tenis negros?" },
      ],
      { temperatura: 0.3, maxTokens: 2000 },
    );
    const texto = r.trim();
    const mencionaPrecio = /1,?299/.test(texto);
    ok(`redacta`, `${Date.now() - t}ms · ${usoRed.total} tokens`);
    console.log(gris(`    "${texto.slice(0, 130)}"`));
    if (mencionaPrecio) {
      console.log(gris("    usa el precio de los datos verificados"));
    } else {
      console.log(
        gris("    nota: no citó el precio; revisa la calidad del modelo elegido"),
      );
    }
  } catch (e) {
    mal(e instanceof Error ? e.message.slice(0, 160) : String(e));
  }

  // ---------------------------------------------------------------- 4
  paso("4. Guardrails (no dependen del modelo)");
  const { evaluarEntrada, respuestaViolaGuardrails } = await import(
    "../src/lib/agente/guardrails"
  );
  const casos: [string, "escalar" | "responder"][] = [
    ["quiero mi factura", "escalar"],
    ["no me llegó el paquete", "escalar"],
    ["¿tienen tenis negros?", "responder"],
  ];
  for (const [texto, esperado] of casos) {
    const r = evaluarEntrada(texto, null);
    if (r.accion === esperado) ok(`"${texto}" → ${r.accion}`);
    else mal(`"${texto}" → ${r.accion}, se esperaba ${esperado}`);
  }
  const violacion = respuestaViolaGuardrails("claro, te hago un descuento del 20%");
  if (violacion) ok("una promesa de descuento se bloquea");
  else mal("no se bloqueó una promesa de descuento");

  // ---------------------------------------------------------------- Cierre
  console.log("");
  if (fallos === 0) {
    console.log(verde("Todo listo. El agente puede contestar mensajes reales."));
  } else {
    console.log(rojo(`${fallos} problema(s). Revisa lo marcado arriba.`));
    process.exit(1);
  }
}

main().catch((e) => {
  console.error(rojo("Error inesperado: " + (e instanceof Error ? e.message : String(e))));
  process.exit(1);
});
