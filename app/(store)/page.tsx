import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight, ArrowUpRight, Cpu, HardDrive, Laptop, Network, PanelsTopLeft, ShieldCheck, ShoppingBag, Smartphone } from "lucide-react";
import { ProductCard } from "@/components/storefront/product-card";
import { ConnectedProductCard } from "@/components/storefront/connected-product-card";
import { formatPrice, type Product } from "@/lib/catalog";
import { getCatalogData, getCatalogSourceNotice } from "@/lib/catalog-repository";
import { getHomepageMerchandising, productHref } from "@/lib/content/merchandising";

// Fetch the active source at request time, including after a catalogue read failure.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Tecnología con sentido",
  description: "Explora modelos reales de PC y precios de referencia consultados en PcComponentes. NODRIA no tiene stock comercial ni procesa pagos o envíos.",
};

const categoryIcons: Record<string, typeof Laptop> = {
  Ordenadores: Laptop, Componentes: Cpu, Monitores: PanelsTopLeft,
  Redes: Network, Telefonía: Smartphone, Almacenamiento: HardDrive,
};

function ProductSelection({ products, demo }: { products: Product[]; demo: boolean }) {
  return <div className="product-grid">{products.map((product, index) => demo
    ? <ProductCard key={product.id} product={product} index={index} />
    : <ConnectedProductCard key={product.id} product={product} index={index} />)}</div>;
}

