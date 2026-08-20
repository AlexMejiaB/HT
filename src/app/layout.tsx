import type { Metadata, Viewport } from "next";
import { Inter, Jost } from "next/font/google";
import { site } from "@/lib/site";
import "./globals.css";

// Geométrica para todo el sitio. Los pesos ligeros a tamaño grande son los que
// dan el registro caro; la geometría concuerda con el símbolo del logotipo,
// que son círculos y rectas.
const jost = Jost({
  variable: "--font-jost",
  subsets: ["latin"],
  display: "swap",
});

// Sólo para el logotipo: el original está compuesto en una grotesca, no en una
// geométrica, y el wordmark debe reproducirse fiel.
const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  weight: ["700", "800"],
  display: "swap",
});

const urlBase = process.env.NEXT_PUBLIC_SITE_URL ?? "https://highticket.mx";

export const metadata: Metadata = {
  metadataBase: new URL(urlBase),
  title: {
    default: `${site.marca} — ${site.tagline}`,
    template: `%s · ${site.marca}`,
  },
  description: site.descripcion,
  keywords: [
    "agente de IA WhatsApp",
    "automatización e-commerce México",
    "atención al cliente con IA",
    "WhatsApp Business API",
    "operación asistida por IA",
  ],
  openGraph: {
    type: "website",
    locale: "es_MX",
    url: urlBase,
    siteName: site.marca,
    title: `${site.marca} — ${site.tagline}`,
    description: site.descripcion,
  },
  twitter: {
    card: "summary_large_image",
    title: `${site.marca} — ${site.tagline}`,
    description: site.descripcion,
  },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  themeColor: "#000000",
  colorScheme: "dark",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="es-MX" className={`${jost.variable} ${inter.variable} h-full`}>
      <body className="min-h-full flex flex-col bg-papel text-tinta">{children}</body>
    </html>
  );
}
