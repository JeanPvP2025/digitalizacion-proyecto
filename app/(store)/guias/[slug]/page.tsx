import type { Metadata } from "next";
import { EditorialArticlePage } from "@/components/storefront/editorial-pages";
import { createEditorialMetadata, getEditorialArticle } from "@/lib/content/editorial";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const article = getEditorialArticle("guias", slug);
  return article ? createEditorialMetadata("guias", article) : { title: "Guía no encontrada", robots: { index: false, follow: false } };
}

export default async function GuideArticlePage({ params }: Props) {
  const { slug } = await params;
  return <EditorialArticlePage collection="guias" slug={slug} />;
}
