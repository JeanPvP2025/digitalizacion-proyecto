"use client";

import Link from "next/link";
import Image from "next/image";
import { ArrowUpRight, Star } from "lucide-react";
import { formatPrice, type Product } from "@/lib/catalog";
import { ProductActions } from "@/components/storefront/store-interactions";

export function ConnectedProductCard({ product, index = 0 }: { product: Product; index?: number }) {
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
      <div className="product-card-stock">{product.stock > 0 ? `Disponible · ${product.stock} unidades` : "Agotado"}</div>
      <ProductActions product={product} compact />
    </article>
  );
}
