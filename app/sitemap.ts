import type { MetadataRoute } from "next";
import { getPublicSiteUrl, PUBLIC_SITEMAP_PATHS } from "@/lib/content/public-seo";

export default function sitemap(): MetadataRoute.Sitemap {
  const siteUrl = getPublicSiteUrl();
  if (!siteUrl) return [];

  return PUBLIC_SITEMAP_PATHS.map((path) => ({
    url: new URL(path, siteUrl).toString(),
  }));
}
