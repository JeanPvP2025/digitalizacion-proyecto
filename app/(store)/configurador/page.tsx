import type { Metadata } from "next";
import { connection } from "next/server";
import { PcBuilder } from "@/components/storefront/pc-builder";
import { getPcBuilderCatalog } from "@/lib/pc-builder/catalog";

export const metadata: Metadata = {
  title: "PC Builder — configura con piezas del catálogo",
  description: "Configura un PC con variantes del catálogo y revisa las reglas de compatibilidad cubiertas por sus atributos técnicos.",
};

export default async function PcBuilderPage() {
  // The connected catalogue must be read for the incoming request, not frozen
  // into a build-time page snapshot.
  await connection();
  const catalog = await getPcBuilderCatalog();
  return <PcBuilder catalog={catalog} />;
}
