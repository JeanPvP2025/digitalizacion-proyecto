"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Check, ExternalLink, ShoppingCart } from "lucide-react";
import { formatPrice } from "@/lib/catalog";
import { addToCart } from "@/components/storefront/store-interactions";
import type { ChatbotProductRecommendation } from "@/lib/chatbot/types";
import styles from "./chatbot.module.css";

type ChatbotProductCardProps = {
  item: ChatbotProductRecommendation;
};

export function ChatbotProductCard({ item }: ChatbotProductCardProps) {
  const { product, reason } = item;
  const [added, setAdded] = useState(false);
  const [imgError, setImgError] = useState(false);

  const handleAddToCart = () => {
    // Reconstruct Product object required by addToCart
    const fullProduct = {
      id: product.id,
      slug: product.slug,
      sku: product.sku,
      name: product.name,
      category: product.category,
      brand: product.brand,
      price: product.price,
      stock: product.stock,
      image: product.image,
      imageAlt: product.imageAlt,
      summary: product.summary,
      rating: 4.8,
      reviewCount: 12,
      specifications: product.keySpecs ?? [],
    };

    addToCart(fullProduct, 1);
    setAdded(true);
    setTimeout(() => setAdded(false), 2500);
  };

  return (
    <article className={styles.productCard}>
      <div className={styles.productCardMedia}>
        {!imgError && product.image ? (
          <Image
            src={product.image}
            alt={product.imageAlt || product.name}
            width={72}
            height={72}
            className={styles.productCardImage}
            onError={() => setImgError(true)}
            unoptimized
          />
        ) : (
          <div className={styles.productCardPlaceholder}>
            <span>{product.brand.slice(0, 3).toUpperCase()}</span>
          </div>
        )}
      </div>

      <div className={styles.productCardContent}>
        <div className={styles.productCardHeader}>
          <span className={styles.productCardBrand}>{product.brand}</span>
          <span className={styles.productCardPrice}>{formatPrice(product.price)}</span>
        </div>

        <h4 className={styles.productCardTitle}>
          <Link href={`/producto/${product.slug}`} className={styles.productCardLink}>
            {product.name}
          </Link>
        </h4>

        {reason && <p className={styles.productCardReason}>💡 {reason}</p>}

        {product.keySpecs && product.keySpecs.length > 0 && (
          <div className={styles.productCardSpecs}>
            {product.keySpecs.slice(0, 2).map((spec, i) => (
              <span key={i} className={styles.specTag}>
                {spec.label}: {spec.value}
              </span>
            ))}
          </div>
        )}

        <div className={styles.productCardActions}>
          <button
            type="button"
            onClick={handleAddToCart}
            className={`${styles.addToCartBtn} ${added ? styles.addToCartBtnSuccess : ""}`}
            disabled={product.stock <= 0}
            aria-label={added ? "¡Añadido!" : `Añadir ${product.name} al carrito`}
          >
            {added ? (
              <>
                <Check size={14} className={styles.btnIcon} />
                <span>¡Añadido!</span>
              </>
            ) : (
              <>
                <ShoppingCart size={14} className={styles.btnIcon} />
                <span>{product.stock > 0 ? "Añadir al carrito" : "Agotado"}</span>
              </>
            )}
          </button>

          <Link href={`/producto/${product.slug}`} className={styles.detailsBtn} title="Ver detalles del producto">
            <ExternalLink size={13} />
            <span className="sr-only">Ver {product.name}</span>
          </Link>
        </div>
      </div>
    </article>
  );
}
