import Link from "next/link";
import { ArrowRight, ArrowUpRight, Layers3 } from "lucide-react";
import { ProductCard } from "@/components/storefront/product-card";
import { ConnectedProductCard } from "@/components/storefront/connected-product-card";
import type { CatalogProduct } from "@/lib/catalog-mapping";
import styles from "./catalog-landings.module.css";

export function CatalogReadFailure({ message }: { message: string }) {
  return (
    <main className="page-wrap">
      <p className="eyebrow">NODRIA · CATÁLOGO</p>
      <h1 className="page-title">No podemos cargar estas fichas.</h1>
      <p className="page-intro" role="alert">{message}</p>
      <Link className="button button--dark" href="/catalogo">Volver al catálogo <ArrowRight aria-hidden="true" size={15} /></Link>
    </main>
  );
}

export function CatalogProductGrid({ products, connected }: { products: CatalogProduct[]; connected: boolean }) {
  if (!products.length) {
    return <div className={styles.empty} role="status"><strong>Esta selección aún no tiene fichas publicadas.</strong><p>Prueba otra categoría o vuelve a explorar el catálogo.</p><Link href="/catalogo">Ver catálogo <ArrowRight aria-hidden="true" size={14} /></Link></div>;
  }
  return <div className="catalog-product-grid">
    {products.map((product, index) => <div key={product.id} className={styles.productCard}>
      {connected ? <ConnectedProductCard product={product} index={index} /> : <ProductCard product={product} index={index} />}
    </div>)}
  </div>;
}

export function CatalogLandingHero({ eyebrow, title, description, count, countLabel }: {
  eyebrow: string; title: string; description: string; count?: number; countLabel?: string;
}) {
  return <header className={styles.hero}>
    <div className={styles.heroInner}>
      <p className="eyebrow">{eyebrow}</p>
      <h1>{title}</h1>
      <p className={styles.description}>{description}</p>
      {count !== undefined && <p className={styles.count}><Layers3 aria-hidden="true" size={15} /> {count} {countLabel ?? (count === 1 ? "ficha publicada" : "fichas publicadas")}</p>}
    </div>
    <span className={styles.heroIndex} aria-hidden="true">N / D</span>
  </header>;
}

export function CatalogCrumb({ current, parent = "Catálogo", parentHref = "/catalogo" }: { current: string; parent?: string; parentHref?: string }) {
  return <nav className={styles.crumb} aria-label="Ruta de navegación"><Link href="/">Inicio</Link><span aria-hidden="true">/</span><Link href={parentHref}>{parent}</Link><span aria-hidden="true">/</span><span aria-current="page">{current}</span></nav>;
}

export function CatalogLinkCard({ href, eyebrow, title, description, count }: {
  href: string; eyebrow: string; title: string; description: string; count: number;
}) {
  return <Link className={styles.linkCard} href={href}>
    <span className={styles.cardEyebrow}>{eyebrow}</span>
    <strong>{title}</strong>
    <span className={styles.cardDescription}>{description}</span>
    <span className={styles.cardFooter}>{count} {count === 1 ? "ficha" : "fichas"}<span>Explorar <ArrowUpRight aria-hidden="true" size={13} /></span></span>
  </Link>;
}

export function CatalogCollection({ title, description, products, connected }: {
  title: string; description: string; products: CatalogProduct[]; connected: boolean;
}) {
  return <section className={styles.collection} aria-labelledby="catalog-collection-title">
    <div className={styles.collectionHeading}><div><p className="eyebrow">SELECCIÓN ACTIVA</p><h2 id="catalog-collection-title">{title}</h2><p>{description}</p></div><span>{products.length.toString().padStart(2, "0")}</span></div>
    <CatalogProductGrid products={products} connected={connected} />
  </section>;
}
