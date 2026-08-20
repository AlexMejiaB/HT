/**
 * Limitador por ventana fija, en memoria.
 *
 * Alcance: un proceso. Sirve para frenar fuerza bruta en el login y ráfagas
 * accidentales. Si el SaaS se despliega en varias instancias, esto debe
 * moverse a Redis o el límite se multiplica por el número de procesos.
 */
type Registro = { conteo: number; reinicioEn: number };

const registros = new Map<string, Registro>();

// Limpieza periódica para que el mapa no crezca sin límite.
const LIMPIEZA_MS = 5 * 60_000;
let ultimaLimpieza = Date.now();

function limpiar(ahora: number) {
  if (ahora - ultimaLimpieza < LIMPIEZA_MS) return;
  for (const [clave, r] of registros) {
    if (r.reinicioEn <= ahora) registros.delete(clave);
  }
  ultimaLimpieza = ahora;
}

export function permitir(
  clave: string,
  limite: number,
  ventanaMs: number,
): { ok: boolean; restantes: number; reintentarEnSeg: number } {
  const ahora = Date.now();
  limpiar(ahora);

  const actual = registros.get(clave);
  if (!actual || actual.reinicioEn <= ahora) {
    registros.set(clave, { conteo: 1, reinicioEn: ahora + ventanaMs });
    return { ok: true, restantes: limite - 1, reintentarEnSeg: 0 };
  }

  if (actual.conteo >= limite) {
    return {
      ok: false,
      restantes: 0,
      reintentarEnSeg: Math.ceil((actual.reinicioEn - ahora) / 1000),
    };
  }

  actual.conteo += 1;
  return { ok: true, restantes: limite - actual.conteo, reintentarEnSeg: 0 };
}

/**
 * IP del cliente. Detrás de un proxy inverso se confía en x-forwarded-for,
 * que sólo es fiable si el proxy lo reescribe.
 */
export function ipDe(request: Request): string {
  const reenviada = request.headers.get("x-forwarded-for");
  if (reenviada) return reenviada.split(",")[0].trim();
  return request.headers.get("x-real-ip") ?? "desconocida";
}
