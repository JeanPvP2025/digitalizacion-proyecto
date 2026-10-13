import type { Product } from "@/lib/catalog";
import { compareSearchMatches, scoreCatalogProducts } from "./ranking";
import { normalizeSearchText } from "./vocabulary";
export { rankCatalogProducts, SEARCH_TERM_MAX_COUNT, SEARCH_QUERY_MAX_LENGTH } from "./ranking";

import { SEARCH_QUERY_MAX_LENGTH } from "./ranking";
export const SEARCH_RESULT_LIMIT = 5;
export const SEARCH_RESULT_MAX_LIMIT = 8;
export const RECENT_SEARCH_LIMIT = 5;
export const RECENT_SEARCHES_STORAGE_KEY = "nodria.searches.v1";

export type CatalogSearchResult = Pick<Product, "slug" | "name" | "sku" | "brand" | "category" | "price">;

export type CatalogSearchResponse = {
  query: string;
  total: number;
  results: CatalogSearchResult[];
  recovery: CatalogSearchRecovery | null;
};

export type CatalogSearchRecovery = {
  reason: "partial" | "browse";
  categories: { name: string; href: string; count: number }[];
  products: CatalogSearchResult[];
};

type SearchCategory = { name: string; slug: string };

function toResult(product: Product): CatalogSearchResult {
  const { slug, name, sku, brand, category, price } = product;
  return { slug, name, sku, brand, category, price };
}

export function searchCatalogProducts(
  products: Product[],
  rawQuery: string,
  limit = SEARCH_RESULT_LIMIT,
  categories: SearchCategory[] = [],
): CatalogSearchResponse {
  const scored = scoreCatalogProducts(products, rawQuery);
  const matches = (rawQuery.trim() ? scored.filter((match) => match.complete).sort(compareSearchMatches) : scored).map(({ product }) => product);
  const safeLimit = Number.isFinite(limit) ? Math.min(SEARCH_RESULT_MAX_LIMIT, Math.max(1, Math.floor(limit))) : SEARCH_RESULT_LIMIT;
  let recovery: CatalogSearchRecovery | null = null;
  if (!matches.length && products.length) {
    const partial = scored.filter((match) => match.coverage > 0).sort(compareSearchMatches);
    const alternatives = partial.length ? partial.map(({ product }) => product) : [...products].sort((left, right) =>
      Number(Boolean(right.featured)) - Number(Boolean(left.featured)) || (left.slug < right.slug ? -1 : left.slug > right.slug ? 1 : 0));
    const categoryNames = [...new Set(alternatives.map((product) => product.category))].slice(0, 3);
    recovery = {
      reason: partial.length ? "partial" : "browse",
      categories: categoryNames.map((name) => {
        const category = categories.find((item) => item.name === name);
        return {
          name,
          href: category ? "/catalogo?categoria=" + encodeURIComponent(category.slug) : "/catalogo?q=" + encodeURIComponent(name),
          count: products.filter((product) => product.category === name).length,
        };
      }),
      products: alternatives.slice(0, Math.min(safeLimit, 3)).map(toResult),
    };
  }

  return {
    query: rawQuery.trim(),
    total: matches.length,
    results: matches.slice(0, safeLimit).map(toResult),
    recovery,
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
  if (!cleanTerm || cleanTerm.length > SEARCH_QUERY_MAX_LENGTH || /[\u0000-\u001f\u007f]/.test(cleanTerm)) return recentSearches.slice(0, RECENT_SEARCH_LIMIT);

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
