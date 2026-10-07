import type { Metadata } from "next";
import { CheckoutForm } from "@/components/storefront/checkout-form";
import { getCheckoutMode } from "@/lib/commerce/mode";

export const metadata: Metadata = { title: "Finalizar compra", robots: { index: false, follow: false } };

export default function CheckoutPage() {
  const mode = getCheckoutMode();
  const eyebrow = mode === "demo" ? "FINALIZAR PEDIDO · DEMO LOCAL" : mode === "supabase" ? "FINALIZAR PEDIDO · SUPABASE" : "CHECKOUT NO DISPONIBLE";
  const intro = mode === "demo"
    ? "Revisa la dirección y registra un resultado de pago ficticio en el archivo local. No se solicitarán datos de tarjeta."
    : mode === "supabase"
      ? "Con una sesión activa, el servidor recalcula el precio y el stock desde Supabase. El pedido se guardará como pago pendiente."
      : "Este entorno necesita credenciales Supabase para habilitar el checkout.";
  return <main className="page-wrap checkout-page"><p className="eyebrow">{eyebrow}</p><h1 className="page-title">Un último paso<span className="title-period">.</span></h1><p className="page-intro">{intro}</p><CheckoutForm mode={mode} /></main>;
}
