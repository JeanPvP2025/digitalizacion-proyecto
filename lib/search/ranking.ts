import type { Product } from "@/lib/catalog";
import { isSearchTypo, normalizeSearchText, searchConcept, searchTokens } from "./vocabulary";

export const SEARCH_TERM_MAX_COUNT = 12;
export const SEARCH_QUERY_MAX_LENGTH = 80;

type SearchField = { tokens: string[]; weight: number; fuzzy: boolean; specification?: boolean };
type SearchDocument = { product: Product; name: string; sku: string; fields: SearchField[] };
export type RankedSearchMatch = { product: Product; score: number; coverage: number; complete: boolean };

function compact(value: string): string { return normalizeSearchText(value).replace(/[^a-z0-9]/g, ""); }

function document(product: Product): SearchDocument {
  return {
    product,
    name: normalizeSearchText(product.name),
    sku: compact(product.sku),
    fields: [
      { tokens: searchTokens(product.name), weight: 1000, fuzzy: true },
      { tokens: searchTokens(product.sku), weight: 950, fuzzy: false },
      { tokens: searchTokens(product.brand), weight: 800, fuzzy: true },
      { tokens: searchTokens(product.category), weight: 650, fuzzy: true },
      ...product.specifications.map(({ label, value }) => ({ tokens: searchTokens(label + " " + value), weight: 400, fuzzy: true, specification: true })),
      { tokens: searchTokens(product.summary), weight: 100, fuzzy: false },
    ],
  };
}

function matchTerm(doc: SearchDocument, term: string, last: boolean): { score: number; typo: boolean } {
  let best = { score: 0, typo: false };
  for (const field of doc.fields) {
    for (const token of field.tokens) {
      let score = 0;
      let typo = false;
      if (term === token) score = field.weight;
      else if (last && term.length >= 2 && !/\d/.test(term) && token.startsWith(term)) score = field.weight * 0.8;
      else if (searchConcept(term) === searchConcept(token)) score = field.weight * 0.7;
      else if (field.fuzzy && isSearchTypo(term, token)) { score = field.weight * 0.4; typo = true; }
      if (score > best.score) best = { score, typo };
    }
  }
  return best;
}

export function compareSearchMatches(left: RankedSearchMatch, right: RankedSearchMatch): number {
  return right.coverage - left.coverage || right.score - left.score
    || Number(Boolean(right.product.featured)) - Number(Boolean(left.product.featured))
    || (left.product.slug < right.product.slug ? -1 : left.product.slug > right.product.slug ? 1 : 0)
    || (left.product.id < right.product.id ? -1 : left.product.id > right.product.id ? 1 : 0);
}

/** Pure, bounded query work; no hidden catalogue, stock claims, popularity or network calls. */
export function scoreCatalogProducts(products: Product[], rawQuery: string): RankedSearchMatch[] {
  const query = normalizeSearchText(rawQuery);
  if (rawQuery.length > SEARCH_QUERY_MAX_LENGTH || /[\u0000-\u001f\u007f]/.test(rawQuery)) return [];
  if (!query) return products.map((product) => ({ product, score: 0, coverage: 0, complete: true }));
  const terms = searchTokens(query);
  if (!terms.length || terms.length > SEARCH_TERM_MAX_COUNT) return [];
  const compactQuery = compact(query);
  return products.map((product) => {
    const doc = document(product);
    if (doc.sku && doc.sku === compactQuery) return { product, score: 100_000, coverage: terms.length, complete: true };
    let score = 0;
    let coverage = 0;
    let typos = 0;
    let attributesMatch = true;
    for (const [index, term] of terms.entries()) {
      const match = matchTerm(doc, term, index === terms.length - 1);
      if (match.score > 0) { coverage++; score += match.score; }
      if (match.typo) typos++;
      // A named capacity must belong to that attribute, not an unrelated GPU/storage value.
      const nextTerm = terms[index + 1];
      if (["memoria", "almacenamiento", "procesador", "grafica"].includes(searchConcept(term)) && nextTerm && /^\d/.test(nextTerm)) {
        attributesMatch &&= doc.fields.some((field) => field.specification
          && field.tokens.some((token) => searchConcept(token) === searchConcept(term)) && field.tokens.includes(nextTerm));
      }
    }
    if (doc.name === query) score += 90_000;
    else if (doc.name.startsWith(query)) score += 10_000;
    // All meaningful terms must match, and at most one term may contain a typo.
    return { product, score, coverage, complete: coverage === terms.length && typos <= 1 && attributesMatch };
  });
}

export function rankCatalogProducts(products: Product[], rawQuery: string): Product[] {
  if (!rawQuery.trim()) return [...products];
  return scoreCatalogProducts(products, rawQuery).filter((match) => match.complete).sort(compareSearchMatches).map(({ product }) => product);
}
