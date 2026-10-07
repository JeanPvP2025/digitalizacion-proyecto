import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ArrowRight, Check, MessageCircle, RotateCcw, ShieldCheck, Truck } from "lucide-react";
import { ProductActions } from "@/components/storefront/store-interactions";
import { ProductCard } from "@/components/storefront/product-card";
import { ConnectedCollectionActions, ConnectedProductCard } from "@/components/storefront/connected-product-card";
import { formatPrice } from "@/lib/catalog";
import { getCatalogData, getCatalogSourceNotice } from "@/lib/catalog-repository";
import { listPublishedProductReviews } from "@/lib/reviews/data";
import { getServerDataMode } from "@/lib/server/data-mode";
import { createSupabaseServerClient } from "@/lib/supabase/server";

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
  const related = data.products.filter((item) => item.id !== product.id && (item.category === product.category || item.featured)).slice(0, 4);
  const sourceNotice = getCatalogSourceNotice(data.source);
  const connected = data.source === "supabase" && getServerDataMode() === "supabase";
  const supabase = connected ? await createSupabaseServerClient() : null;
  const publishedReviews = connected && supabase
    ? await listPublishedProductReviews(supabase, product.id)
    : null;
  const opinionsHref = `/producto/${product.slug}/opiniones`;

  return (
    <main className="page-wrap product-page">
      <nav className="eyebrow" aria-label="Ruta de navegación"><Link href="/">INICIO</Link><span>/</span><Link href="/catalogo">CATÁLOGO</Link><span>/</span><span>{product.category.toUpperCase()}</span></nav>
      {sourceNotice && <p className="page-intro" role="status">{sourceNotice}</p>}
      <div className="product-detail-top">
        <div className="product-detail-image">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {product.image ? <img src={product.image} alt={product.imageAlt} fetchPriority="high" /> : <span className="product-photo-placeholder">Imagen no disponible</span>}
          <span className="detail-image-label">NODRIA SELECT · {product.sku}</span>
        </div>
        <section className="product-detail-copy" aria-labelledby="product-name">
          <p className="eyebrow">{product.brand} <span>·</span> {product.category}</p>
          <h1 id="product-name">{product.name}<span className="title-period">.</span></h1>
          <div className="detail-rating" aria-label="Opiniones del producto">
            <MessageCircle size={14} aria-hidden="true" />
            {data.source === "demo" ? <span>Consulta las opiniones</span> : !publishedReviews?.ok ? <span>Opiniones no disponibles</span> : publishedReviews.data.total === 0 ? <span>Sin opiniones publicadas</span> : <span>{publishedReviews.data.total} {publishedReviews.data.total === 1 ? "opinión publicada" : "opiniones publicadas"}</span>}
            <Link href={opinionsHref}>Leer opiniones y opinar</Link>
          </div>
          <p className="detail-summary">{product.summary} Elegido por nuestro equipo y acompañado por soporte técnico especializado.</p>
          <div className="detail-price-line"><strong>{formatPrice(product.price)}</strong>{product.previousPrice !== undefined && <del>{formatPrice(product.previousPrice)}</del>}<span>IVA incluido</span></div>
          {data.source === "demo" ? <><div className="detail-availability"><i /> {product.stock > 0 ? `Disponible · ${product.stock} unidades en stock` : "Sin stock disponible"}</div><ProductActions product={product} /></> : <><div className="detail-availability">Disponibilidad por confirmar</div><p className="detail-summary">La tienda no publica unidades exactas de inventario; la compra desde el catálogo conectado aún no está habilitada.</p><ConnectedCollectionActions product={product} /><p className="page-intro">Favoritos y comparativas se guardan solo en este navegador.</p></>}
          <div className="detail-trust"><span><Truck size={14} /> Entrega en 24–48 h</span><span><ShieldCheck size={14} /> 3 años de garantía</span><span><RotateCcw size={14} /> 30 días para devolver</span></div>
          <div className="product-specs">{product.specifications.map((spec) => <div className="product-spec" key={spec.label}><span>{spec.label}</span><strong>{spec.value}</strong></div>)}</div>
        </section>
      </div>
      <section className="detail-content"><p className="eyebrow">UNA ELECCIÓN INFORMADA</p><h2>Diseñado para durar.</h2><p>{product.summary} En NODRIA revisamos cada referencia por calidad, compatibilidad y soporte. Si tienes dudas antes de comprar, nuestro equipo técnico puede ayudarte a elegir la configuración adecuada para tu caso.</p><p className="product-assurance-note"><Check size={14} /> Producto nuevo, con garantía oficial y asistencia posventa de NODRIA.</p></section>
      <section className="related-section"><div className="section-heading-row"><div><p className="eyebrow">TAMBIÉN PUEDE INTERESARTE</p><h2>Más de nuestra selección.</h2></div><Link className="section-link" href="/catalogo">Ver catálogo <ArrowRight size={14} /></Link></div><div className="product-grid">{related.map((item, index) => data.source === "demo" ? <ProductCard key={item.id} product={item} index={index} showRating={false} /> : <ConnectedProductCard key={item.id} product={item} index={index} />)}</div></section>
    </main>
  );
}

export default function ProductPage(props: PageProps<"/producto/[slug]">) {
  return <Suspense fallback={<main className="page-wrap product-page"><p className="eyebrow">NODRIA · PRODUCTO</p><div className="empty-state">Cargando ficha…</div></main>}><ProductContent params={props.params} /></Suspense>;
}
