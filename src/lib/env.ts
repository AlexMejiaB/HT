import { z } from "zod";

/**
 * Validación de entorno en el arranque del servidor. Preferimos fallar al
 * iniciar que descubrir un secreto ausente a mitad de una conversación real.
 */
const esquema = z.object({
  DATABASE_URL: z.string().min(1, "Falta DATABASE_URL"),

  // Clave de 32 bytes en base64 para cifrar tokens de WhatsApp en reposo.
  CLAVE_CIFRADO: z
    .string()
    .refine((v) => Buffer.from(v, "base64").length === 32, {
      message: "CLAVE_CIFRADO debe ser 32 bytes en base64",
    }),

  // Secreto para firmar las sesiones del panel.
  SECRETO_SESION: z.string().min(32, "SECRETO_SESION debe tener al menos 32 caracteres"),

  // App secret de Meta, para validar la firma de los webhooks.
  META_APP_SECRET: z.string().min(1),
  // Token de verificación del webhook, el mismo que se registra en Meta.
  META_VERIFY_TOKEN: z.string().min(1),

  // Motor de lenguaje. Cualquier API con forma de OpenAI sirve; cambiar de
  // proveedor son estas tres variables, no un refactor.
  //
  //   Gemini directo (tiene capa de nivel gratuito):
  //     LLM_BASE_URL=https://generativelanguage.googleapis.com/v1beta/openai
  //     LLM_MODELO=gemini-3.7-flash
  //   OpenRouter (una llave para todos los modelos):
  //     LLM_BASE_URL=https://openrouter.ai/api/v1
  //     LLM_MODELO=google/gemini-3.7-flash
  LLM_BASE_URL: z
    .string()
    .url()
    .default("https://generativelanguage.googleapis.com/v1beta/openai"),
  LLM_API_KEY: z.string().min(1),
  LLM_MODELO: z.string().default("gemini-3.7-flash"),

  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
});

let cache: z.infer<typeof esquema> | null = null;

export function env() {
  if (cache) return cache;
  const r = esquema.safeParse(process.env);
  if (!r.success) {
    const detalle = r.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("\n");
    throw new Error(`Configuración de entorno inválida:\n${detalle}`);
  }
  cache = r.data;
  return cache;
}
