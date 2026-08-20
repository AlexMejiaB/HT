import type { NextConfig } from "next";

/**
 * Cabeceras de seguridad aplicadas a todas las respuestas.
 *
 * La CSP no lleva 'unsafe-eval' y sólo permite el frame de Calendly, que es el
 * único tercero embebido en la landing.
 */
const csp = [
  "default-src 'self'",
  // Next inyecta estilos en línea; los scripts se permiten sólo del propio origen.
  "style-src 'self' 'unsafe-inline'",
  "script-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  "connect-src 'self'",
  "frame-src https://calendly.com https://*.calendly.com",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "object-src 'none'",
  "upgrade-insecure-requests",
].join("; ");

const cabeceras = [
  { key: "Content-Security-Policy", value: csp },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), interest-cohort=()",
  },
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
];

const nextConfig: NextConfig = {
  // No revelar el framework ni su versión.
  poweredByHeader: false,
  reactStrictMode: true,

  async headers() {
    return [{ source: "/:path*", headers: cabeceras }];
  },
};

export default nextConfig;
