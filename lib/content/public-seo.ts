import { isIP } from "node:net";
import type { Metadata } from "next";

export const PUBLIC_SITEMAP_PATHS = [
  "/",
  "/catalogo",
  "/empresas",
  "/servicios",
  "/envios",
  "/garantia",
  "/soporte",
] as const;

/** Only a configured, public HTTPS origin is suitable for crawler-facing URLs. */
export function getPublicSiteUrl(): URL | null {
  const configuredUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (!configuredUrl) return null;

  try {
    const url = new URL(configuredUrl);
    const hostname = url.hostname.toLowerCase();
    const ipHostname = hostname.startsWith("[") && hostname.endsWith("]")
      ? hostname.slice(1, -1)
      : hostname;
    const reservedSuffix = /\.(?:example|invalid|localhost|local|test)$/i;
    const documentationDomain = /(?:^|\.)example\.(?:com|net|org)$/i;

    if (
      url.protocol !== "https:" ||
      url.username ||
      url.password ||
      url.pathname !== "/" ||
      url.search ||
      url.hash ||
      hostname === "localhost" ||
      hostname.endsWith(".localhost") ||
      hostname.endsWith(".local") ||
      reservedSuffix.test(hostname) ||
      documentationDomain.test(hostname) ||
      isIP(ipHostname)
    ) {
      return null;
    }

    return new URL(url.origin);
  } catch {
    return null;
  }
}

export function createPublicPageMetadata(title: string, description: string): Metadata {
  const fullTitle = `${title} — NODRIA`;

  return {
    title,
    description,
    openGraph: {
      type: "website",
      locale: "es_ES",
      siteName: "NODRIA",
      title: fullTitle,
      description,
    },
    twitter: {
      card: "summary",
      title: fullTitle,
      description,
    },
  };
}
