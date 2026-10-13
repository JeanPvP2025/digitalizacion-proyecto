"use client";

import Link from "next/link";
import Image from "next/image";
import { ArrowUpRight, GitCompareArrows, Heart, Star } from "lucide-react";
import { useEffect, useState } from "react";
import { COMPARE_KEY, FAVORITES_KEY } from "@/components/storefront/store-interactions";
import { formatPrice, type Product } from "@/lib/catalog";

function readIds(key: string): string[] {
  try {
    const parsed: unknown = JSON.parse(window.localStorage.getItem(key) ?? "[]");
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : [];
  } catch {
    return [];
  }
}

function saveIds(key: string, ids: string[]) {
  try {
    window.localStorage.setItem(key, JSON.stringify(ids));
    return true;
  } catch {
    return false;
  }
}

export function ConnectedCollectionActions({ product }: { product: Product }) {
  const [saved, setSaved] = useState(false);
  const [compared, setCompared] = useState(false);
  const [compareCount, setCompareCount] = useState(0);
  const [announcement, setAnnouncement] = useState("");

  useEffect(() => {
    const sync = () => {
      const favoriteIds = readIds(FAVORITES_KEY);
      const compareIds = readIds(COMPARE_KEY);
      setSaved(favoriteIds.includes(product.id));
      setCompared(compareIds.includes(product.id));
      setCompareCount(compareIds.length);
    };
    sync();
    window.addEventListener("nodria:favorites", sync);
    window.addEventListener("nodria:compare", sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener("nodria:favorites", sync);
      window.removeEventListener("nodria:compare", sync);
      window.removeEventListener("storage", sync);
    };
  }, [product.id]);

  const toggleFavorite = () => {
    const current = readIds(FAVORITES_KEY);
    const next = current.includes(product.id)
      ? current.filter((id) => id !== product.id)
      : [...current, product.id];
    if (!saveIds(FAVORITES_KEY, next)) {
      setAnnouncement("No se pudieron guardar los favoritos en este navegador.");
      return;
    }
    window.dispatchEvent(new CustomEvent("nodria:favorites"));
    setSaved(next.includes(product.id));
    setAnnouncement(next.includes(product.id) ? "Añadido a favoritos." : "Eliminado de favoritos.");
  };

  const toggleCompare = () => {
    const current = readIds(COMPARE_KEY);
    if (!current.includes(product.id) && current.length >= 4) {
      setAnnouncement("El comparador admite hasta cuatro productos.");
      return;
    }
    const next = current.includes(product.id)
      ? current.filter((id) => id !== product.id)
      : [...current, product.id];
    if (!saveIds(COMPARE_KEY, next)) {
      setAnnouncement("No se pudo guardar la comparativa en este navegador.");
      return;
    }
    window.dispatchEvent(new CustomEvent("nodria:compare"));
    setCompared(next.includes(product.id));
    setCompareCount(next.length);
    setAnnouncement(next.includes(product.id) ? "Añadido al comparador." : "Eliminado del comparador.");
  };

  const compareFull = !compared && compareCount >= 4;

  return (
    <div className="product-actions product-actions--compact">
      <button
        aria-label={saved ? `Quitar ${product.name} de favoritos` : `Guardar ${product.name} en favoritos`}
        aria-pressed={saved}
        className={`icon-button${saved ? " is-active" : ""}`}
        onClick={toggleFavorite}
        type="button"
      >
        <Heart aria-hidden="true" fill={saved ? "currentColor" : "none"} size={16} />
      </button>
      <button
        aria-label={compareFull ? "El comparador admite hasta cuatro productos" : compared ? `Quitar ${product.name} del comparador` : `Añadir ${product.name} al comparador`}
        aria-pressed={compared}
        className={`compare-mini${compared ? " is-active" : ""}`}
        disabled={compareFull}
        onClick={toggleCompare}
        title={compareFull ? "El comparador admite hasta cuatro productos." : undefined}
        type="button"
      >
        <GitCompareArrows aria-hidden="true" size={13} /> {compared ? "En comparador" : "Comparar"}
      </button>
      <span aria-atomic="true" aria-live="polite" className="sr-only" role="status">{announcement}</span>
    </div>
  );
}

export function ConnectedProductCard({ product, index = 0 }: { product: Product; index?: number }) {
  const checkedAt = product.priceReference?.checkedAt
    ? new Intl.DateTimeFormat("es-ES", { dateStyle: "medium", timeZone: "UTC" }).format(new Date(`${product.priceReference.checkedAt}T00:00:00Z`))
    : null;
  return (
    <article className="product-card" style={{ animationDelay: `${index * 70}ms` }}>
      <Link className="product-image-link" href={`/producto/${product.slug}`}>
        <div className="product-photo-wrap">
          {product.image ? <Image className="product-photo" src={product.image} alt={product.imageAlt} fill sizes="(max-width: 760px) 46vw, (max-width: 1100px) 36vw, 24vw" loading={index > 2 ? "lazy" : "eager"} unoptimized /> : <span className="product-photo-placeholder">Imagen no disponible</span>}
          {product.badge && <span className="product-badge">{product.badge}</span>}
          <span className="product-open"><ArrowUpRight aria-hidden="true" size={16} /></span>
        </div>
      </Link>
      <div className="product-card-meta">
        <span>{product.category}</span>
        <span className="product-rating">
          {product.reviewCount > 0 ? <><Star aria-hidden="true" fill="currentColor" size={12} /> {product.rating.toFixed(1)} <small>({product.reviewCount})</small></> : <small>Sin valoraciones</small>}
        </span>
      </div>
      <Link className="product-card-title" href={`/producto/${product.slug}`}><h3>{product.name}</h3></Link>
      <div className="product-card-price"><strong>{formatPrice(product.price)}</strong></div>
      {product.priceReference && <p className="product-card-reference">Precio de referencia · {checkedAt}</p>}
      {product.priceReference && <a className="product-card-outbound" href={product.priceReference.productUrl} target="_blank" rel="noopener noreferrer">Ver ficha en PcComponentes <ArrowUpRight aria-hidden="true" size={12} /></a>}
      <div className="product-card-stock">Disponibilidad en NODRIA no conectada</div>
      <ConnectedCollectionActions product={product} />
    </article>
  );
}
