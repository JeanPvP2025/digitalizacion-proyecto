import type { Metadata } from "next";
import Link from "next/link";
import { CheckoutForm } from "@/components/storefront/checkout-form";
import { getCheckoutMode } from "@/lib/commerce/mode";

export const metadata: Metadata = { title: "Finalizar compra", robots: { index: false, follow: false } };

export default function CheckoutPage() {
  const mode = getCheckoutMode();
  if (mode === "demo") {
    return (
      <main className="page-wrap checkout-page">
        <p className="eyebrow">COMPRA DIRECTA · TIENDA DE REFERENCIA</p>
        <h1 className="page-title">NODRIA no realiza ventas<span className="title-period">.</span></h1>
        <p className="page-intro">Los modelos, imágenes y precios del catálogo son referencias de productos reales. NODRIA no los vende, no cobra, no envía pedidos ni gestiona devoluciones.</p>
        <section className="empty-state" aria-label="Alcance de compra">
          <h2>Consulta el precio con el vendedor.</h2>
          <p>No se procesa ningún pago ni se crea un pedido en NODRIA. Cada ficha enlaza a la tienda de referencia para consultar el precio y la disponibilidad actuales.</p>
          <Link className="button button--dark" href="/catalogo">Volver al catálogo</Link>
        </section>
      </main>
    );
  }
  const eyebrow = mode === "supabase" ? "FINALIZAR PEDIDO" : "CHECKOUT NO DISPONIBLE";
  const intro = mode === "supabase"
    ? "El importe y la disponibilidad se comprobarán al confirmar. El pedido quedará pendiente hasta registrar el resultado de la simulación de pago."
    : "La finalización de pedidos no está disponible en este momento.";
  return <main className="page-wrap checkout-page"><p className="eyebrow">{eyebrow}</p><h1 className="page-title">Un último paso<span className="title-period">.</span></h1><p className="page-intro">{intro}</p><CheckoutForm mode={mode} /></main>;
}
