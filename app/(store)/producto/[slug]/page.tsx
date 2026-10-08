import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ArrowRight, MessageCircle } from "lucide-react";
import { ProductActions } from "@/components/storefront/store-interactions";
import { ProductCard } from "@/components/storefront/product-card";
import { ConnectedProductCard } from "@/components/storefront/connected-product-card";
import { formatPrice } from "@/lib/catalog";
import { getCatalogData, getCatalogSourceNotice } from "@/lib/catalog-repository";
import { listPublishedProductReviews } from "@/lib/reviews/data";
import { getServerDataMode } from "@/lib/server/data-mode";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getPcBuilderCatalog } from "@/lib/pc-builder/catalog";
import { getProductAlternatives, getProductComplements, getProductEditorial, groupSpecifications } from "@/lib/content/product-editorial";
import { getEditorialForProduct } from "@/lib/content/editorial";
import { getProductPurchaseData } from "./detail-data";
import { PurchaseOptions } from "./purchase-options";
import { ProductGallery } from "./product-gallery";
import styles from "./page.module.css";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: PageProps<"/producto/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const data = await getCatalogData();
  const product = data.source === "error" ? undefined : data.products.find((item) => item.slug === slug);
  if (data.source === "error") return { title: "Catálogo no disponible" };
  if (!product) return { title: "Producto no encontrado" };
  return { title: product.name, description: product.summary, openGraph: { title: `${product.name} | NODRIA`, description: product.summary, ...(product.image ? { images: [product.image] } : {}) } };
}

