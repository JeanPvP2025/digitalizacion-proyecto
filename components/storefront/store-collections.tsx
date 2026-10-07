"use client";

import Link from "next/link";
import Image from "next/image";
import { ArrowRight, GitCompareArrows, Heart, Star } from "lucide-react";
import { useEffect, useState } from "react";
import { ProductCard } from "@/components/storefront/product-card";
import { COMPARE_KEY, FAVORITES_KEY } from "@/components/storefront/store-interactions";
import { demoProducts, formatPrice, type Product } from "@/lib/catalog";

function safeIds(key: string): string[] {
  try {
    const value: unknown = JSON.parse(window.localStorage.getItem(key) ?? "[]");
    return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
  } catch { return []; }
}

export function FavoritesPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [ready, setReady] = useState(false);
  const [announcement, setAnnouncement] = useState("Cargando tus favoritos.");
  useEffect(() => {
    const sync = () => {
      const nextProducts = demoProducts.filter((item) => safeIds(FAVORITES_KEY).includes(item.id));
      setProducts(nextProducts);
      setReady(true);
      setAnnouncement(`Tus favoritos se han cargado. ${nextProducts.length} ${nextProducts.length === 1 ? "producto" : "productos"}.`);
    };
    sync();
    window.addEventListener("nodria:favorites", sync);
    window.addEventListener("storage", sync);
    return () => { window.removeEventListener("nodria:favorites", sync); window.removeEventListener("storage", sync); };
  }, []);
  return <main className="page-wrap"><p className="eyebrow">TU ESPACIO · COLECCIÓN PERSONAL</p><h1 className="page-title">Tus favoritos<span className="title-period">.</span></h1><p className="page-intro">Guarda aquí los productos que quieres seguir explorando. La lista se conserva en este navegador.</p><p aria-atomic="true" aria-live="polite" className="sr-only" role="status">{announcement}</p>{!ready ? <div className="empty-state">Cargando tu selección…</div> : products.length ? <div className="product-grid collection-grid">{products.map((product, index) => <ProductCard key={product.id} product={product} index={index} />)}</div> : <div className="empty-state"><span className="empty-mark"><Heart size={24} /></span><h2>Guarda algo para volver a verlo.</h2><p>En cada producto encontrarás el icono de corazón. Tu colección permanece en este navegador.</p><Link className="button button--dark" href="/catalogo">Explorar catálogo <ArrowRight size={14} /></Link></div>}</main>;
}

export function ComparePage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [ready, setReady] = useState(false);
  const [announcement, setAnnouncement] = useState("Cargando la comparativa.");
  useEffect(() => {
    const sync = () => {
      const ids = safeIds(COMPARE_KEY);
      const nextProducts = demoProducts.filter((item) => ids.includes(item.id));
      setProducts(nextProducts);
      setReady(true);
      setAnnouncement(`La comparativa se ha actualizado. ${nextProducts.length} ${nextProducts.length === 1 ? "producto" : "productos"}.`);
    };
    sync();
    window.addEventListener("nodria:compare", sync);
    window.addEventListener("storage", sync);
    return () => { window.removeEventListener("nodria:compare", sync); window.removeEventListener("storage", sync); };
  }, []);
  const remove = (id: string) => {
    const next = safeIds(COMPARE_KEY).filter((value) => value !== id);
    window.localStorage.setItem(COMPARE_KEY, JSON.stringify(next));
    window.dispatchEvent(new CustomEvent("nodria:compare"));
  };
  const add = (id: string) => {
    const current = safeIds(COMPARE_KEY);
    if (current.length >= 4 || current.includes(id)) return;
    window.localStorage.setItem(COMPARE_KEY, JSON.stringify([...current, id]));
    window.dispatchEvent(new CustomEvent("nodria:compare"));
  };
  const attributes = [...new Set(products.flatMap((product) => product.specifications.map((spec) => spec.label)))];
  const sameCategory = products.length > 1 && products.every((product) => product.category === products[0].category);
  return (
    <main className="page-wrap compare-page">
      <p className="eyebrow">DECIDE CON CLARIDAD</p><h1 className="page-title">Comparador<span className="title-period">.</span></h1><p className="page-intro">Compara especificaciones propias de cada producto. Añade hasta cuatro y revisa diferencias sin perder el contexto.</p>
      <p aria-atomic="true" aria-live="polite" className="sr-only" role="status">{announcement}</p>
      {!ready ? <div className="empty-state">Cargando comparativa…</div> : products.length === 0 ? <div className="empty-state"><span className="empty-mark"><GitCompareArrows size={24} /></span><h2>Dos opciones. Una decisión mejor.</h2><p>Añade productos desde el catálogo con el botón “Comparar” y verás sus especificaciones en paralelo.</p><Link className="button button--dark" href="/catalogo">Elegir productos</Link></div> : <>
        {products.length > 1 && !sameCategory && <div className="comparison-notice">Estás comparando categorías diferentes. Cada producto conserva sus especificaciones; elige productos de la misma categoría para una comparación técnica directa.</div>}
        <div aria-label="Tabla comparativa de productos" className="compare-table-wrap" role="region" tabIndex={0}><table className="compare-table"><thead><tr><th scope="col">SELECCIÓN</th>{products.map((product) => <th key={product.id} scope="col"><Link href={`/producto/${product.slug}`}><Image src={product.image} alt={product.imageAlt} width={240} height={180} unoptimized /><strong>{product.name}</strong></Link><small>{formatPrice(product.price)}</small><button className="compare-remove" type="button" onClick={() => remove(product.id)}>Quitar</button></th>)}</tr></thead><tbody><tr><th scope="row">CATEGORÍA</th>{products.map((product) => <td key={product.id}>{product.category}</td>)}</tr><tr><th scope="row">VALORACIÓN</th>{products.map((product) => <td key={product.id}><span className="compare-rating"><Star size={12} fill="currentColor" /> {product.rating.toFixed(1)} · {product.reviewCount} reseñas</span></td>)}</tr>{attributes.map((attribute) => { const values = products.map((product) => product.specifications.find((spec) => spec.label === attribute)?.value ?? "—"); const distinct = new Set(values.filter((value) => value !== "—")).size > 1; return <tr key={attribute}><th scope="row">{attribute.toUpperCase()}</th>{products.map((product, index) => <td className={distinct && values[index] !== "—" ? "is-different" : ""} key={product.id}>{values[index]}</td>)}</tr>; })}<tr><th scope="row">DISPONIBILIDAD</th>{products.map((product) => <td key={product.id}>{product.stock > 0 ? `${product.stock} unidades disponibles` : "Agotado"}</td>)}</tr></tbody></table></div>
        <div className="compare-add-row" aria-label="Añadir otro producto"><span className="mono-label">AÑADIR A LA COMPARATIVA</span>{demoProducts.filter((product) => !products.some((selected) => selected.id === product.id)).slice(0, 5).map((product) => <button disabled={products.length >= 4} key={product.id} type="button" onClick={() => add(product.id)}>+ {product.name}</button>)}</div>
      </>}
    </main>
  );
}
