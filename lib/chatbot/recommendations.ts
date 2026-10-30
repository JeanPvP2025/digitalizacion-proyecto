import type { Product } from "@/lib/catalog";
import type { ChatbotProductRecommendation, ChatbotQuickReply } from "./types";
import { formatPrice } from "@/lib/catalog";

export type RecommendationCriteria = {
  productType?: string;
  categorySlug?: string;
  budgetEur?: number;
  portCount?: number;
  poeRequired?: boolean;
  wifiStandard?: string;
  brand?: string;
  sortPreference?: "cheapest" | "expensive" | "best_rated";
  useCase?: string;
  query?: string;
};

export type RecommendationResult = {
  products: ChatbotProductRecommendation[];
  summary: string;
  quickReplies: ChatbotQuickReply[];
};

/**
 * Extracts port count from a product (from specifications or name/summary).
 */
export function extractProductPorts(product: Product): number | null {
  const text = `${product.name} ${product.summary} ${product.specifications.map((s) => `${s.label} ${s.value}`).join(" ")}`.toLowerCase();
  const match = text.match(/(\d{1,2})\s*(?:puertos|bocas|x\s*rj45|p\b)/);
  if (match && match[1]) {
    const ports = parseInt(match[1], 10);
    if ([4, 5, 8, 10, 16, 24, 28, 48, 52].includes(ports)) {
      return ports;
    }
  }
  return null;
}

/**
 * Checks whether a product has PoE support.
 */
export function hasProductPoE(product: Product): boolean {
  const text = `${product.name} ${product.summary} ${product.specifications.map((s) => `${s.label} ${s.value}`).join(" ")}`.toLowerCase();
  return /\bpoe\+?(\+)?\b/.test(text) || /\b802\.3(af|at|bt)\b/.test(text);
}

/**
 * Checks whether a product matches a target product type/family.
 */
export function matchesProductType(product: Product, type: string): boolean {
  const text = `${product.name} ${product.category} ${product.summary} ${product.brand}`.toLowerCase();
  switch (type) {
    case "switch":
      return /\bswitch|conmutador\b/.test(text);
    case "router":
      return /\brouter|enrutador|gateway\b/.test(text) && !/\bswitch\b/.test(text);
    case "access_point":
    case "wifi":
      return (
        !/\b(?:rele|micromodulo|enchufe|sensor|interruptor)\b/.test(text) &&
        !product.category.toLowerCase().includes("hogar digital") &&
        /\b(?:access point|punto de acceso|ap|wifi|wi-fi|inalambric|u6|u7)\b/.test(text)
      );
    case "sfp":
      return /\bsfp|transceptor\b/.test(text);
    case "fibra":
      return /\bfibra|manguera|os2|om4|bandeja\b/.test(text);
    case "cable":
    case "cat6a":
    case "cat7":
      return /\bcable|bobina|latiguillo|cat\.?6a?|cat\.?7\b/.test(text);
    case "rack":
      return /\brack|armario|mural\b/.test(text);
    case "panel_parcheo":
      return /\bpanel|parcheo|patch panel\b/.test(text);
    case "domotica":
    case "zigbee":
    case "matter":
    case "thread":
      return (
        /\bdomotica|zigbee|matter|thread|aqara|fibaro|shelly|sensor|actuador\b/.test(text) ||
        product.category.toLowerCase().includes("hogar digital")
      );
    case "rele":
      return /\brele|shelly pro|actuador din\b/.test(text);
    case "centralita":
    case "voip":
    case "telefono_ip":
      return (
        /\bcentralita|ip-pbx|voip|telefono|sip|dect|grandstream|yealink\b/.test(text) ||
        product.category.toLowerCase().includes("telefonia")
      );
    case "industrial":
    case "edge_server":
    case "modbus":
    case "nas":
      return (
        /\bindustrial|edge|fanless|modbus|moxa|advantech|synology|zebra\b/.test(text) ||
        product.category.toLowerCase().includes("productivos")
      );
    default:
      return text.includes(type.toLowerCase());
  }
}

/**
 * Deterministic recommendation engine for NODRIA's commercial catalog.
 */
