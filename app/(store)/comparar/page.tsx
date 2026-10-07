import type { Metadata } from "next";
import { ComparePage } from "@/components/storefront/store-collections";

export const metadata: Metadata = { title: "Comparador" };

export default function CompareRoute() { return <ComparePage />; }
