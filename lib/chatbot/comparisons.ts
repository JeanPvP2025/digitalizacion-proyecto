import type { Product } from "@/lib/catalog";
import type { ChatbotComparisonItem, ChatbotComparisonTable, ChatbotQuickReply } from "./types";
import { formatPrice } from "@/lib/catalog";
import { normalizeText, BRANDS } from "./normalizer";
import { matchesProductType } from "./recommendations";

/**
 * Searches and finds candidate products mentioned in a comparison query.
 */
export function findComparisonCandidates(
  query: string,
  catalog: Product[],
  activeTopic?: string
): Product[] {
  const normalizedQuery = normalizeText(query);
  const matched: Product[] = [];

  // 1. Detect if specific brands are being compared (e.g. "compara unifi con mikrotik")
  const mentionedBrands: string[] = [];
  const normalizedWithAliases = normalizedQuery.replace(/\bunifi\b/g, "ubiquiti");

  for (const brand of BRANDS) {
    if (new RegExp(`\\b${brand}\\b`).test(normalizedWithAliases)) {
      if (!mentionedBrands.includes(brand)) {
        mentionedBrands.push(brand);
      }
    }
  }

  // If at least 2 brands are mentioned, find the best matching product for each brand
  if (mentionedBrands.length >= 2) {
    for (const b of mentionedBrands.slice(0, 3)) {
      let brandProducts = catalog.filter((p) => p.brand.toLowerCase().includes(b));
      if (activeTopic) {
        const topicFiltered = brandProducts.filter((p) =>
          matchesProductType(p, activeTopic) ||
          normalizeText(`${p.name} ${p.category} ${p.summary}`).includes(normalizeText(activeTopic))
        );
        if (topicFiltered.length > 0) {
          brandProducts = topicFiltered;
        }
      }
      if (brandProducts.length > 0 && !matched.some((p) => p.id === brandProducts[0].id)) {
        matched.push(brandProducts[0]);
      }
    }
    if (matched.length >= 2) {
      return matched;
    }
  }

  // 2. Specific product name, model or SKU matching
  for (const product of catalog) {
    const normName = normalizeText(product.name);
    const normBrand = normalizeText(product.brand);
    const normModel = product.modelNumber ? normalizeText(product.modelNumber) : "";
    const normSku = normalizeText(product.sku);

    // Check if the query specifically mentions product name or key model identifier
    const nameWords = normName.split(/\s+/).filter((w) => w.length > 3);
    let matchCount = 0;
    for (const word of nameWords) {
      if (normalizedQuery.includes(word)) {
        matchCount++;
      }
    }

    if (
      (normModel && normalizedQuery.includes(normModel)) ||
      (normSku && normalizedQuery.includes(normSku)) ||
      matchCount >= 2 ||
      (normalizedQuery.includes(normBrand) && matchCount >= 1) ||
      (normalizedQuery.includes("unifi") && normName.includes("unifi"))
    ) {
      if (!matched.some((p) => p.id === product.id)) {
        matched.push(product);
      }
    }

    if (matched.length >= 3) break;
  }

  return matched;
}

/**
 * Builds a structured comparison table for 2 or 3 products.
 */
export function buildProductComparison(products: Product[]): {
  table: ChatbotComparisonTable;
  summary: string;
  quickReplies: ChatbotQuickReply[];
} {
  if (products.length < 2) {
    throw new Error("Se necesitan al menos 2 productos para realizar una comparativa.");
  }

  const comparedProducts = products.slice(0, 3);
  const attributes = [
    "Precio",
    "Fabricante",
    "Categoría",
    "Disponibilidad",
    "Valoración",
    "Especificación principal",
    "Conectividad / Interfaces",
  ];

  const items: ChatbotComparisonItem[] = comparedProducts.map((p) => {
    const spec1 = p.specifications[0] ? `${p.specifications[0].label}: ${p.specifications[0].value}` : "Estándar profesional";
    const spec2 = p.specifications[1] ? `${p.specifications[1].label}: ${p.specifications[1].value}` : p.summary.slice(0, 60);

    return {
      slug: p.slug,
      name: p.name,
      brand: p.brand,
      price: p.price,
      image: p.image,
      imageAlt: p.imageAlt,
      specs: {
        Precio: formatPrice(p.price),
        Fabricante: p.brand,
        Categoría: p.category.length > 35 ? `${p.category.slice(0, 32)}...` : p.category,
        Disponibilidad: p.stock > 0 ? `${p.stock} unidades en stock` : "Bajo pedido",
        Valoración: `${p.rating.toFixed(1)} / 5.0 (${p.reviewCount} opiniones)`,
        "Especificación principal": spec1,
        "Conectividad / Interfaces": spec2,
      },
    };
  });

  const title = `Comparativa técnica: ${comparedProducts[0].name} vs ${comparedProducts[1].name}`;

  // Deterministic verdict generation
  const p1 = comparedProducts[0];
  const p2 = comparedProducts[1];
  let verdict = "";

  if (p1.price < p2.price) {
    const diff = formatPrice(p2.price - p1.price);
    verdict = `**Conclusión técnica:** **${p1.name}** es la opción más económica (ahorras ${diff}), ofreciendo una excelente relación coste/prestaciones. Por su parte, **${p2.name}** está recomendada para proyectos con exigencias técnicas superiores o mayor densidad de carga.`;
  } else {
    const diff = formatPrice(p1.price - p2.price);
    verdict = `**Conclusión técnica:** **${p2.name}** resulta más accesible (${diff} menos), mientras que **${p1.name}** aporta mayores prestaciones técnicas o integración de gama superior de ${p1.brand}.`;
  }

  const summary = `Aquí tienes la comparativa directa entre los equipos solicitados:\n\n${verdict}`;

  const quickReplies: ChatbotQuickReply[] = comparedProducts.map((p) => ({
    label: `Añadir ${p.name.slice(0, 18)}...`,
    payload: `Añadir al carrito ${p.slug}`,
  }));
  quickReplies.push({ label: "Ver carrito", payload: "Ver mi carrito" });

  return {
    table: {
      title,
      attributes,
      products: items,
      verdict,
    },
    summary,
    quickReplies,
  };
}
