import type { Metadata } from "next";
import { CatalogLandingHero, CatalogLinkCard, CatalogReadFailure } from "@/components/storefront/catalog-landings";
import styles from "@/components/storefront/catalog-landings.module.css";
import { getCatalogCategoryDirectory } from "@/lib/catalog-landings";
import { createCatalogLandingMetadata } from "@/lib/content/catalog-landing-metadata";
import { getCatalogData } from "@/lib/catalog-repository";

export const dynamic = "force-dynamic";
export const metadata: Metadata = createCatalogLandingMetadata("/categorias", "Categorías", "Explora categorías y subcategorías del catálogo ficticio de NODRIA.");

export default async function CategoriesPage() {
  const data = await getCatalogData();
  if (data.source === "error") return <CatalogReadFailure message={data.message} />;
  const categories = getCatalogCategoryDirectory(data);
  return <main>
    <CatalogLandingHero eyebrow="CATÁLOGO · CATEGORÍAS" title="Encuentra tu punto de partida." description="Recorre las categorías y sus familias de producto. Solo se muestran grupos con fichas publicadas en el catálogo activo." count={categories.length} countLabel={categories.length === 1 ? "categoría disponible" : "categorías disponibles"} />
    <section className={styles.directory} aria-labelledby="categories-title">
      <div className={styles.directoryHeading}><div><h2 id="categories-title">Explora por categoría</h2><p>Las fichas y características son datos ficticios de una demo académica.</p></div><span>{categories.length.toString().padStart(2, "0")}</span></div>
      {categories.length ? <div className={styles.cardGrid}>{categories.map((category, index) => <CatalogLinkCard key={category.id} href={`/categorias/${encodeURIComponent(category.slug)}`} eyebrow={`FAMILIA ${String(index + 1).padStart(2, "0")}`} title={category.name} description={category.description} count={category.count} />)}</div> : <div className={styles.empty} role="status"><strong>Aún no hay categorías con productos publicados.</strong><p>Vuelve a consultar el catálogo más adelante.</p></div>}
    </section>
  </main>;
}