export function recommendProducts(
  catalog: Product[],
  criteria: RecommendationCriteria
): RecommendationResult {
  if (!catalog || catalog.length === 0) {
    return {
      products: [],
      summary: "No hay productos disponibles actualmente en el catálogo para generar una recomendación.",
      quickReplies: [{ label: "Ver categorías", payload: "Ver las categorías de la tienda" }],
    };
  }

  // 1. Initial filter pool
  let candidates = [...catalog];

  // Filter by category slug if provided
  if (criteria.categorySlug) {
    const slugLower = criteria.categorySlug.toLowerCase();
    candidates = candidates.filter((p) => {
      const catCode = p.category
        .toLowerCase()
        .normalize("NFKD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9]+/g, "-");
      return catCode.includes(slugLower) || (p.categoryIds && p.categoryIds.includes(slugLower));
    });
  }

  // Filter by product type
  if (criteria.productType) {
    const typeCandidates = candidates.filter((p) => matchesProductType(p, criteria.productType!));
    if (typeCandidates.length > 0) {
      candidates = typeCandidates;
    }
  }

  // Filter by brand
  if (criteria.brand) {
    const brandLower = criteria.brand.toLowerCase();
    const brandCandidates = candidates.filter((p) => p.brand.toLowerCase().includes(brandLower));
    if (brandCandidates.length > 0) {
      candidates = brandCandidates;
    }
  }

  // Filter by PoE if required
  if (criteria.poeRequired) {
    const poeCandidates = candidates.filter(hasProductPoE);
    if (poeCandidates.length > 0) {
      candidates = poeCandidates;
    }
  }

  // Filter by Port Count if requested
  if (criteria.portCount) {
    const exactPortCandidates = candidates.filter((p) => {
      const ports = extractProductPorts(p);
      return ports === criteria.portCount;
    });
    if (exactPortCandidates.length > 0) {
      candidates = exactPortCandidates;
    }
  }

  // 2. Score candidates
  type ScoredProduct = {
    product: Product;
    score: number;
    matchReasons: string[];
  };

  const scored: ScoredProduct[] = candidates.map((prod) => {
    let score = 50; // base score
    const reasons: string[] = [];

    // Budget matching
    if (criteria.budgetEur) {
      if (prod.price <= criteria.budgetEur) {
        score += 30;
        reasons.push(`Se ajusta a tu presupuesto (precio: ${formatPrice(prod.price)} vs máx ${formatPrice(criteria.budgetEur)})`);
      } else {
        const diff = prod.price - criteria.budgetEur;
        score -= Math.min(40, Math.floor(diff / 10));
      }
    }

    // Port count matching
    if (criteria.portCount) {
      const ports = extractProductPorts(prod);
      if (ports === criteria.portCount) {
        score += 25;
        reasons.push(`Dispone exactamente de los ${criteria.portCount} puertos solicitados`);
      } else if (ports && ports > criteria.portCount) {
        score += 10;
        reasons.push(`Ofrece ${ports} puertos (capacidad superior para futuras ampliaciones)`);
      }
    }

    // PoE matching
    if (criteria.poeRequired && hasProductPoE(prod)) {
      score += 20;
      reasons.push("Incluye alimentación PoE integrada para alimentar equipos directamente");
    }

    // Brand matching
    if (criteria.brand && prod.brand.toLowerCase().includes(criteria.brand.toLowerCase())) {
      score += 20;
      reasons.push(`Fabricante oficial de referencia: ${prod.brand}`);
    }

    // Stock availability bonus
    if (prod.stock > 0) {
      score += 15;
    }

    // High rating bonus
    if (prod.rating >= 4.7) {
      score += 10;
    }

    // Default reason if none added
    if (reasons.length === 0) {
      reasons.push(prod.summary);
    }

    return { product: prod, score, matchReasons: reasons };
  });

  // Sort according to preference:
  if (criteria.sortPreference === "cheapest") {
    scored.sort((a, b) => a.product.price - b.product.price);
  } else if (criteria.sortPreference === "expensive") {
    scored.sort((a, b) => b.product.price - a.product.price);
  } else {
    // Default sort descending by score
    scored.sort((a, b) => b.score - a.score);
  }

  // Take top 1 to 3
  const topScored = scored.slice(0, 3);

  const productRecommendations: ChatbotProductRecommendation[] = topScored.map((item) => ({
    product: {
      id: item.product.id,
      slug: item.product.slug,
      sku: item.product.sku,
      name: item.product.name,
      brand: item.product.brand,
      price: item.product.price,
      stock: item.product.stock,
      image: item.product.image,
      imageAlt: item.product.imageAlt,
      summary: item.product.summary,
      category: item.product.category,
      keySpecs: item.product.specifications.slice(0, 3),
    },
    reason: item.matchReasons.join(". "),
  }));

  // Build conversational summary
  let summaryText = "";
  if (productRecommendations.length === 0) {
    summaryText = "No he encontrado ningún producto que cumpla exactamente todos los filtros especificados. Te recomiendo ampliar el presupuesto o revisar los criterios de búsqueda.";
  } else if (criteria.sortPreference === "cheapest" && productRecommendations.length > 0) {
    const cheapest = productRecommendations[0].product;
    summaryText = `La opción más económica disponible es **${cheapest.name}** por **${formatPrice(cheapest.price)}**:`;
  } else if (criteria.budgetEur && candidates.length > 0 && candidates.every((c) => c.price > criteria.budgetEur!)) {
    const minCandidate = candidates.reduce((min, c) => (c.price < min.price ? c : min), candidates[0]);
    const diff = formatPrice(minCandidate.price - criteria.budgetEur);
    summaryText = `Para los criterios indicados, los equipos disponibles parten de ${formatPrice(minCandidate.price)} (+${diff} sobre tu presupuesto de ${formatPrice(criteria.budgetEur)}). Te muestro la alternativa más accesible:`;
  } else if (productRecommendations.length === 1) {
    summaryText = `He seleccionado la mejor opción para tus requisitos:\n\n**${productRecommendations[0].product.name}** de ${productRecommendations[0].product.brand}.`;
  } else {
    summaryText = `He seleccionado ${productRecommendations.length} opciones destacadas que se adaptan a tus criterios técnicos y de presupuesto:`;
  }

  // Quick replies
  const quickReplies: ChatbotQuickReply[] = [
    { label: "Comparar estas opciones", payload: "Comparar estos productos" },
    { label: "Ver carrito", payload: "Quiero ver mi carrito" },
    { label: "Nueva recomendación", payload: "Recomiéndame otro equipo" },
  ];

  return {
    products: productRecommendations,
    summary: summaryText,
    quickReplies,
  };
}
