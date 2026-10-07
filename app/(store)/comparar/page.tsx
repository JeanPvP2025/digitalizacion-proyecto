import type { Metadata } from "next";
import { ComparePage } from "@/components/storefront/store-collections";
import { getCatalogData } from "@/lib/catalog-repository";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Comparador" };

export default async function CompareRoute() {
  const catalog = await getCatalogData();
  return <ComparePage catalog={catalog} />;
}
