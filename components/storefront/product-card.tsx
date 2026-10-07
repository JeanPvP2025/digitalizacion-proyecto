import Link from "next/link";
import Image from "next/image";
import { ArrowUpRight, Star } from "lucide-react";
import type { Product } from "@/lib/catalog";
import { formatPrice } from "@/lib/catalog";
import { ProductActions } from "@/components/storefront/store-interactions";

export function ProductCard({ product, index = 0, showRating = true }: { product: Product; index?: number; showRating?: boolean }) {
  return (
    <article className="product-card" style={{ animationDelay: `${index * 70}ms` }}>
      <Link className="product-image-link" href={`/producto/${product.slug}`}>
        <div className="product-photo-wrap">
          <Image
            className="product-photo"
            src={product.image}
            alt={product.imageAlt}
            fill
            sizes="(max-width: 760px) 46vw, (max-width: 1100px) 36vw, 24vw"
            loading={index > 2 ? "lazy" : "eager"}
          />
          {product.badge && <span className="product-badge">DEMO · {product.badge}</span>}
          <span className="product-open"><ArrowUpRight size={16} /></span>
        </div>
      </Link>
      <div className="product-card-meta"><span>{product.category} · demo</span>{showRating && <span className="product-rating" aria-label={`Valoración de ejemplo: ${product.rating.toFixed(1)} de 5, ${product.reviewCount} reseñas ficticias`}><Star size={12} fill="currentColor" /> {product.rating.toFixed(1)} <small>({product.reviewCount}) · demo</small></span>}</div>
      <Link className="product-card-title" href={`/producto/${product.slug}`}><h3>{product.name}</h3></Link>
      <div className="product-card-price"><strong>Precio demo · {formatPrice(product.price)}</strong>{product.previousPrice && <del>{formatPrice(product.previousPrice)}</del>}</div>
      <div className="product-card-stock"><i /> {product.stock > 0 ? `Stock demo · ${product.stock} unidades` : "Sin stock en esta ficha demo"}</div>
      <ProductActions product={product} compact />
    </article>
  );
}
