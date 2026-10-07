import type { Metadata } from "next";
import { PcBuilder } from "@/components/storefront/pc-builder";

export const metadata: Metadata = { title: "PC Builder demo — configuración orientativa", description: "Prueba fichas de componentes ficticias y comprobaciones orientativas de compatibilidad, consumo y precio. No representa inventario real." };

export default function PcBuilderPage() { return <PcBuilder />; }
