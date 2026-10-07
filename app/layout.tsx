import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"),
  title: {
    default: "NODRIA — Tecnología con sentido",
    template: "%s — NODRIA",
  },
  description: "Tecnología seleccionada para avanzar. Descubre equipos, conectividad y soluciones para empresas con la atención de un equipo experto.",
  applicationName: "NODRIA",
  openGraph: {
    type: "website",
    locale: "es_ES",
    siteName: "NODRIA",
    title: "NODRIA — Tecnología con sentido",
    description: "Tecnología seleccionada para avanzar.",
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es" data-scroll-behavior="smooth">
      <body>{children}</body>
    </html>
  );
}
