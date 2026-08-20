import { createCipheriv, createDecipheriv, randomBytes, timingSafeEqual, createHmac } from "node:crypto";
import { env } from "@/lib/env";

const ALGORITMO = "aes-256-gcm";

/**
 * Los tokens de WhatsApp de cada tenant son credenciales de terceros: si la
 * base se filtra, no deben ser legibles. AES-256-GCM con IV por registro.
 */
export function cifrar(textoPlano: string): string {
  const clave = Buffer.from(env().CLAVE_CIFRADO, "base64");
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGORITMO, clave, iv);
  const cifrado = Buffer.concat([cipher.update(textoPlano, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv.toString("base64"), tag.toString("base64"), cifrado.toString("base64")].join(".");
}

export function descifrar(valor: string): string {
  const [ivB64, tagB64, datosB64] = valor.split(".");
  if (!ivB64 || !tagB64 || !datosB64) throw new Error("Formato de cifrado inválido");
  const clave = Buffer.from(env().CLAVE_CIFRADO, "base64");
  const decipher = createDecipheriv(ALGORITMO, clave, Buffer.from(ivB64, "base64"));
  decipher.setAuthTag(Buffer.from(tagB64, "base64"));
  return Buffer.concat([
    decipher.update(Buffer.from(datosB64, "base64")),
    decipher.final(),
  ]).toString("utf8");
}

/**
 * Verifica la firma X-Hub-Signature-256 de Meta sobre el cuerpo crudo.
 * Sin esto, cualquiera que conozca la URL puede inyectar conversaciones.
 */
export function firmaMetaValida(cuerpoCrudo: string, cabecera: string | null): boolean {
  if (!cabecera?.startsWith("sha256=")) return false;
  const esperada = createHmac("sha256", env().META_APP_SECRET)
    .update(cuerpoCrudo, "utf8")
    .digest("hex");
  const recibida = cabecera.slice("sha256=".length);
  // Comparación en tiempo constante: una comparación normal filtra la firma
  // byte a byte por diferencia de tiempo.
  const a = Buffer.from(esperada, "hex");
  const b = Buffer.from(recibida, "hex");
  return a.length === b.length && timingSafeEqual(a, b);
}
