"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { AlertCircle, ArrowRight, Check, LoaderCircle, ShieldCheck } from "lucide-react";
import { checkoutResponseSchema, type CheckoutResponse } from "@/lib/commerce/contracts";
import type { CheckoutMode } from "@/lib/commerce/mode";
import { clearCart, readCart, type CartLine } from "@/components/storefront/store-interactions";
import { toCheckoutCartItems } from "@/lib/pc-builder/cart";
import { formatPrice } from "@/lib/catalog";

const IDEMPOTENCY_STORAGE_KEY = "nodria.checkout.idempotency.v1";

type CheckoutCustomer = {
  name: string;
  email: string;
  phone: string;
  address: string;
  postalCode: string;
  city: string;
  province: string;
};

const money = formatPrice;

function cartFingerprint(lines: CartLine[]) {
  return JSON.stringify(lines.map(({ id, variantId, quantity }) => ({ id, variantId, quantity })).sort((left, right) => left.id.localeCompare(right.id)));
}

async function requestFingerprint(items: ReturnType<typeof toCheckoutCartItems>, customer: CheckoutCustomer) {
  if (!globalThis.crypto?.subtle) return null;
  const content = JSON.stringify({ items: [...items].sort((left, right) => ("variantId" in left ? left.variantId : left.productId).localeCompare("variantId" in right ? right.variantId : right.productId)), customer });
  const digest = await globalThis.crypto.subtle.digest("SHA-256", new TextEncoder().encode(content));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function getRequestIdempotencyKey(fingerprint: string | null, current: { fingerprint: string | null; key: string } | null) {
  if (current?.fingerprint === fingerprint) return current.key;
  if (fingerprint) {
    try {
      const stored: unknown = JSON.parse(window.sessionStorage.getItem(IDEMPOTENCY_STORAGE_KEY) ?? "null");
      if (typeof stored === "object" && stored !== null && "fingerprint" in stored && "key" in stored &&
          stored.fingerprint === fingerprint && typeof stored.key === "string") {
        return stored.key;
      }
    } catch {
      // A private browsing policy may disable session storage; the request can still use an in-memory key.
    }
  }

  const key = globalThis.crypto.randomUUID();
  if (fingerprint) {
    try { window.sessionStorage.setItem(IDEMPOTENCY_STORAGE_KEY, JSON.stringify({ fingerprint, key })); }
    catch { /* Keep the key in memory when browser storage is unavailable. */ }
  }
  return key;
}

function clearRequestIdempotencyKey(key: string) {
  try {
    const stored: unknown = JSON.parse(window.sessionStorage.getItem(IDEMPOTENCY_STORAGE_KEY) ?? "null");
    if (typeof stored === "object" && stored !== null && "key" in stored && stored.key === key) {
      window.sessionStorage.removeItem(IDEMPOTENCY_STORAGE_KEY);
    }
  } catch {
    // The in-memory key is cleared by the caller even if storage is unavailable.
  }
}

export function CheckoutForm({ mode }: { mode: CheckoutMode }) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<CheckoutResponse | null>(null);
  const [cart, setCart] = useState<CartLine[]>([]);
  const idempotencyRef = useRef<{ fingerprint: string | null; key: string } | null>(null);

  useEffect(() => {
    const syncCart = () => setCart(readCart());
    syncCart();
    window.addEventListener("nodria:cart", syncCart);
    window.addEventListener("storage", syncCart);
    return () => {
      window.removeEventListener("nodria:cart", syncCart);
      window.removeEventListener("storage", syncCart);
    };
  }, []);

  const subtotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;
    setError("");
    const lines = readCart();
    if (lines.length === 0) { setError("El carrito está vacío. Añade un producto antes de finalizar el pedido."); return; }

    const form = new FormData(event.currentTarget);
    const customer: CheckoutCustomer = {
      name: String(form.get("name") ?? ""),
      email: String(form.get("email") ?? ""),
      phone: String(form.get("phone") ?? ""),
      address: String(form.get("address") ?? ""),
      postalCode: String(form.get("postalCode") ?? ""),
      city: String(form.get("city") ?? ""),
      province: String(form.get("province") ?? ""),
    };
    const items = toCheckoutCartItems(lines);
    const submittedCart = cartFingerprint(lines);

    setSubmitting(true);
    try {
      const attemptFingerprint = await requestFingerprint(items, customer);
      const idempotencyKey = getRequestIdempotencyKey(attemptFingerprint, idempotencyRef.current);
      idempotencyRef.current = { fingerprint: attemptFingerprint, key: idempotencyKey };
      const response = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items,
          customer,
          idempotencyKey,
          paymentMethod: "approved",
        }),
      });
      const responseBody: unknown = await response.json().catch(() => null);
      if (!response.ok) {
        const message = typeof responseBody === "object" && responseBody !== null && "error" in responseBody && typeof responseBody.error === "string"
          ? responseBody.error
          : "No se ha podido guardar el pedido.";
        throw new Error(message);
      }
      const parsed = checkoutResponseSchema.safeParse(responseBody);
      if (!parsed.success) throw new Error("La respuesta del checkout no se ha podido validar. Puedes reintentar con la misma referencia.");

      const checkoutResult = parsed.data;
      if (checkoutResult.mode === "supabase" && checkoutResult.orderStatus === "pending_payment") {
        setError(checkoutResult.message);
        return;
      }

      setResult(checkoutResult);
      clearRequestIdempotencyKey(idempotencyKey);
      idempotencyRef.current = null;
      if ((checkoutResult.mode === "supabase" && checkoutResult.orderStatus !== "pending_payment") ||
          (checkoutResult.mode === "demo" && (checkoutResult.paymentStatus === "approved" || checkoutResult.paymentStatus === "processing"))) {

        if (cartFingerprint(readCart()) === submittedCart) {
          clearCart();
          setCart([]);
        }
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se ha podido completar el pedido. Inténtalo de nuevo.");
    } finally {
      setSubmitting(false);
    }
  }

  if (cart.length === 0 && !result) {
    return (
      <section className="empty-state checkout-empty-state" role="status">
        <p className="eyebrow">TU PEDIDO</p>
        <h2>Tu carrito está vacío.</h2>
        <p>Elige los productos que quieras y vuelve aquí para confirmar tu pedido de demostración.</p>
        <Link className="button button--dark" href="/catalogo">Volver al catálogo <ArrowRight size={14} aria-hidden="true" /></Link>
      </section>
    );
  }

  if (result?.mode === "supabase") {
    const approved = result.paymentStatus === "approved";
    const headline = approved ? "Tu pedido está confirmado." : "No se pudo confirmar el pedido.";
    return <section className="order-confirmation" aria-live="polite">
      <span className={`confirmation-mark${approved ? "" : " confirmation-mark--muted"}`}>{approved ? <Check size={24} /> : <AlertCircle size={22} />}</span>
      <p className="eyebrow">PEDIDO · {result.paymentStatus.toUpperCase()}</p>
      <h1>{headline}</h1>
      <p>{result.message} El servidor confirmó el total con el catálogo actual: <strong>{money(result.total)}</strong>.</p>
      <span className="order-id">REFERENCIA · {result.orderNumber}</span>
      <span className="order-id">ESTADO · {result.orderStatus}</span>
      <div className="confirmation-actions"><Link className="button button--accent" href="/mi-cuenta">Ver mi espacio <ArrowRight size={14} /></Link></div>
      <div className="demo-payment-warning"><ShieldCheck size={13} /> Pedido guardado. El pago es una simulación: no hay cargo ni se solicitan datos de tarjeta.</div>
    </section>;
  }

  if (result?.mode === "demo") {
    return <section className="order-confirmation" aria-live="polite"><span className="confirmation-mark"><Check size={24} /></span><p className="eyebrow">PEDIDO DE DEMOSTRACIÓN · CONFIRMADO</p><h1>Tu pedido está confirmado.</h1><p>{result.message}</p><span className="order-id">REFERENCIA · {result.orderNumber}</span><div className="confirmation-actions"><Link className="button button--accent" href="/mi-cuenta">Ver mi espacio <ArrowRight size={14} /></Link></div><div className="demo-payment-warning"><ShieldCheck size={13} /> No se ha realizado ningún cargo y nunca se solicitan datos de tarjeta.</div></section>;
  }

  return (
    <form className="checkout-layout" onSubmit={submit}>
      <div className="checkout-main">
        <div className="checkout-steps"><span className="checkout-step"><i>1</i> CARRITO</span><span className="checkout-step active"><i>2</i> ENTREGA Y PAGO</span><span className="checkout-step"><i>3</i> CONFIRMACIÓN</span></div>
        <p className="checkout-auth-note">Usa datos ficticios para la entrega. No se enviará el pedido ni se realizará ningún cargo.</p>
        {mode === "supabase" && <p className="checkout-auth-note">Para finalizar el pedido, inicia sesión con tu cuenta. <Link href="/acceso?next=%2Fcheckout">Iniciar sesión o crear cuenta</Link></p>}
        {mode === "unavailable" && <p className="checkout-error" role="status">La finalización de pedidos no está disponible en este momento.</p>}
        <section className="form-section"><h2>¿A quién enviamos el pedido?</h2><div className="form-grid"><div className="field"><label htmlFor="name">Nombre y apellidos</label><input id="name" name="name" autoComplete="name" required defaultValue="Alex García" /></div><div className="field"><label htmlFor="email">Correo electrónico</label><input id="email" name="email" type="email" autoComplete="email" required defaultValue="alex.garcia@demo.nodria.test" /></div><div className="field"><label htmlFor="phone">Teléfono</label><input id="phone" name="phone" type="tel" autoComplete="tel" defaultValue="600 000 000" /></div><div className="field field--wide"><label htmlFor="address">Dirección de entrega y facturación</label><input id="address" name="address" autoComplete="street-address" required defaultValue="Calle de la Innovación, 12" /></div><div className="field"><label htmlFor="postalCode">Código postal</label><input id="postalCode" name="postalCode" autoComplete="postal-code" inputMode="numeric" required defaultValue="28013" pattern="[0-9]{5}" title="Introduce un código postal de cinco cifras" /></div><div className="field"><label htmlFor="city">Municipio</label><input id="city" name="city" autoComplete="address-level2" required defaultValue="Madrid" /></div><div className="field"><label htmlFor="province">Provincia</label><input id="province" name="province" autoComplete="address-level1" required defaultValue="Madrid" /></div></div></section>
        <section className="form-section"><h2>Método de pago</h2><p className="payment-intro">El pago de demostración NODRIA se aprobará automáticamente al confirmar el pedido.</p><div className="checkout-payments"><div className="payment-option payment-option--active"><span className="payment-option-copy"><strong>Pago de demostración</strong><small>Confirmación inmediata · sin datos bancarios</small></span><Check aria-hidden="true" size={17} /></div></div><p className="demo-payment-warning"><ShieldCheck size={13} /> Entorno académico: no se realiza ningún cargo, no introduzcas datos de tarjeta y el pedido no se enviará.</p></section>
        {error && <p className="checkout-error" role="alert">{error}</p>}
        <button className="button button--accent checkout-submit" type="submit" disabled={submitting || mode === "unavailable" || cart.length === 0 || subtotal <= 0}>{submitting ? <><LoaderCircle className="spin-icon" size={15} /> Confirmando pedido…</> : <>Confirmar pedido <ArrowRight size={15} /></>}</button>
      </div>
      <aside className="cart-summary"><span className="mono-label">TU PEDIDO</span>{cart.map((item) => <div className="checkout-summary-line" key={item.id}><span>{item.quantity} × {item.name}</span><strong>{money(item.price * item.quantity)}</strong></div>)}<div><span>Productos</span><strong>{money(subtotal)}</strong></div><div><span>Envío</span><strong>Gratis</strong></div><div><span>IVA</span><strong>Incluido</strong></div><div className="summary-total"><span>Total</span><strong>{money(subtotal)}</strong></div><span className="checkout-assurance">{mode === "supabase" ? "El servidor confirma el importe final." : "Precios de demostración con impuestos incluidos."}</span></aside>
    </form>
  );
}
