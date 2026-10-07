"use client";

import { Check, Heart, ShoppingBag } from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import type { Product } from "@/lib/catalog";
import { toPcBuilderCartLines, type PcBuilderCatalogComponent } from "@/lib/pc-builder";

export type CartLine = { id: string; variantId?: string; slug?: string; name: string; price: number; image?: string; sku?: string; quantity: number; type: "product" | "builder" };
export const CART_KEY = "nodria.cart.v1";
export const FAVORITES_KEY = "nodria.favorites.v1";
export const COMPARE_KEY = "nodria.compare.v1";

export function readCart(): CartLine[] {
  if (typeof window === "undefined") return [];
  try {
    const value: unknown = JSON.parse(window.localStorage.getItem(CART_KEY) ?? "[]");
    if (!Array.isArray(value)) return [];
    return value.filter((item): item is Record<string, unknown> => typeof item === "object" && item !== null).flatMap((item) => {
      if (typeof item.id !== "string" || typeof item.name !== "string" || typeof item.price !== "number" || typeof item.quantity !== "number") return [];
      return [{ id: item.id, name: item.name, price: item.price, quantity: Math.max(1, Math.min(99, Math.floor(item.quantity))), type: item.type === "builder" ? "builder" as const : "product" as const, ...(typeof item.variantId === "string" ? { variantId: item.variantId } : {}), ...(typeof item.slug === "string" ? { slug: item.slug } : {}), ...(typeof item.sku === "string" ? { sku: item.sku } : {}), ...(typeof item.image === "string" ? { image: item.image } : {}) }];
    });
  } catch { return []; }
}

function publishCart(lines: CartLine[]) {
  window.localStorage.setItem(CART_KEY, JSON.stringify(lines));
  window.dispatchEvent(new CustomEvent("nodria:cart"));
}

export function clearCart() { publishCart([]); }

export function addToCart(product: Product, quantity = 1) {
  const lines = readCart();
  const existing = lines.find((line) => line.id === product.id);
  if (existing) existing.quantity = Math.min(existing.quantity + quantity, Math.max(1, product.stock));
  else lines.push({ type: "product", id: product.id, slug: product.slug, name: product.name, price: product.price, image: product.image, sku: product.sku, quantity: Math.min(quantity, Math.max(1, product.stock)) });
  publishCart(lines);
}

export function addComponentsToCart(components: PcBuilderCatalogComponent[]) {
  const lines = readCart();
  for (const component of toPcBuilderCartLines(components)) {
    const existing = lines.find((line) => line.variantId === component.variantId);
    if (existing) existing.quantity += 1;
    else lines.push(component);
  }
  publishCart(lines);
}

function readFavorites(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const value: unknown = JSON.parse(window.localStorage.getItem(FAVORITES_KEY) ?? "[]");
    return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
  } catch { return []; }
}

function emitFavorites(ids: string[]) {
  window.localStorage.setItem(FAVORITES_KEY, JSON.stringify(ids));
  window.dispatchEvent(new CustomEvent("nodria:favorites"));
}

export function CartLink() {
  const [count, setCount] = useState(0);
  const [announcement, setAnnouncement] = useState("");
  const initialized = useRef(false);
  useEffect(() => {
    const update = () => {
      const nextCount = readCart().reduce((total, line) => total + line.quantity, 0);
      setCount(nextCount);
      if (initialized.current) {
        setAnnouncement(`Carrito actualizado: ${nextCount} ${nextCount === 1 ? "artículo" : "artículos"}.`);
      } else {
        initialized.current = true;
      }
    };
    update();
    window.addEventListener("nodria:cart", update);
    window.addEventListener("storage", update);
    return () => { window.removeEventListener("nodria:cart", update); window.removeEventListener("storage", update); };
  }, []);
  return <>
    <Link aria-label={`Carrito, ${count} ${count === 1 ? "artículo" : "artículos"}`} className="header-cart" href="/carrito">
      <ShoppingBag aria-hidden="true" size={18} strokeWidth={1.7} />
      <span aria-hidden="true" className="header-cart-label">Carrito</span>
      <span aria-hidden="true" className="cart-count">{count}</span>
    </Link>
    <span aria-atomic="true" aria-live="polite" className="sr-only" role="status">{announcement}</span>
  </>;
}

