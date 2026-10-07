import type { Metadata } from "next";
import { FavoritesPage } from "@/components/storefront/store-collections";

export const metadata: Metadata = { title: "Favoritos", robots: { index: false, follow: false } };

export default function FavoritesRoute() { return <FavoritesPage />; }
