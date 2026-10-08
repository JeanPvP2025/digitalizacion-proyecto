import type { Metadata } from "next";
import { EditorialArticlePage } from "@/components/storefront/editorial-pages";
import { createEditorialMetadata, getEditorialArticle } from "@/lib/content/editorial";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const article = getEditorialArticle("blog", slug);
  return article ? createEditorialMetadata("blog", article) : { title: "Artículo no encontrado", robots: { index: false, follow: false } };
}

export default async function BlogArticlePage({ params }: Props) {
  const { slug } = await params;
  return <EditorialArticlePage collection="blog" slug={slug} />;
}
