import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { site } from "@/lib/site";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

const urlBase = process.env.NEXT_PUBLIC_SITE_URL ?? "https://veloce.ai";

export const metadata: Metadata = {
  metadataBase: new URL(urlBase),
  title: {
    default: `${site.marca} ${site.marcaSufijo} — ${site.tagline}`,
    template: `%s · ${site.marca} ${site.marcaSufijo}`,
  },
  description: site.descripcion,
  keywords: [
    "agente de IA WhatsApp",
    "automatización e-commerce México",
    "atención al cliente con IA",
    "WhatsApp Business API",
    "chatbot tienda en línea",
  ],
  openGraph: {
    type: "website",
    locale: "es_MX",
    url: urlBase,
    siteName: `${site.marca} ${site.marcaSufijo}`,
    title: `${site.marca} ${site.marcaSufijo} — ${site.tagline}`,
    description: site.descripcion,
  },
  twitter: {
    card: "summary_large_image",
    title: `${site.marca} ${site.marcaSufijo} — ${site.tagline}`,
    description: site.descripcion,
  },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  themeColor: "#050505",
  colorScheme: "light",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="es-MX" className={`${inter.variable} h-full`}>
      <body className="min-h-full flex flex-col bg-papel text-tinta">{children}</body>
    </html>
  );
}
