import type { MetadataRoute } from "next";
import { getCatalogData } from "@/lib/catalog-repository";
import { getCatalogBrands, getCatalogCampaigns, getCatalogCategoryDirectory } from "@/lib/catalog-landings";
import { getPublicSiteUrl, PUBLIC_SITEMAP_PATHS } from "@/lib/content/public-seo";
import { getEditorialSitemapEntries } from "@/lib/content/editorial";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const siteUrl = getPublicSiteUrl();
  if (!siteUrl) return [];
  const catalog = await getCatalogData();
  const catalogPaths = catalog.source === "error" ? [] : [
    ...getCatalogBrands(catalog).map((brand) => `/marcas/${encodeURIComponent(brand.slug)}`),
    ...getCatalogCampaigns(catalog).map((campaign) => `/campanas/${campaign.slug}`),
    ...getCatalogCategoryDirectory(catalog).map((category) => `/categorias/${encodeURIComponent(category.slug)}`),
    ...catalog.products.map((product) => `/producto/${encodeURIComponent(product.slug)}`),
  ];

  return [
    ...PUBLIC_SITEMAP_PATHS.map((path) => ({
      url: new URL(path, siteUrl).toString(),
    })),
    ...catalogPaths.map((path) => ({ url: new URL(path, siteUrl).toString() })),
    ...getEditorialSitemapEntries().map((entry) => ({
      url: new URL(entry.path, siteUrl).toString(),
      lastModified: new Date(`${entry.lastModified}T12:00:00Z`),
    })),
  ];
}
