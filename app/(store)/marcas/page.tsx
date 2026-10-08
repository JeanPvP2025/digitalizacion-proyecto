import type { Metadata } from "next";
import { formatPrice } from "@/lib/catalog";
import { getCatalogData, getCatalogSourceNotice } from "@/lib/catalog-repository";
import { getCatalogBrands } from "@/lib/catalog-landings";
import { createCatalogLandingMetadata } from "@/lib/content/catalog-landing-metadata";
import { CatalogLandingHero, CatalogLinkCard, CatalogReadFailure } from "@/components/storefront/catalog-landings";
import styles from "@/components/storefront/catalog-landings.module.css";

export const dynamic = "force-dynamic";
export const metadata: Metadata = createCatalogLandingMetadata("/marcas", "Marcas", "Explora las marcas disponibles en el catálogo ficticio de NODRIA.");

export default async function BrandsPage() {
  const data = await getCatalogData();
  if (data.source === "error") return <CatalogReadFailure message={data.message} />;
  const brands = getCatalogBrands(data);
  return <main>
    <CatalogLandingHero eyebrow="CATÁLOGO · MARCAS" title="Ideas que empiezan por una marca." description="Consulta las fichas publicadas por marca y compara sus datos en el catálogo activo. Productos, marcas y precios son ficticios; no representan ofertas ni recomendaciones." count={brands.length} countLabel={brands.length === 1 ? "marca disponible" : "marcas disponibles"} />
    {getCatalogSourceNotice(data.source) && <p className={styles.source} role="status">{getCatalogSourceNotice(data.source)}</p>}
    <section className={styles.directory} aria-labelledby="brands-title">
      <div className={styles.directoryHeading}><div><h2 id="brands-title">Marcas del catálogo</h2><p>Solo aparecen marcas con productos publicados en la fuente activa.</p></div><span>{brands.length.toString().padStart(2, "0")}</span></div>
      {brands.length ? <div className={styles.cardGrid}>{brands.map((brand, index) => {
        const prices = brand.products.map((product) => product.price);
        const priceLabel = prices.length === 1 ? `Desde ${formatPrice(Math.min(...prices))}` : `Precios de ficha: ${formatPrice(Math.min(...prices))}–${formatPrice(Math.max(...prices))}`;
        return <CatalogLinkCard key={brand.slug} href={`/marcas/${encodeURIComponent(brand.slug)}`} eyebrow={`MARCA ${String(index + 1).padStart(2, "0")}`} title={brand.name} description={`${brand.products.length} ${brand.products.length === 1 ? "ficha ficticia" : "fichas ficticias"} · ${priceLabel}`} count={brand.products.length} />;
      })}</div> : <div className={styles.empty} role="status"><strong>Aún no hay marcas publicadas.</strong><p>Cuando el catálogo activo tenga productos, las marcas aparecerán aquí.</p></div>}
    </section>
  </main>;
}
