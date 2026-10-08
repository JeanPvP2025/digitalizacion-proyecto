import type { Product, ProductCategory, ProductSpecification } from "@/lib/catalog";
import type { PcBuilderCatalogComponent } from "@/lib/pc-builder/types";

export type DetailVariant = { id: string; sku: string; title: string; price: number; previousPrice?: number };
export type DetailVariantRow = { id: string; product_id: string; sku: string; title: string; current_price: number | string; compare_at_price: number | string | null; currency: string; is_active: boolean };

/** Only active EUR variants of the server-selected published product can be offered. */
export function mapDetailVariants(rows: readonly DetailVariantRow[], productId: string): DetailVariant[] {
  return rows.flatMap((row) => {
    const price = Number(row.current_price);
    const previous = row.compare_at_price === null ? undefined : Number(row.compare_at_price);
    if (row.product_id !== productId || !row.is_active || row.currency !== "EUR" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(row.id) || !row.sku.trim() || !row.title.trim() || !Number.isFinite(price) || price < 0) return [];
    return [{ id: row.id, sku: row.sku, title: row.title, price, ...(previous !== undefined && Number.isFinite(previous) && previous > price ? { previousPrice: previous } : {}) }];
  }).sort((a, b) => a.title.localeCompare(b.title, "es"));
}

export function groupSpecifications(specifications: readonly ProductSpecification[]) {
  const groups = new Map<string, ProductSpecification[]>();
  for (const spec of specifications) {
    const label = spec.label.toLocaleLowerCase("es");
    const group = /garant|caja|incluid|contenido/.test(label) ? "Garantía y contenido declarado" : /conex|puerto|interfaz|socket|compat|estándar|formato/.test(label) ? "Conexiones y compatibilidad" : /pantalla|panel|resolución|frecuencia|color/.test(label) ? "Imagen y pantalla" : /procesador|memoria|capacidad|almacenamiento|lectura|velocidad|gráfica|potencia/.test(label) ? "Rendimiento y capacidad" : "Otros detalles";
    groups.set(group, [...(groups.get(group) ?? []), spec]);
  }
  return [...groups].map(([title, items]) => ({ title, items }));
}

const guides: Partial<Record<ProductCategory, { title: string; checks: string[] }>> = {
  Ordenadores: { title: "Elegir un equipo para tu trabajo", checks: ["Compara procesador, memoria y almacenamiento con los requisitos de tus aplicaciones.", "Revisa las conexiones publicadas antes de elegir pantalla o periféricos. La categoría no acredita compatibilidad.", "Si una ampliación no figura en las especificaciones, solicita confirmación antes de elegir componentes."] },
  Componentes: { title: "Comprobar las piezas antes del montaje", checks: ["Comprueba socket, generación de memoria, formato y espacio de la caja cuando estén declarados.", "Valida el conjunto en el configurador; una coincidencia de socket no certifica por sí sola todo el equipo.", "No asumas que se incluyen disipador, cables o adaptadores si la ficha no los enumera."] },
  Monitores: { title: "Preparar tu espacio de pantalla", checks: ["Compara resolución, tamaño y frecuencia con tu uso previsto.", "Revisa las conexiones de ambos dispositivos y el cable necesario. Un puerto USB-C no confirma todas sus funciones.", "Comprueba que tu equipo admite la resolución y frecuencia elegidas antes de comprar."] },
  Almacenamiento: { title: "Revisar una ampliación de almacenamiento", checks: ["Comprueba interfaz y formato de la unidad con la documentación de tu equipo.", "Compara capacidad y velocidad declaradas; no deduzcas el rendimiento de una combinación no probada.", "No asumas que se incluye una carcasa o adaptador si no aparece en el contenido de caja."] },
  Redes: { title: "Elegir conectividad para tu espacio", checks: ["Revisa el estándar y los puertos declarados junto con los dispositivos que conectarás.", "La velocidad y cobertura indicadas son datos de la ficha demo; no garantizan el resultado en tu instalación.", "Comprueba la configuración requerida por tu proveedor antes de sustituir un equipo de red."] },
  Telefonía: { title: "Elegir un dispositivo y sus accesorios", checks: ["Compara pantalla, memoria y almacenamiento según las aplicaciones que uses.", "No deduzcas compatibilidad con lápices, teclados o cargadores a partir del nombre del producto.", "Revisa conexiones y contenido de caja declarado antes de añadir accesorios."] },
};

export function getProductEditorial(category: ProductCategory) {
  return guides[category] ?? null;
}

/** Alternatives use the same category and, for PC parts, the same validated component type. */
export function getProductAlternatives(product: Product, products: readonly Product[], components: readonly PcBuilderCatalogComponent[]) {
  const types = new Set(components.filter((item) => item.productId === product.id).map((item) => item.category));
  return products.filter((item) => item.id !== product.id && item.category === product.category && (types.size ? components.some((part) => part.productId === item.id && types.has(part.category)) : item.category !== "Componentes"))
    .sort((a, b) => Math.abs(a.price - product.price) - Math.abs(b.price - product.price) || a.slug.localeCompare(b.slug)).slice(0, 4);
}

/** Partial compatibility evidence; never a guarantee for the whole PC. */
export function getComplementReason(a: PcBuilderCatalogComponent, b: PcBuilderCatalogComponent): string | null {
  if (a.productId === b.productId) return null;
  if (a.category === "cpu" && b.category === "motherboard" && a.socket === b.socket && a.memoryGenerations.includes(b.memoryGeneration)) return `Socket ${a.socket} y generación de memoria coincidentes`;
  if (a.category === "motherboard" && b.category === "memory" && a.memoryGeneration === b.generation && b.capacityGb <= a.maxMemoryGb) return `${b.generation}, ${b.capacityGb} GB dentro del máximo declarado`;
  if (a.category === "cpu" && b.category === "cooler" && b.supportedSockets.includes(a.socket)) return `Refrigeración con socket ${a.socket} declarado`;
  if ((a.category === "motherboard" && b.category === "cpu") || (a.category === "memory" && b.category === "motherboard") || (a.category === "cooler" && b.category === "cpu")) return getComplementReason(b, a);
  return null;
}

export function getProductComplements(product: Product, products: readonly Product[], components: readonly PcBuilderCatalogComponent[]) {
  const own = components.filter((item) => item.productId === product.id);
  return products.flatMap((candidate) => {
    const matches = components.filter((part) => part.productId === candidate.id).flatMap((part) => own.flatMap((current) => {
      const reason = getComplementReason(current, part);
      return reason ? [{ variantTitle: current.variantTitle, relatedVariantTitle: part.variantTitle, reason }] : [];
    }));
    return matches.length ? [{ product: candidate, matches }] : [];
  }).slice(0, 3);
}