async function ProductContent({ params }: { params: PageProps<"/producto/[slug]">["params"] }) {
  const { slug } = await params;
  const data = await getCatalogData();
  if (data.source === "error") {
    return <main className="page-wrap product-page"><p className="eyebrow">CATÁLOGO NODRIA</p><h1 className="page-title">Producto no disponible<span className="title-period">.</span></h1><p className="page-intro" role="alert">{data.message}</p><Link className="button button--dark" href={`/producto/${slug}`}>Volver a intentarlo</Link></main>;
  }
  const product = data.products.find((item) => item.slug === slug);
  if (!product) notFound();
  const sourceNotice = getCatalogSourceNotice(data.source);
  const connected = data.source === "supabase" && getServerDataMode() === "supabase";
  const supabase = connected ? await createSupabaseServerClient() : null;
  const publishedReviews = connected && supabase
    ? await listPublishedProductReviews(supabase, product.id)
    : null;
  const opinionsHref = `/producto/${product.slug}/opiniones`;
  const [purchase, parts] = await Promise.all([
    connected ? getProductPurchaseData(product.id) : Promise.resolve(null),
    connected && (product.category === "Componentes" || product.category === "Almacenamiento") ? getPcBuilderCatalog() : Promise.resolve(null),
  ]);
  const components = parts?.source === "supabase" ? parts.components : [];
  const related = getProductAlternatives(product, data.products, components);
  const complements = getProductComplements(product, data.products, components);
  const editorial = getProductEditorial(product.category);
  const editorialReads = getEditorialForProduct(product.slug);
  const specGroups = groupSpecifications(product.specifications);
  const category = data.categories.find((item) => item.name === product.category);
  const categoryHref = category ? `/catalogo?categoria=${encodeURIComponent(category.slug)}` : "/catalogo";

  return (
    <main className={`page-wrap product-page ${styles.page}`}>
      <nav className="eyebrow" aria-label="Ruta de navegación"><Link href="/">INICIO</Link><span>/</span><Link href="/catalogo">CATÁLOGO</Link><span>/</span><Link href={categoryHref}>{product.category.toUpperCase()}</Link></nav>
      {sourceNotice && <p className="page-intro" role="status">{sourceNotice}</p>}
      <p className={styles.notice}>NODRIA es una demo académica. Productos, precios y operaciones son ficticios; no se procesa dinero real.</p>
      <div className="product-detail-top">
        <ProductGallery key={product.image} image={product.image} alt={product.imageAlt || product.name} demo={data.source === "demo"} sku={product.sku} />
        <section className="product-detail-copy" aria-labelledby="product-name">
          <p className="eyebrow">{product.brand} <span>·</span> {product.category}</p>
          <h1 id="product-name">{product.name}<span className="title-period">.</span></h1>
          <div className="detail-rating" aria-label="Opiniones del producto">
            <MessageCircle size={14} aria-hidden="true" />
            {data.source === "demo" ? <span>Consulta las opiniones</span> : !publishedReviews?.ok ? <span>Opiniones no disponibles</span> : publishedReviews.data.total === 0 ? <span>Sin opiniones publicadas</span> : <span>{publishedReviews.data.total} {publishedReviews.data.total === 1 ? "opinión publicada" : "opiniones publicadas"}</span>}
            <Link href={opinionsHref}>Leer opiniones y opinar</Link>
          </div>
          <p className="detail-summary">{product.summary}</p>
          {data.source === "demo" ? <><div className="detail-price-line"><strong>{formatPrice(product.price)}</strong>{product.previousPrice !== undefined && product.previousPrice > product.price && <del>{formatPrice(product.previousPrice)}</del>}<span>Precio demo</span></div><div className="detail-availability">{product.stock > 0 ? `Stock ficticio local · ${product.stock} unidades` : "Sin stock en la demo local"}</div><ProductActions product={product} /><Link className={styles.cartLink} href="/carrito">Ver carrito</Link></> : <PurchaseOptions key={product.id} product={product} variants={purchase?.variants ?? []} available={purchase?.ok ?? false} />}
          <p className={styles.notice}>Entrega y devoluciones simuladas. Esta ficha no confirma plazos logísticos ni condiciones comerciales reales.</p>
        </section>
      </div>
      <nav className={styles.jumpLinks} aria-label="Contenido de la ficha"><a href="#especificaciones">Especificaciones</a><a href="#compatibilidad">Compatibilidad</a>{editorial && <a href="#guia-compra">Guía de compra</a>}<a href="#alternativas">Alternativas</a></nav>
      {purchase?.description && purchase.description !== product.summary && <section className={styles.section} aria-labelledby="description-heading"><p className="eyebrow">DESCRIPCIÓN PUBLICADA · DEMO</p><h2 id="description-heading">Conoce esta referencia.</h2><p>{purchase.description}</p></section>}
      <section id="especificaciones" className={styles.section} aria-labelledby="spec-heading"><p className="eyebrow">DATOS PUBLICADOS · DEMO</p><h2 id="spec-heading">La ficha técnica.</h2>{specGroups.length ? <div className={styles.specGroups}>{specGroups.map((group) => <div key={group.title}><h3>{group.title}</h3><dl>{group.items.map((spec, index) => <div className={styles.specRow} key={`${spec.label}-${index}`}><dt>{spec.label}</dt><dd>{spec.value}</dd></div>)}</dl></div>)}</div> : <p>No hay especificaciones publicadas para esta referencia.</p>}<p className={styles.notice}>La garantía y el contenido de caja se muestran únicamente cuando figuran en las especificaciones. La información ausente queda pendiente de confirmar.</p></section>
      <section id="compatibilidad" className={styles.section} aria-labelledby="compat-heading"><p className="eyebrow">ANTES DE ELEGIR</p><h2 id="compat-heading">Comprueba la compatibilidad.</h2><p>Revisa las conexiones y requisitos publicados de ambos dispositivos. La categoría o marca no bastan para acreditar compatibilidad.</p>{components.some((item) => item.productId === product.id) ? <><p>Esta referencia tiene variantes con atributos estructurados en el configurador. Valida allí el conjunto de piezas; el stock se confirma en checkout.</p><Link className="section-link" href="/configurador">Abrir configurador <ArrowRight size={14} aria-hidden="true" /></Link></> : <p>No hay una validación automática de compatibilidad publicada para este producto.</p>}<Link className="section-link" href="/soporte">Consultar una duda técnica <ArrowRight size={14} aria-hidden="true" /></Link>
        {complements.length > 0 && <><h3>Piezas con coincidencias declaradas</h3><p>Coincidencias parciales por variante, pendientes de comprobar en el equipo completo.</p><div className={styles.complements}>{complements.map(({ product: item, matches }) => <article className={styles.complement} key={item.id}><Link href={`/producto/${item.slug}`}>{item.name}</Link>{matches.map((match, index) => <p key={index}>{match.variantTitle} → {match.relatedVariantTitle}: {match.reason}.</p>)}</article>)}</div></>}
      </section>
      {editorial ? <section id="guia-compra" className={styles.section} aria-labelledby="guide-heading"><p className="eyebrow">GUÍA EDITORIAL DE DEMOSTRACIÓN</p><h2 id="guide-heading">Decide con la información adecuada.</h2><details className={styles.guide} open><summary>{editorial.title}</summary><ol>{editorial.checks.map((check) => <li key={check}>{check}</li>)}</ol></details>{editorialReads.length > 0 && <ul>{editorialReads.map((item) => <li key={`${item.collection}-${item.slug}`}><Link href={`/${item.collection}/${item.slug}`}>{item.title}</Link></li>)}</ul>}</section> : <section className={styles.section}><p>No hay una guía editorial para esta categoría. Puedes consultar las especificaciones o contactar con soporte.</p>{editorialReads.length > 0 && <ul>{editorialReads.map((item) => <li key={`${item.collection}-${item.slug}`}><Link href={`/${item.collection}/${item.slug}`}>{item.title}</Link></li>)}</ul>}</section>}
      <section id="alternativas" className={`related-section ${styles.section}`} aria-labelledby="alternatives-heading"><div className="section-heading-row"><div><p className="eyebrow">COMPARA ANTES DE ELEGIR</p><h2 id="alternatives-heading">Alternativas de la categoría.</h2></div><Link className="section-link" href={categoryHref}>Ver categoría <ArrowRight size={14} aria-hidden="true" /></Link></div><p>Misma categoría{components.some((item) => item.productId === product.id) ? " y mismo tipo de componente" : ""}, ordenadas por proximidad de precio. No implica compatibilidad ni equivalencia de prestaciones.</p>{related.length ? <div className="product-grid">{related.map((item, index) => data.source === "demo" ? <ProductCard key={item.id} product={item} index={index} showRating={false} /> : <ConnectedProductCard key={item.id} product={item} index={index} />)}</div> : <p>No hay otras referencias comparables publicadas en esta categoría.</p>}</section>
    </main>
  );
}

export default function ProductPage(props: PageProps<"/producto/[slug]">) {
  return <Suspense fallback={<main className="page-wrap product-page"><p className="eyebrow">NODRIA · PRODUCTO</p><div className="empty-state">Cargando ficha…</div></main>}><ProductContent params={props.params} /></Suspense>;
}
