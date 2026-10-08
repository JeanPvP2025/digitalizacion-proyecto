import type { Metadata } from "next";
import { CatalogLandingHero, CatalogLinkCard, CatalogReadFailure } from "@/components/storefront/catalog-landings";
import styles from "@/components/storefront/catalog-landings.module.css";
import { getCatalogCampaigns } from "@/lib/catalog-landings";
import { createCatalogLandingMetadata } from "@/lib/content/catalog-landing-metadata";
import { getCatalogData } from "@/lib/catalog-repository";

export const dynamic = "force-dynamic";
export const metadata: Metadata = createCatalogLandingMetadata("/campanas", "Selecciones", "Selecciones temáticas formadas a partir de las fichas publicadas del catálogo ficticio NODRIA.");

export default async function CampaignsPage() {
  const data = await getCatalogData();
  if (data.source === "error") return <CatalogReadFailure message={data.message} />;
  const campaigns = getCatalogCampaigns(data);
  return <main>
    <CatalogLandingHero eyebrow="NODRIA · SELECCIONES" title="Explora por una idea." description="Selecciones temáticas calculadas a partir de categorías y productos publicados en el catálogo activo. No son packs, descuentos, patrocinios ni recomendaciones comerciales." count={campaigns.length} countLabel={campaigns.length === 1 ? "selección disponible" : "selecciones disponibles"} />
    <section className={styles.directory} aria-labelledby="campaigns-title">
      <div className={styles.directoryHeading}><div><h2 id="campaigns-title">Selecciones activas</h2><p>El contenido cambia con el catálogo. Una campaña sin productos no aparece.</p></div><span>{campaigns.length.toString().padStart(2, "0")}</span></div>
      {campaigns.length ? <div className={styles.cardGrid}>{campaigns.map((campaign) => <CatalogLinkCard key={campaign.slug} href={`/campanas/${campaign.slug}`} eyebrow={campaign.eyebrow} title={campaign.title} description={campaign.description} count={campaign.products.length} />)}</div> : <div className={styles.empty} role="status"><strong>No hay selecciones con fichas disponibles.</strong><p>Explora las categorías para ver qué productos están publicados.</p></div>}
    </section>
  </main>;
}
