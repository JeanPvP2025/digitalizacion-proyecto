import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CatalogCrumb, CatalogLandingHero, CatalogProductGrid, CatalogReadFailure } from "@/components/storefront/catalog-landings";
import { getCatalogData, getCatalogSourceNotice } from "@/lib/catalog-repository";
import { getCatalogBrand } from "@/lib/catalog-landings";
import { createCatalogLandingMetadata } from "@/lib/content/catalog-landing-metadata";
import styles from "@/components/storefront/catalog-landings.module.css";

export const dynamic = "force-dynamic";
type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const data = await getCatalogData();
  const brand = getCatalogBrand(data, slug);
  if (!brand) return { title: "Marca no encontrada", robots: { index: false, follow: false } };
  return createCatalogLandingMetadata(`/marcas/${encodeURIComponent(brand.slug)}`, `${brand.name} en el catálogo`, `Consulta ${brand.products.length} fichas ficticias de ${brand.name} disponibles en el catálogo activo de NODRIA.`);
}

export default async function BrandPage({ params }: Props) {
  const [{ slug }, data] = await Promise.all([params, getCatalogData()]);
  if (data.source === "error") return <CatalogReadFailure message={data.message} />;
  const brand = getCatalogBrand(data, slug);
  if (!brand) notFound();
  return <main>
    <CatalogCrumb current={brand.name} parent="Marcas" parentHref="/marcas" />
    <CatalogLandingHero eyebrow="MARCA · FICHAS FICTICIAS" title={brand.name} description={`Explora las fichas publicadas de ${brand.name}. Los productos y sus prestaciones son datos de demostración, no reseñas, certificaciones ni pruebas independientes.`} count={brand.products.length} />
    {getCatalogSourceNotice(data.source) && <p className={styles.source} role="status">{getCatalogSourceNotice(data.source)}</p>}
    <section className={styles.collection} aria-labelledby="brand-products-title">
      <div className={styles.collectionHeading}><div><p className="eyebrow">CATÁLOGO ACTIVO</p><h2 id="brand-products-title">Fichas de {brand.name}</h2><p>Precio y disponibilidad se vuelven a validar en el checkout simulado.</p></div><span>{brand.products.length.toString().padStart(2, "0")}</span></div>
      <CatalogProductGrid products={brand.products} connected={data.source === "supabase"} />
    </section>
  </main>;
}
