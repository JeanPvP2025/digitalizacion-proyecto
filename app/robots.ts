import type { MetadataRoute } from "next";
import { getPublicSiteUrl } from "@/lib/content/public-seo";

export default function robots(): MetadataRoute.Robots {
  const siteUrl = getPublicSiteUrl();

  if (!siteUrl) {
    return {
      rules: { userAgent: "*", disallow: "/" },
    };
  }

  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/api/", "/backoffice/"],
    },
    sitemap: new URL("/sitemap.xml", siteUrl).toString(),
  };
}
