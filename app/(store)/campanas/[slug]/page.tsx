import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CatalogCrumb, CatalogLandingHero, CatalogLinkCard, CatalogProductGrid, CatalogReadFailure } from "@/components/storefront/catalog-landings";
import styles from "@/components/storefront/catalog-landings.module.css";
import { getCatalogCampaign } from "@/lib/catalog-landings";
import { createCatalogLandingMetadata } from "@/lib/content/catalog-landing-metadata";
import { getCatalogData, getCatalogSourceNotice } from "@/lib/catalog-repository";

export const dynamic = "force-dynamic";
type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const campaign = getCatalogCampaign(await getCatalogData(), slug);
  if (!campaign) return { title: "Selección no disponible", robots: { index: false, follow: false } };
  return createCatalogLandingMetadata(`/campanas/${campaign.slug}`, campaign.title, campaign.description);
}

export default async function CampaignPage({ params }: Props) {
  const [{ slug }, data] = await Promise.all([params, getCatalogData()]);
  if (data.source === "error") return <CatalogReadFailure message={data.message} />;
  const campaign = getCatalogCampaign(data, slug);
  if (!campaign) notFound();
  return <main>
    <CatalogCrumb current={campaign.title} parent="Selecciones" parentHref="/campanas" />
    <CatalogLandingHero eyebrow={campaign.eyebrow} title={campaign.title} description={campaign.description} count={campaign.products.length} />
    {getCatalogSourceNotice(data.source) && <p className={styles.source} role="status">{getCatalogSourceNotice(data.source)}</p>}
    <section className={styles.directory} aria-labelledby="campaign-categories-title">
      <div className={styles.directoryHeading}><div><h2 id="campaign-categories-title">Explora por familia</h2><p>Abre una categoría para revisar las fichas publicadas en ella.</p></div><span>{campaign.categories.length.toString().padStart(2, "0")}</span></div>
      <div className={styles.cardGrid}>{campaign.categories.map((category, index) => <CatalogLinkCard key={category.id} href={`/categorias/${encodeURIComponent(category.slug)}`} eyebrow={`FAMILIA ${String(index + 1).padStart(2, "0")}`} title={category.name} description={category.description} count={category.count} />)}</div>
    </section>
    <section className={styles.collection} aria-labelledby="campaign-products-title">
      <div className={styles.collectionHeading}><div><p className="eyebrow">FICHAS VIGENTES</p><h2 id="campaign-products-title">Productos de la selección</h2><p>Precios y disponibilidad son datos de demo y se verifican de nuevo en checkout.</p></div><span>{campaign.products.length.toString().padStart(2, "0")}</span></div>
      <CatalogProductGrid products={campaign.products} connected={data.source === "supabase"} />
    </section>
  </main>;
}