export function ProductActions({ product, compact = false }: { product: Product; compact?: boolean }) {
  const [saved, setSaved] = useState(false);
  const [added, setAdded] = useState(false);
  const [compared, setCompared] = useState(false);

  useEffect(() => {
    const sync = () => setSaved(readFavorites().includes(product.id));
    sync();
    window.addEventListener("nodria:favorites", sync);
    window.addEventListener("storage", sync);
    return () => { window.removeEventListener("nodria:favorites", sync); window.removeEventListener("storage", sync); };
  }, [product.id]);

  const toggleFavorite = () => {
    const current = readFavorites();
    emitFavorites(current.includes(product.id) ? current.filter((id) => id !== product.id) : [...current, product.id]);
    setSaved(!current.includes(product.id));
  };

  const toggleCompare = () => {
    let ids: string[] = [];
    try {
      const value: unknown = JSON.parse(window.localStorage.getItem(COMPARE_KEY) ?? "[]");
      if (Array.isArray(value)) ids = value.filter((item): item is string => typeof item === "string");
    } catch { ids = []; }
    const next = ids.includes(product.id) ? ids.filter((id) => id !== product.id) : ids.length < 4 ? [...ids, product.id] : ids;
    window.localStorage.setItem(COMPARE_KEY, JSON.stringify(next));
    setCompared(next.includes(product.id));
    window.dispatchEvent(new CustomEvent("nodria:compare"));
  };

  return (
    <div className={`product-actions${compact ? " product-actions--compact" : ""}`}>
      <button className="button button--dark add-button" type="button" disabled={product.stock < 1} onClick={() => { addToCart(product); setAdded(true); window.setTimeout(() => setAdded(false), 1700); }}>
        {added ? <Check size={16} /> : <ShoppingBag size={16} />}
        {product.stock < 1 ? "Agotado" : added ? "Añadido" : "Añadir al carrito"}
      </button>
      <button aria-label={saved ? "Quitar de favoritos" : "Guardar en favoritos"} aria-pressed={saved} className={`icon-button${saved ? " is-active" : ""}`} type="button" onClick={toggleFavorite}><Heart size={17} fill={saved ? "currentColor" : "none"} /></button>
      {!compact && <button aria-pressed={compared} className={`compare-mini${compared ? " is-active" : ""}`} type="button" onClick={toggleCompare}>{compared ? "En comparador" : "Comparar"}</button>}
    </div>
  );
}

export function CartPage() {
  const [lines, setLines] = useState<CartLine[]>([]);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const update = () => { setLines(readCart()); setReady(true); };
    update();
    window.addEventListener("nodria:cart", update);
    window.addEventListener("storage", update);
    return () => { window.removeEventListener("nodria:cart", update); window.removeEventListener("storage", update); };
  }, []);
  const subtotal = lines.reduce((total, line) => total + line.price * line.quantity, 0);
  const changeQuantity = (id: string, quantity: number) => publishCart(lines.map((line) => line.id === id ? { ...line, quantity } : line).filter((line) => line.quantity > 0));
  const emptyCart = () => publishCart([]);

  if (!ready) return <main className="page-wrap"><p className="eyebrow">TU SELECCIÓN</p><h1 className="page-title">Tu carrito</h1><div className="empty-state">Preparando tu selección…</div></main>;
  return (
    <main className="page-wrap cart-page">
      <p className="eyebrow">TU SELECCIÓN · {lines.reduce((total, line) => total + line.quantity, 0)} ARTÍCULOS</p>
      <h1 className="page-title">Tu carrito<span className="title-period">.</span></h1>
      {lines.length === 0 ? <div className="empty-state"><span className="empty-mark"><ShoppingBag size={26} /></span><h2>Empieza por algo que te inspire.</h2><p>Tu selección se guarda en este navegador mientras exploras NODRIA.</p><Link className="button button--dark" href="/catalogo">Explorar tecnología</Link></div> : (
        <div className="cart-layout">
          <section className="cart-lines" aria-label="Artículos del carrito">
            {lines.map((line) => <article className="cart-line" key={line.id}>
              {line.image ? <Image src={line.image} alt="" width={88} height={88} unoptimized /> : <span className="cart-line-image-fallback" aria-hidden="true"><ShoppingBag size={21} /></span>}
              <div className="cart-line-info"><span className="mono-label">{line.sku ?? "CONFIGURACIÓN NODRIA"}</span>{line.slug ? <Link href={`/producto/${line.slug}`}><h2>{line.name}</h2></Link> : <Link href="/configurador"><h2>{line.name}</h2></Link>}<span className="stock-status"><i /> {line.type === "builder" ? "Variante del catálogo · disponibilidad confirmada en checkout" : "Disponible para envío"}</span></div>
              <div className="quantity-control" aria-label={`Cantidad de ${line.name}`}><button aria-label="Reducir cantidad" type="button" onClick={() => changeQuantity(line.id, line.quantity - 1)}>−</button><span>{line.quantity}</span><button aria-label="Aumentar cantidad" type="button" onClick={() => changeQuantity(line.id, line.quantity + 1)}>+</button></div>
              <strong className="cart-line-price">{new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR", maximumFractionDigits: 2 }).format(line.price * line.quantity)}</strong>
              <button className="remove-line" type="button" onClick={() => changeQuantity(line.id, 0)}>Eliminar</button>
            </article>)}
            <button className="text-button clear-cart" onClick={emptyCart} type="button">Vaciar carrito</button>
          </section>
          <aside className="cart-summary"><span className="mono-label">RESUMEN DEL PEDIDO</span><div><span>Subtotal (IVA incl.)</span><strong>{new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR", maximumFractionDigits: 2 }).format(subtotal)}</strong></div><div><span>Envío</span><strong>{subtotal >= 100 ? "Gratis" : "Calculado"}</strong></div><p>Impuestos incluidos en los precios. El envío se confirma antes de finalizar.</p><div className="summary-total"><span>Total estimado</span><strong>{new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR", maximumFractionDigits: 2 }).format(subtotal)}</strong></div><Link className="button button--accent checkout-button" href="/checkout">Continuar al pago <span>→</span></Link><span className="checkout-assurance">Pago seguro · Datos de tarjeta simulados</span></aside>
        </div>
      )}
    </main>
  );
}
