import type { Metadata } from "next";
import { FavoritesPage } from "@/components/storefront/store-collections";
import { getCatalogData } from "@/lib/catalog-repository";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Favoritos", robots: { index: false, follow: false } };

export default async function FavoritesRoute() {
  const catalog = await getCatalogData();
  return <FavoritesPage catalog={catalog} />;
}
