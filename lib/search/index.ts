import type { Product } from "@/lib/catalog";

export const SEARCH_QUERY_MAX_LENGTH = 80;
export const SEARCH_RESULT_LIMIT = 5;
export const SEARCH_RESULT_MAX_LIMIT = 8;
export const RECENT_SEARCH_LIMIT = 5;
export const RECENT_SEARCHES_STORAGE_KEY = "nodria.searches.v1";

export type CatalogSearchResult = Pick<Product, "slug" | "name" | "sku" | "brand" | "category" | "price">;

export type CatalogSearchResponse = {
  query: string;
  total: number;
  results: CatalogSearchResult[];
};

function normalizeSearchText(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("es-ES")
    .replace(/\s+/g, " ")
    .trim();
}

function getSearchableFields(product: Product) {
  return {
    name: normalizeSearchText(product.name),
    sku: normalizeSearchText(product.sku),
    brand: normalizeSearchText(product.brand),
    category: normalizeSearchText(product.category),
    specifications: product.specifications.map((specification) =>
      normalizeSearchText(specification.label + " " + specification.value),
    ),
    summary: normalizeSearchText(product.summary),
  };
}

function scoreProduct(product: Product, query: string) {
  const fields = getSearchableFields(product);
  const technicalDetails = fields.specifications.join(" ");
  const searchableText = [
    fields.name,
    fields.sku,
    fields.brand,
    fields.category,
    technicalDetails,
    fields.summary,
  ].join(" ");
  const queryTerms = query.split(" ");

  if (!queryTerms.every((term) => searchableText.includes(term))) return 0;

  if (fields.name === query) return 120;
  if (fields.sku === query) return 115;
  if (fields.name.startsWith(query)) return 105;
  if (fields.sku.startsWith(query)) return 100;
  if (fields.brand === query) return 95;
  if (fields.category === query) return 90;
  if (fields.name.includes(query)) return 85;
  if (fields.sku.includes(query)) return 80;
  if (fields.brand.includes(query)) return 75;
  if (fields.category.includes(query)) return 70;
  if (fields.specifications.some((specification) => specification.includes(query))) return 65;
  if (fields.summary.includes(query)) return 30;

  return 10;
}

/**
 * Searches the current catalogue by product name, SKU, brand, category,
 * summary, and technical specifications. total always reports the exact
 * number of matches before the result limit is applied.
 */
export function rankCatalogProducts(products: Product[], rawQuery: string): Product[] {
  const query = normalizeSearchText(rawQuery);
  if (!query) return [...products];

  return products
    .map((product, index) => ({ product, index, score: scoreProduct(product, query) }))
    .filter((match) => match.score > 0)
    .sort((left, right) => right.score - left.score || left.index - right.index)
    .map(({ product }) => product);
}

export function searchCatalogProducts(
  products: Product[],
  rawQuery: string,
  limit = SEARCH_RESULT_LIMIT,
): CatalogSearchResponse {
  const matches = rankCatalogProducts(products, rawQuery);

  return {
    query: rawQuery.trim(),
    total: matches.length,
    results: matches.slice(0, limit).map((product) => ({
      slug: product.slug,
      name: product.name,
      sku: product.sku,
      brand: product.brand,
      category: product.category,
      price: product.price,
    })),
  };
}

/** Parses localStorage data without trusting its shape or contents. */
export function parseRecentSearches(value: string | null): string[] {
  if (!value) return [];

  try {
    const parsed: unknown = JSON.parse(value);
    if (!Array.isArray(parsed)) return [];

    const uniqueSearches = new Map<string, string>();
    for (const item of parsed) {
      if (typeof item !== "string") continue;
      const term = item.trim();
      if (!term || term.length > SEARCH_QUERY_MAX_LENGTH || /[\u0000-\u001f\u007f]/.test(term)) continue;

      const normalized = normalizeSearchText(term);
      if (normalized && !uniqueSearches.has(normalized)) uniqueSearches.set(normalized, term);
      if (uniqueSearches.size >= RECENT_SEARCH_LIMIT) break;
    }
    return [...uniqueSearches.values()];
  } catch {
    return [];
  }
}

export function addRecentSearch(term: string, recentSearches: string[]): string[] {
  const cleanTerm = term.trim();
  if (!cleanTerm || cleanTerm.length > SEARCH_QUERY_MAX_LENGTH) return recentSearches.slice(0, RECENT_SEARCH_LIMIT);

  const normalizedTerm = normalizeSearchText(cleanTerm);
  const uniqueSearches = new Map<string, string>([[normalizedTerm, cleanTerm]]);
  for (const search of recentSearches) {
    const cleanSearch = search.trim();
    if (!cleanSearch || cleanSearch.length > SEARCH_QUERY_MAX_LENGTH || /[\u0000-\u001f\u007f]/.test(cleanSearch)) continue;

    const normalized = normalizeSearchText(cleanSearch);
    if (normalized && !uniqueSearches.has(normalized)) uniqueSearches.set(normalized, cleanSearch);
    if (uniqueSearches.size >= RECENT_SEARCH_LIMIT) break;
  }

  return [...uniqueSearches.values()];
}
