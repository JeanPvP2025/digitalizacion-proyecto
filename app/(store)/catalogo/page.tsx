import type { Metadata } from "next";
import { Suspense } from "react";
import { CatalogView } from "@/components/storefront/catalog/catalog-view";
import type { CatalogParams } from "@/components/storefront/catalog/discovery";
import { getCatalogData } from "@/lib/catalog-repository";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Catálogo de componentes", description: "Explora componentes de PC con modelos, imágenes y precios de referencia consultados en PcComponentes." };

async function CatalogResults({ searchParams }: { searchParams: Promise<CatalogParams> }) {
  const [rawParams, data] = await Promise.all([searchParams, getCatalogData()]);
  return <CatalogView data={data} rawParams={rawParams} />;
}

export default function CatalogPage({ searchParams }: { searchParams: Promise<CatalogParams> }) {
  return <Suspense fallback={<main className="page-wrap catalog-page"><p className="eyebrow">NODRIA · CATÁLOGO</p><div className="empty-state" role="status">Cargando catálogo…</div></main>}><CatalogResults searchParams={searchParams} /></Suspense>;
}
