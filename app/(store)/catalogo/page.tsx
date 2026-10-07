import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ArrowRight, ArrowUpRight, Search, Star } from "lucide-react";
import { ProductCard } from "@/components/storefront/product-card";
import { formatPrice, type Product } from "@/lib/catalog";
import { getCatalogData, getCatalogSourceNotice } from "@/lib/catalog-repository";
import { rankCatalogProducts } from "@/lib/search";

export const metadata: Metadata = { title: "Catálogo", description: "Explora ordenadores, componentes, monitores, redes y más en NODRIA." };

type SearchParams = Promise<{ q?: string | string[]; categoria?: string | string[]; orden?: string | string[] }>;

function first(value?: string | string[]) { return Array.isArray(value) ? value[0] : value; }
function slug(value: string) { return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""); }

function ConnectedProductCard({ product, index }: { product: Product; index: number }) {
  return (
    <article className="product-card" style={{ animationDelay: `${index * 70}ms` }}>
      <Link className="product-image-link" href={`/producto/${product.slug}`} aria-label={`Ver ${product.name}`}>
        <div className="product-photo-wrap">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {product.image ? <img className="product-photo" src={product.image} alt={product.imageAlt} loading={index > 2 ? "lazy" : "eager"} /> : <span className="product-photo-placeholder">Imagen no disponible</span>}
          {product.badge && <span className="product-badge">{product.badge}</span>}
          <span className="product-open"><ArrowUpRight size={16} /></span>
        </div>
      </Link>
      <div className="product-card-meta"><span>{product.category}</span><span className="product-rating"><Star size={12} fill="currentColor" /> {product.rating.toFixed(1)} <small>({product.reviewCount})</small></span></div>
      <Link className="product-card-title" href={`/producto/${product.slug}`}><h3>{product.name}</h3></Link>
      <div className="product-card-price"><strong>{formatPrice(product.price)}</strong>{product.previousPrice !== undefined && <del>{formatPrice(product.previousPrice)}</del>}</div>
      <div className="product-card-stock">Disponibilidad por confirmar</div>
      <p className="product-card-stock">El catálogo público no muestra unidades exactas de inventario.</p>
    </article>
  );
}

async function CatalogResults({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const query = first(params.q)?.trim() ?? "";
  const category = first(params.categoria) ?? "";
  const sort = first(params.orden) ?? "recomendados";
  const data = await getCatalogData();
  const { products: allProducts, categories } = data.source === "error" ? { products: [], categories: [] } : data;
  let products = rankCatalogProducts(allProducts, query).filter((product) => {
    const matchesCategory = !category || categories.some((item) => item.slug === category && item.name === product.category);
    return matchesCategory;
  });
  if (sort === "precio-asc") products = [...products].sort((a, b) => a.price - b.price);
  if (sort === "precio-desc") products = [...products].sort((a, b) => b.price - a.price);
  if (sort === "mejor-valorados") products = [...products].sort((a, b) => b.rating - a.rating);

  if (data.source === "error") {
    return <main className="page-wrap catalog-page"><nav className="eyebrow" aria-label="Ruta de navegación"><Link href="/">INICIO</Link><span>/</span><span>CATÁLOGO</span></nav><h1 className="page-title">Catálogo no disponible<span className="title-period">.</span></h1><p className="page-intro" role="alert">{data.message}</p><Link className="button button--dark" href="/catalogo">Volver a intentarlo</Link></main>;
  }
  const sourceNotice = getCatalogSourceNotice(data.source);

  return (
    <main className="page-wrap catalog-page">
      <nav className="eyebrow" aria-label="Ruta de navegación"><Link href="/">INICIO</Link><span>/</span><span>CATÁLOGO</span></nav>
      <h1 className="page-title">Tecnología para lo que sigue<span className="title-period">.</span></h1>
      <p className="page-intro">Una selección cuidada de equipos, componentes y soluciones para cada forma de trabajar, crear y conectar.</p>
      {sourceNotice && <p className="page-intro" role="status">{sourceNotice}</p>}
      <div className="catalog-toolbar">
        <form action="/catalogo" method="get">
          <label className="sr-only" htmlFor="catalog-search">Buscar producto, referencia o característica</label>
          <input id="catalog-search" name="q" type="search" placeholder="Buscar producto, SKU o característica" defaultValue={query} />
          {category && <input type="hidden" name="categoria" value={category} />}
          <label className="sr-only" htmlFor="catalog-sort">Ordenar productos</label>
          <select id="catalog-sort" name="orden" defaultValue={sort}>
            <option value="recomendados">Orden recomendado</option>
            <option value="precio-asc">Precio: menor a mayor</option>
            <option value="precio-desc">Precio: mayor a menor</option>
            <option value="mejor-valorados">Mejor valorados</option>
          </select>
          <button aria-label="Aplicar búsqueda y orden" className="icon-button" type="submit"><Search size={16} /></button>
        </form>
        <span className="catalog-result-count">{products.length} {products.length === 1 ? "resultado" : "resultados"}</span>
      </div>
      <div className="catalog-layout">
        <aside className="catalog-sidebar" aria-label="Filtrar por categoría">
          <div className="filter-block">
            <h2>Categoría</h2>
            <Link className={`filter-option${!category ? " filter-option--selected" : ""}`} href={query ? `/catalogo?q=${encodeURIComponent(query)}` : "/catalogo"}><span className="filter-check">{!category ? "✓" : ""}</span> Todas <small>{allProducts.length}</small></Link>
            {categories.map((item) => {
              const categorySlug = item.slug || slug(item.name);
              const count = allProducts.filter((product) => product.category === item.name).length;
              return <Link className={`filter-option${category === categorySlug ? " filter-option--selected" : ""}`} href={`/catalogo?categoria=${categorySlug}${query ? `&q=${encodeURIComponent(query)}` : ""}`} key={item.id}><span className="filter-check">{category === categorySlug ? "✓" : ""}</span>{item.name}<small>{count}</small></Link>;
            })}
          </div>
          <div className="filter-block"><h2>Confianza NODRIA</h2><p className="filter-note">Cada producto pasa por las manos de un especialista antes de llegar a nuestra selección.</p><Link className="filter-help-link" href="/servicios">Cómo elegimos <ArrowRight size={12} /></Link></div>
        </aside>
        <section className="catalog-results" aria-label="Resultados del catálogo">
          {products.length > 0 ? <div className="catalog-product-grid">{products.map((product, index) => data.source === "demo" ? <ProductCard key={product.id} product={product} index={index} /> : <ConnectedProductCard key={product.id} product={product} index={index} />)}</div> : <div className="catalog-empty"><strong>No encontramos lo que buscas.</strong><p>Prueba con un nombre, referencia o especificación diferente.</p><Link href="/catalogo">Limpiar búsqueda</Link></div>}
        </section>
      </div>
    </main>
  );
}

export default function CatalogPage({ searchParams }: { searchParams: SearchParams }) {
  return <Suspense fallback={<main className="page-wrap catalog-page"><p className="eyebrow">NODRIA · CATÁLOGO</p><div className="empty-state">Cargando catálogo…</div></main>}><CatalogResults searchParams={searchParams} /></Suspense>;
}
