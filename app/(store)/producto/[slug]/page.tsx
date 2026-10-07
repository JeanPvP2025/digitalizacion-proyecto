import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ArrowRight, ArrowUpRight, Check, RotateCcw, ShieldCheck, Star, Truck } from "lucide-react";
import { ProductActions } from "@/components/storefront/store-interactions";
import { ProductCard } from "@/components/storefront/product-card";
import { formatPrice, type Product } from "@/lib/catalog";
import { getCatalogData, getCatalogSourceNotice } from "@/lib/catalog-repository";

export async function generateMetadata({ params }: PageProps<"/producto/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const data = await getCatalogData();
  const product = data.source === "error" ? undefined : data.products.find((item) => item.slug === slug);
  if (data.source === "error") return { title: "Catálogo no disponible" };
  if (!product) return { title: "Producto no encontrado" };
  return { title: product.name, description: product.summary, openGraph: { title: `${product.name} | NODRIA`, description: product.summary, ...(product.image ? { images: [product.image] } : {}) } };
}

function ConnectedRelatedCard({ product }: { product: Product }) {
  return (
    <article className="product-card">
      <Link className="product-image-link" href={`/producto/${product.slug}`} aria-label={`Ver ${product.name}`}>
        <div className="product-photo-wrap">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {product.image ? <img className="product-photo" src={product.image} alt={product.imageAlt} loading="lazy" /> : <span className="product-photo-placeholder">Imagen no disponible</span>}
          {product.badge && <span className="product-badge">{product.badge}</span>}
          <span className="product-open"><ArrowUpRight size={16} /></span>
        </div>
      </Link>
      <div className="product-card-meta"><span>{product.category}</span><span className="product-rating"><Star size={12} fill="currentColor" /> {product.rating.toFixed(1)} <small>({product.reviewCount})</small></span></div>
      <Link className="product-card-title" href={`/producto/${product.slug}`}><h3>{product.name}</h3></Link>
      <div className="product-card-price"><strong>{formatPrice(product.price)}</strong>{product.previousPrice !== undefined && <del>{formatPrice(product.previousPrice)}</del>}</div>
      <div className="product-card-stock">Disponibilidad por confirmar</div>
    </article>
  );
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
          <div className="detail-rating"><Star size={13} fill="currentColor" /> {product.rating.toFixed(1)} <span>({product.reviewCount} valoraciones)</span><a href="#reviews">Ver reseñas</a></div>
          <p className="detail-summary">{product.summary} Elegido por nuestro equipo y acompañado por soporte técnico especializado.</p>
          <div className="detail-price-line"><strong>{formatPrice(product.price)}</strong>{product.previousPrice !== undefined && <del>{formatPrice(product.previousPrice)}</del>}<span>IVA incluido</span></div>
          {data.source === "demo" ? <><div className="detail-availability"><i /> {product.stock > 0 ? `Disponible · ${product.stock} unidades en stock` : "Sin stock disponible"}</div><ProductActions product={product} /></> : <><div className="detail-availability">Disponibilidad por confirmar</div><p className="detail-summary">La tienda no publica unidades exactas de inventario; la compra desde el catálogo conectado aún no está habilitada.</p></>}
          <div className="detail-trust"><span><Truck size={14} /> Entrega en 24–48 h</span><span><ShieldCheck size={14} /> 3 años de garantía</span><span><RotateCcw size={14} /> 30 días para devolver</span></div>
          <div className="product-specs">{product.specifications.map((spec) => <div className="product-spec" key={spec.label}><span>{spec.label}</span><strong>{spec.value}</strong></div>)}</div>
        </section>
      </div>
      <section className="detail-content"><p className="eyebrow">UNA ELECCIÓN INFORMADA</p><h2>Diseñado para durar.</h2><p>{product.summary} En NODRIA revisamos cada referencia por calidad, compatibilidad y soporte. Si tienes dudas antes de comprar, nuestro equipo técnico puede ayudarte a elegir la configuración adecuada para tu caso.</p><p className="product-assurance-note"><Check size={14} /> Producto nuevo, con garantía oficial y asistencia posventa de NODRIA.</p></section>
      <section className="related-section"><div className="section-heading-row"><div><p className="eyebrow">TAMBIÉN PUEDE INTERESARTE</p><h2>Más de nuestra selección.</h2></div><Link className="section-link" href="/catalogo">Ver catálogo <ArrowRight size={14} /></Link></div><div className="product-grid">{related.map((item, index) => data.source === "demo" ? <ProductCard key={item.id} product={item} index={index} /> : <ConnectedRelatedCard key={item.id} product={item} />)}</div></section>
      <section className="proof-section" id="reviews"><div className="section-heading-row"><div><p className="eyebrow">COMUNIDAD NODRIA</p><h2>Opiniones con contexto.</h2><p>Las valoraciones se muestran como datos de demostración y no implican compras reales.</p></div></div><div className="review-detail-card"><div className="proof-stars">{Array.from({ length: 5 }).map((_, index) => <Star key={index} size={13} fill="currentColor" />)}</div><blockquote>“Una elección que encaja con lo que necesitaba. El equipo me explicó qué características sí iban a marcar una diferencia en mi día a día.”</blockquote><div className="proof-author"><span className="proof-avatar">EV</span><div><strong>Elena V.</strong><small>Compra verificada · demostración</small></div></div></div></section>
    </main>
  );
}

export default function ProductPage(props: PageProps<"/producto/[slug]">) {
  return <Suspense fallback={<main className="page-wrap product-page"><p className="eyebrow">NODRIA · PRODUCTO</p><div className="empty-state">Cargando ficha…</div></main>}><ProductContent params={props.params} /></Suspense>;
}
