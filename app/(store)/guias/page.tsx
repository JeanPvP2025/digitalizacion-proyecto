import type { Metadata } from "next";
import { EditorialCollectionPage } from "@/components/storefront/editorial-pages";
import { createEditorialMetadata } from "@/lib/content/editorial";

export const dynamic = "force-dynamic";
export const metadata: Metadata = createEditorialMetadata("guias");

export default function GuidesPage() {
  return <EditorialCollectionPage collection="guias" />;
}
