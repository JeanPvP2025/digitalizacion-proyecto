import Link from "next/link";
import Image from "next/image";
import { ArrowUpRight } from "lucide-react";
import type { Product } from "@/lib/catalog";
import { formatPrice } from "@/lib/catalog";
import { ProductActions } from "@/components/storefront/store-interactions";

export function ProductCard({ product, index = 0 }: { product: Product; index?: number }) {
  const checkedAt = product.priceReference?.checkedAt
    ? new Intl.DateTimeFormat("es-ES", { dateStyle: "medium", timeZone: "UTC" }).format(new Date(`${product.priceReference.checkedAt}T00:00:00Z`))
    : null;
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
          <span className="product-open"><ArrowUpRight size={16} /></span>
        </div>
      </Link>
      <div className="product-card-meta"><span>{product.category}</span></div>
      <Link className="product-card-title" href={`/producto/${product.slug}`}><h3>{product.name}</h3></Link>
      <div className="product-card-price"><strong>{formatPrice(product.price)}</strong></div>
      {product.priceReference && <a className="product-card-reference" href={product.priceReference.productUrl} target="_blank" rel="noopener noreferrer">Precio de referencia · PcComponentes{checkedAt ? ` · ${checkedAt}` : ""}</a>}
      <div className="product-card-stock">Disponibilidad comercial no conectada</div>
      <ProductActions product={product} compact />
    </article>
  );
}
