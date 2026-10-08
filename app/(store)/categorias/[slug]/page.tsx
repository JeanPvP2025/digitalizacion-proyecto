import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CatalogCrumb, CatalogLandingHero, CatalogLinkCard, CatalogProductGrid, CatalogReadFailure } from "@/components/storefront/catalog-landings";
import styles from "@/components/storefront/catalog-landings.module.css";
import { getCatalogCategory } from "@/lib/catalog-landings";
import { createCatalogLandingMetadata } from "@/lib/content/catalog-landing-metadata";
import { getCatalogData, getCatalogSourceNotice } from "@/lib/catalog-repository";

export const dynamic = "force-dynamic";
type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const data = await getCatalogData();
  const landing = getCatalogCategory(data, slug);
  if (!landing) return { title: "Categoría no encontrada", robots: { index: false, follow: false } };
  return createCatalogLandingMetadata(`/categorias/${encodeURIComponent(landing.category.slug)}`, `${landing.category.name} — catálogo`, `${landing.category.description} Explora ${landing.products.length} fichas ficticias del catálogo NODRIA.`);
}

export default async function CategoryPage({ params }: Props) {
  const [{ slug }, data] = await Promise.all([params, getCatalogData()]);
  if (data.source === "error") return <CatalogReadFailure message={data.message} />;
  const landing = getCatalogCategory(data, slug);
  if (!landing) notFound();
  return <main>
    <CatalogCrumb current={landing.category.name} parent="Categorías" parentHref="/categorias" />
    <CatalogLandingHero eyebrow="CATÁLOGO · CATEGORÍA" title={landing.category.name} description={`${landing.category.description} El catálogo muestra fichas de demostración; sus especificaciones no equivalen a pruebas ni certificaciones.`} count={landing.products.length} />
    {getCatalogSourceNotice(data.source) && <p className={styles.source} role="status">{getCatalogSourceNotice(data.source)}</p>}
    {landing.children.length > 0 && <section className={styles.directory} aria-labelledby="category-families-title">
      <div className={styles.directoryHeading}><div><h2 id="category-families-title">Familias dentro de {landing.category.name}</h2><p>Afina la exploración sin salir del catálogo activo.</p></div><span>{landing.children.length.toString().padStart(2, "0")}</span></div>
      <div className={styles.cardGrid}>{landing.children.map((child, index) => <CatalogLinkCard key={child.id} href={`/categorias/${encodeURIComponent(child.slug)}`} eyebrow={`FAMILIA ${String(index + 1).padStart(2, "0")}`} title={child.name} description={child.description} count={child.count} />)}</div>
    </section>}
    <section className={styles.collection} aria-labelledby="category-products-title">
      <div className={styles.collectionHeading}><div><p className="eyebrow">PRODUCTOS DE DEMOSTRACIÓN</p><h2 id="category-products-title">Fichas publicadas</h2><p>{landing.products.length ? "Compara las características que aparecen en cada ficha." : "Esta categoría todavía no tiene productos publicados."}</p></div><span>{landing.products.length.toString().padStart(2, "0")}</span></div>
      <CatalogProductGrid products={landing.products} connected={data.source === "supabase"} />
    </section>
  </main>;
}
