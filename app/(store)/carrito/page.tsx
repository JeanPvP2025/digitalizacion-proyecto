import type { Metadata } from "next";
import { CartPage } from "@/components/storefront/store-interactions";
import { getCheckoutMode } from "@/lib/commerce/mode";

export const metadata: Metadata = { title: "Carrito", robots: { index: false, follow: false } };

export default function CartRoute() { return <CartPage checkoutEnabled={getCheckoutMode() === "supabase"} />; }
