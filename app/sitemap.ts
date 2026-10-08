import type { MetadataRoute } from "next";
import { getPublicSiteUrl, PUBLIC_SITEMAP_PATHS } from "@/lib/content/public-seo";
import { getEditorialSitemapEntries } from "@/lib/content/editorial";

export default function sitemap(): MetadataRoute.Sitemap {
  const siteUrl = getPublicSiteUrl();
  if (!siteUrl) return [];

  return [
    ...PUBLIC_SITEMAP_PATHS.map((path) => ({
    url: new URL(path, siteUrl).toString(),
    })),
    ...getEditorialSitemapEntries().map((entry) => ({
      url: new URL(entry.path, siteUrl).toString(),
      lastModified: new Date(`${entry.lastModified}T12:00:00Z`),
    })),
  ];
}
