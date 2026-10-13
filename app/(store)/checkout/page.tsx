import type { Metadata } from "next";
import { CheckoutForm } from "@/components/storefront/checkout-form";
import { getCheckoutMode } from "@/lib/commerce/mode";

export const metadata: Metadata = { title: "Finalizar compra", robots: { index: false, follow: false } };

export default function CheckoutPage() {
  const mode = getCheckoutMode();
  const intro = mode === "unavailable"
    ? "El checkout no está disponible ahora. Inténtalo de nuevo más tarde."
    : "Revisa tus datos y confirma el pedido en la tienda NODRIA. El pago de demostración se aprobará sin cargos ni datos bancarios.";
  return <main className="page-wrap checkout-page"><p className="eyebrow">{mode === "unavailable" ? "CHECKOUT NO DISPONIBLE" : "FINALIZAR PEDIDO"}</p><h1 className="page-title">Un último paso<span className="title-period">.</span></h1><p className="page-intro">{intro}</p><CheckoutForm mode={mode} /></main>;
}
