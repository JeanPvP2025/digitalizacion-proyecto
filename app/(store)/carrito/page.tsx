import type { Metadata } from "next";
import { CartPage } from "@/components/storefront/store-interactions";

export const metadata: Metadata = { title: "Carrito", robots: { index: false, follow: false } };

export default function CartRoute() { return <CartPage />; }
