import type { Metadata } from "next";
import { EditorialCollectionPage } from "@/components/storefront/editorial-pages";
import { createEditorialMetadata } from "@/lib/content/editorial";

export const dynamic = "force-dynamic";
export const metadata: Metadata = createEditorialMetadata("blog");

export default function BlogPage() {
  return <EditorialCollectionPage collection="blog" />;
}
