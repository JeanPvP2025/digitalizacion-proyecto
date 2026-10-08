import type { Metadata } from "next";
import { createPublicPageMetadata, getPublicSiteUrl } from "./public-seo";

export function createCatalogLandingMetadata(path: string, title: string, description: string): Metadata {
  const base = createPublicPageMetadata(title, description);
  const siteUrl = getPublicSiteUrl();
  if (!siteUrl) return { ...base, robots: { index: false, follow: false } };
  const canonical = new URL(path, siteUrl).href;
  return {
    ...base,
    alternates: { canonical },
    openGraph: { ...base.openGraph, url: canonical },
  };
}
