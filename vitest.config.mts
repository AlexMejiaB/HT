import { defineConfig } from "vitest/config";
import { resolve } from "node:path";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    // Entorno fijo para los tests: valores de juguete, nunca los reales.
    env: {
      DATABASE_URL: "postgresql://test:test@127.0.0.1:5432/test",
      CLAVE_CIFRADO: "MDEyMzQ1Njc4OWFiY2RlZjAxMjM0NTY3ODlhYmNkZWY=",
      SECRETO_SESION: "secreto-de-pruebas-con-mas-de-32-caracteres",
      META_APP_SECRET: "app-secret-de-pruebas",
      META_VERIFY_TOKEN: "verify-token-de-pruebas",
      LLM_API_KEY: "llave-de-pruebas",
    },
  },
  resolve: {
    alias: { "@": resolve(import.meta.dirname, "./src") },
  },
});
