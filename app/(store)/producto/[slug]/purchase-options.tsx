"use client";

import { useState } from "react";
import Link from "next/link";
import type { Product } from "@/lib/catalog";
import type { DetailVariant } from "@/lib/content/product-editorial";
import { CART_KEY, readCart } from "@/components/storefront/store-interactions";
import { ConnectedCollectionActions } from "@/components/storefront/connected-product-card";
import styles from "./page.module.css";

export const detailPrice = (value: number) => new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR", maximumFractionDigits: 2 }).format(value);

export function PurchaseOptions({ product, variants, available }: { product: Product; variants: DetailVariant[]; available: boolean }) {
  const [variantId, setVariantId] = useState(() => variants.find((item) => item.sku === product.sku)?.id ?? variants[0]?.id ?? "");
  const [message, setMessage] = useState("");
  const variant = variants.find((item) => item.id === variantId);
  const add = () => {
    if (!available || !variant) return;
    try {
      const lines = readCart();
      const existing = lines.find((line) => line.variantId === variant.id);
      if (existing && existing.quantity >= 99) { setMessage("El carrito admite hasta 99 unidades por variante."); return; }
      if (existing) existing.quantity += 1;
      else lines.push({ id: `variant:${variant.id}`, variantId: variant.id, slug: product.slug, name: `${product.name} · ${variant.title}`, price: variant.price, image: product.image, sku: variant.sku, quantity: 1, type: "builder" });
      window.localStorage.setItem(CART_KEY, JSON.stringify(lines));
      window.dispatchEvent(new CustomEvent("nodria:cart"));
      setMessage(`${variant.title} añadido al carrito. Disponibilidad pendiente de validar en checkout.`);
    } catch { setMessage("No se pudo guardar el carrito en este navegador. Revisa sus permisos e inténtalo de nuevo."); }
  };
  return <div className={styles.purchase}>
    <label htmlFor="product-variant">Configuración publicada</label>
    {variants.length > 0 ? <select id="product-variant" value={variantId} onChange={(event) => { setVariantId(event.target.value); setMessage(""); }}>
      {variants.map((item) => <option key={item.id} value={item.id}>{item.title} · {detailPrice(item.price)}</option>)}
    </select> : <p>{available ? "Sin variantes activas para compra." : "No se pudieron cargar las variantes. Recarga la ficha para volver a intentarlo."}</p>}
    {variant && <><p className={styles.sku}>SKU · {variant.sku}</p><div className="detail-price-line"><strong>{detailPrice(variant.price)}</strong>{variant.previousPrice !== undefined && <del>{detailPrice(variant.previousPrice)}</del>}<span>EUR · precio publicado</span></div></>}
    <p className={styles.notice}>Disponibilidad por confirmar. El servidor comprueba precio y stock al confirmar el pedido demo. Añadir al carrito no reserva unidades.</p>
    <button className="button button--dark" type="button" disabled={!available || !variant} onClick={add}>Añadir al carrito</button>
    <Link className={styles.cartLink} href="/carrito">Ver carrito</Link>
    <p role="status" aria-live="polite" className={styles.notice}>{message}</p>
    <ConnectedCollectionActions product={product} />
    <p className={styles.notice}>Carrito, favoritos y comparativas se guardan en este navegador. Compra simulada; no se procesa dinero real.</p>
  </div>;
}