export default async function HomePage() {
  const data = await getCatalogData();
  if (data.source === "error") {
    return (
      <main className="page-wrap">
        <h1 className="page-title">El catálogo no está disponible.</h1>
        <p className="page-intro" role="alert">{data.message}</p>
        <p className="page-intro">NODRIA es una demo académica. Las referencias comerciales se cargarán cuando se conecte el catálogo verificado; no hay pagos ni envíos reales.</p>
        <form action="/" method="get"><button className="button button--dark" type="submit">Volver a intentar cargar la portada <ArrowRight aria-hidden="true" size={15} /></button></form>
        <p><Link className="section-link" href="/catalogo">Abrir el catálogo <ArrowRight aria-hidden="true" size={14} /></Link></p>
      </main>
    );
  }

  const { hero, featured, discoveries, categories, campaign, totalProducts, hasExplicitNovelties } = getHomepageMerchandising(data);
  const demo = data.source === "demo";
  const sourceNotice = getCatalogSourceNotice(data.source);

  return (
    <main>
      <section className="home-hero" aria-labelledby="home-title">
        <div className="hero-ring" aria-hidden="true" />
        <div className="hero-inner">
          <div className="hero-copy">
            <h1 id="home-title">Lo que viene,<br /><em>bien elegido.</em></h1>
            <p>Explora modelos reales con la fotografía exacta de cada ficha y precios de referencia fechados. NODRIA no los vende ni mantiene inventario: confirma el precio y la disponibilidad con el vendedor.</p>
            <p role="status">{sourceNotice}</p>
            <div className="hero-actions" style={{ flexWrap: "wrap" }}>
              <Link className="button button--accent" href="/catalogo">Explorar productos <ArrowRight aria-hidden="true" size={15} /></Link>
              <Link className="hero-text-link" href="/empresas">Probar el flujo para empresas <ArrowUpRight aria-hidden="true" size={14} /></Link>
            </div>
            <div className="hero-trust" aria-label="Alcance de la demostración">
              <div><strong>Modelos reales</strong><span>FOTOGRAFÍA Y REFERENCIA COMERCIAL</span></div><span className="trust-separator" aria-hidden="true" />
              <div><strong>PC Builder</strong><span>COMPATIBILIDAD ORIENTATIVA</span></div><span className="trust-separator" aria-hidden="true" />
              <div><strong>Checkout</strong><span>SIN COBROS REALES</span></div>
            </div>
          </div>
          <div className="hero-art">
            {hero ? <Link className="hero-device" href={productHref(hero)} aria-label={`Ver la ficha de ${hero.name}`}>
              {hero.image ? <Image
                src={hero.image}
                alt={hero.imageAlt || hero.name}
                fill
                sizes="(max-width: 760px) calc(100vw - 38px), (max-width: 1100px) 46vw, 42vw"
                loading="eager"
                fetchPriority="high"
                unoptimized={!demo}
              /> : <span className="sr-only">Imagen no disponible</span>}
              <div className="device-frame" aria-hidden="true" />
              <div className="hero-product-callout" style={{ right: 24, overflowWrap: "anywhere" }}>
                <span>{hero.category} · MODELO REAL</span>
                <strong>{hero.name}</strong>
                {!hero.image && <small>Imagen no disponible</small>}
                <small>Precio de referencia · {formatPrice(hero.price)} · PcComponentes · Ver ficha <ArrowUpRight aria-hidden="true" size={11} /></small>
              </div>
            </Link> : <div className="hero-device"><div className="hero-product-callout"><strong>Aún no hay productos publicados.</strong><small>Vuelve al catálogo más adelante.</small></div></div>}
          </div>
        </div>
      </section>

      <div className="section-shell">
        <section className="service-strip" aria-label="Funciones de la demostración">
          <div className="service-point"><span className="service-icon"><Laptop aria-hidden="true" size={16} /></span><div><strong>Productos referenciados</strong><span>{totalProducts} {totalProducts === 1 ? "modelo verificado" : "modelos verificados"}</span></div></div>
          <div className="service-point"><span className="service-icon"><Cpu aria-hidden="true" size={16} /></span><div><strong>PC Builder</strong><span>Comprobaciones orientativas</span></div></div>
          <div className="service-point"><span className="service-icon"><ShoppingBag aria-hidden="true" size={16} /></span><div><strong>Precios de referencia</strong><span>Fecha y vendedor visibles</span></div></div>
          <div className="service-point"><span className="service-icon"><ShieldCheck aria-hidden="true" size={16} /></span><div><strong>Enlace al vendedor</strong><span>Sin compra en NODRIA</span></div></div>
        </section>
      </div>

      <section className="category-section section-shell" aria-labelledby="home-categories">
        <div className="section-heading-row"><div><h2 id="home-categories">Explora las categorías.</h2><p>Referencias reales con precio y fotografía del producto exacto.</p></div><Link className="section-link" href="/catalogo">Ver catálogo <ArrowRight aria-hidden="true" size={14} /></Link></div>
        {categories.length ? <div className="category-grid">{categories.map((category) => {
          const Icon = categoryIcons[category.name] ?? ShoppingBag;
          return <Link href={category.href} className="category-card" key={category.id}>
            <span className="category-symbol"><Icon aria-hidden="true" size={18} strokeWidth={1.6} /></span>
            <strong>{category.name}</strong><span>{category.description}</span>
            <small className="category-count">{category.count} {category.count === 1 ? "ficha" : "fichas"} · Explorar <ArrowUpRight aria-hidden="true" size={11} /></small>
          </Link>;
        })}</div> : <div className="catalog-empty"><strong>No hay categorías con productos para explorar.</strong><p>La selección aparecerá cuando el catálogo tenga fichas publicadas.</p><Link href="/catalogo">Consultar el catálogo</Link></div>}
      </section>

      {featured.length > 0 && <section className="featured-section" aria-labelledby="home-featured">
        <div className="section-shell">
          <div className="section-heading-row"><div><h2 id="home-featured">Destacados del catálogo.</h2><p>Modelos reales; los importes se muestran como precios de referencia consultados en PcComponentes.</p></div><Link className="section-link" href="/catalogo">Ver todos los productos <ArrowRight aria-hidden="true" size={14} /></Link></div>
          <ProductSelection products={featured} demo={demo} />
        </div>
      </section>}

      {campaign && <section className="showcase-banner section-shell" aria-labelledby="home-campaign">
        <div className="showcase-copy">
          <h2 id="home-campaign">{campaign.title}</h2><p>{campaign.description}</p>
          <Link className="button button--accent" href={campaign.href}>Explorar referencias <ArrowRight aria-hidden="true" size={15} /></Link>
        </div>
        <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", padding: "clamp(24px, 4vw, 48px)", minWidth: 0 }}>
          <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
            {campaign.products.map((product) => <li key={product.id} style={{ borderBottom: "1px solid #4f705d" }}>
              <Link href={productHref(product)} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16, padding: "20px 0", overflowWrap: "anywhere" }}>
                <span><small style={{ display: "block", color: "#becbc0", marginBottom: 6 }}>{product.category} · modelo real</small><strong>{product.name}</strong><small style={{ display: "block", color: "#becbc0", marginTop: 6 }}>Referencia · {formatPrice(product.price)}</small></span>
                <ArrowUpRight aria-hidden="true" size={18} style={{ flexShrink: 0 }} />
              </Link>
            </li>)}
          </ul>
        </div>
      </section>}

      {discoveries.length > 0 && <section className="featured-section" aria-labelledby="home-discoveries">
        <div className="section-shell">
          <div className="section-heading-row"><div><h2 id="home-discoveries">{hasExplicitNovelties ? "Novedades y otras ideas." : "Más ideas por descubrir."}</h2><p>{hasExplicitNovelties ? "Primero las fichas etiquetadas como novedad; después, otras categorías para explorar." : "Otras fichas del catálogo activo, con variedad de categorías. No hay novedades etiquetadas en esta selección."}</p></div><Link className="section-link" href="/catalogo">Seguir explorando <ArrowRight aria-hidden="true" size={14} /></Link></div>
          <ProductSelection products={discoveries} demo={demo} />
        </div>
      </section>}

      <section className="proof-section section-shell" aria-labelledby="home-demo">
        <div className="section-heading-row"><div><h2 id="home-demo">Una tienda para aprender.</h2><p>Los modelos, las fotos y los precios citados corresponden a productos reales. NODRIA no tiene relación comercial con la tienda de referencia ni disponibilidad propia; compra, cobro y envío no están habilitados.</p></div><Link className="section-link" href="/envios">Ver alcance de la demostración <ArrowRight aria-hidden="true" size={14} /></Link></div>
        <div className="story-link-row" style={{ flexWrap: "wrap", gap: 24 }}>
          <Link className="section-link" href="/configurador">Probar el PC Builder <ArrowUpRight aria-hidden="true" size={14} /></Link>
          <Link className="section-link" href="/empresas">Probar el formulario para empresas <ArrowUpRight aria-hidden="true" size={14} /></Link>
        </div>
      </section>
    </main>
  );
}
