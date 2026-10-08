import type { Product } from "@/lib/catalog";
import type { CatalogCategory } from "@/lib/catalog-mapping";
import { rankCatalogProducts, SEARCH_QUERY_MAX_LENGTH } from "@/lib/search";

// The repository carries parent links and product memberships from the active source.
export type DiscoveryCategory = Omit<CatalogCategory, "name"> & { name: string; parentId?: string | null };
export type DiscoveryProduct = Product & { categoryIds?: readonly string[] };
export type CatalogParams = Record<string, string | string[] | undefined>;
export type CatalogSource = "demo" | "supabase";
export type FacetOption = { value: string; count: number; selected: boolean };
export type Facet = { key: string; label: string; options: FacetOption[] };
export type Selection = { key: string; value: string; label: string };

const filterKeys = new Set(["categoria", "marca", "min", "max", "disponibilidad"]);
const isFilter = (key: string) => filterKeys.has(key) || key.startsWith("spec.");
const collator = new Intl.Collator("es", { numeric: true, sensitivity: "base" });

export function toCatalogParams(raw: CatalogParams) {
  const params = new URLSearchParams();
  for (const [key, values] of Object.entries(raw)) {
    if (values === undefined) continue;
    for (const value of Array.isArray(values) ? values : [values]) params.append(key, value);
  }
  return params;
}

export function catalogHref(params: URLSearchParams) {
  const query = params.toString();
  return "/catalogo" + (query ? "?" + query : "");
}

export function changeCatalogParam(params: URLSearchParams, key: string, value: string | null, multiple = false) {
  const next = new URLSearchParams(params);
  const previous = next.getAll(key);
  next.delete(key);
  if (multiple) {
    for (const item of new Set(previous.filter((item) => item !== value))) next.append(key, item);
    if (value !== null && !previous.includes(value)) next.append(key, value);
  } else if (value) next.set(key, value);
  // Technical dimensions belong to a category; clear them when changing scope.
  if (key === "categoria") for (const name of new Set(next.keys())) if (name.startsWith("spec.")) next.delete(name);
  return catalogHref(next);
}

export function clearCatalogFilters(params: URLSearchParams, includeQuery = false) {
  const next = new URLSearchParams(params);
  for (const key of new Set(next.keys())) if (isFilter(key) || (includeQuery && key === "q")) next.delete(key);
  return catalogHref(next);
}

function amount(value: string | null) {
  if (!value?.trim()) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : undefined;
}

function descendants(category: DiscoveryCategory, categories: DiscoveryCategory[]) {
  const ids = new Set([category.id]);
  let size = 0;
  while (size !== ids.size) {
    size = ids.size;
    for (const item of categories) if (item.parentId && ids.has(item.parentId)) ids.add(item.id);
  }
  return ids;
}

function categoryMatches(product: DiscoveryProduct, category: DiscoveryCategory, categories: DiscoveryCategory[]) {
  const ids = descendants(category, categories);
  if (product.categoryIds?.length) return product.categoryIds.some((id) => ids.has(id));
  return categories.some((item) => ids.has(item.id) && item.name === product.category);
}

function categoryTree(categories: DiscoveryCategory[]) {
  const sorted = [...categories].sort((a, b) => a.sortOrder - b.sortOrder || collator.compare(a.name, b.name));
  const result: Array<{ category: DiscoveryCategory; depth: number }> = [];
  const visited = new Set<string>();
  function visit(category: DiscoveryCategory, depth: number) {
    if (visited.has(category.id)) return;
    visited.add(category.id);
    result.push({ category, depth });
    sorted.filter((item) => item.parentId === category.id).forEach((item) => visit(item, depth + 1));
  }
  sorted.filter((item) => !item.parentId || !sorted.some((parent) => parent.id === item.parentId)).forEach((item) => visit(item, 0));
  // Malformed cycles must never hang a public request.
  sorted.forEach((item) => visit(item, 0));
  return result;
}

export function discoverCatalog(products: DiscoveryProduct[], categories: DiscoveryCategory[], params: URLSearchParams, source: CatalogSource) {
  const query = (params.get("q") ?? "").trim().slice(0, SEARCH_QUERY_MAX_LENGTH);
  const categorySlug = params.get("categoria") ?? "";
  const category = categories.find((item) => item.slug === categorySlug);
  const min = amount(params.get("min"));
  const max = amount(params.get("max"));
  const notices: string[] = [];
  if (["min", "max"].some((key) => params.get(key)?.trim() && amount(params.get(key)) === undefined)) notices.push("El precio debe ser un número mayor o igual que cero. Se ha omitido el límite no válido.");
  if (min !== undefined && max !== undefined && min > max) notices.push("El precio mínimo supera al máximo. Ajusta uno de los límites para encontrar productos.");
  const allowedSorts = source === "demo" ? ["recomendados", "precio-asc", "precio-desc", "mejor-valorados"] : ["recomendados", "precio-asc", "precio-desc"];
  const requestedSort = params.get("orden") ?? "recomendados";
  const sort = allowedSorts.includes(requestedSort) ? requestedSort : "recomendados";
  if (sort !== requestedSort) notices.push("Ese orden no está disponible. Se muestra el orden recomendado.");
  const availability = params.get("disponibilidad");
  if (availability && source !== "demo") notices.push("La disponibilidad se confirma al comprar. No se ha aplicado el filtro de stock al catálogo conectado.");
  if (availability && source === "demo" && !["en-stock", "agotado"].includes(availability)) notices.push("Ese estado de disponibilidad no existe. Retira el filtro para ver productos.");
  const specifications = [...new Set(params.keys())].filter((key) => key.startsWith("spec.") && params.getAll(key).some(Boolean));
  const brands = params.getAll("marca").filter(Boolean);
  const searched = rankCatalogProducts(products, query) as DiscoveryProduct[];

  function matches(product: DiscoveryProduct, omit?: string) {
    if (omit !== "categoria" && categorySlug && (!category || !categoryMatches(product, category, categories))) return false;
    if (omit !== "marca" && brands.length && !brands.includes(product.brand)) return false;
    if (min !== undefined && product.price < min) return false;
    if (max !== undefined && product.price > max) return false;
    if (omit !== "disponibilidad" && availability && source === "demo") {
      if (availability === "en-stock" ? product.stock <= 0 : availability === "agotado" ? product.stock > 0 : true) return false;
    }
    // OR within a dimension; AND across dimensions. Values are exact data values.
    return specifications.filter((key) => key !== omit).every((key) => product.specifications.some((spec) => key === "spec." + spec.label && params.getAll(key).includes(spec.value)));
  }

  const scoped = searched.filter((product) => !categorySlug || (category && categoryMatches(product, category, categories)));
  const facetDefinitions = new Map<string, { label: string; values: Set<string> }>();
  const addValue = (key: string, label: string, value: string) => {
    if (!value.trim()) return;
    const entry = facetDefinitions.get(key) ?? { label, values: new Set<string>() };
    entry.values.add(value);
    facetDefinitions.set(key, entry);
  };
  for (const product of scoped) {
    addValue("marca", "Marca", product.brand);
    if (source === "demo") addValue("disponibilidad", "Disponibilidad · demo", product.stock > 0 ? "en-stock" : "agotado");
    if (category) for (const spec of product.specifications) addValue("spec." + spec.label, spec.label, spec.value);
  }
  // Keep stale selections visible and removable, even when no result exposes them.
  for (const key of new Set(params.keys())) {
    if (key === "marca" || key === "disponibilidad" || key.startsWith("spec.")) {
      for (const value of params.getAll(key)) addValue(key, key === "marca" ? "Marca" : key === "disponibilidad" ? "Disponibilidad · demo" : key.slice(5), value);
    }
  }
  const facets: Facet[] = [...facetDefinitions.entries()]
    .filter(([key, entry]) => (entry.values.size > 1 || params.getAll(key).some(Boolean)) && (key !== "disponibilidad" || source === "demo"))
    .map(([key, entry]) => ({
      key, label: entry.label,
      options: [...entry.values].sort(collator.compare).map((value) => ({
        value, selected: params.getAll(key).includes(value),
        count: searched.filter((product) => matches(product, key) && (key === "marca" ? product.brand === value : key === "disponibilidad" ? (product.stock > 0 ? "en-stock" : "agotado") === value : product.specifications.some((spec) => "spec." + spec.label === key && spec.value === value))).length,
      })),
    }));
  const categoryOptions = categoryTree(categories).map(({ category: item, depth }) => ({
    ...item, depth, selected: categorySlug === item.slug,
    count: searched.filter((product) => matches(product, "categoria") && categoryMatches(product, item, categories)).length,
  })).filter((item) => item.count > 0 || item.selected);
  const selections: Selection[] = [];
  if (query) selections.push({ key: "q", value: params.get("q") ?? query, label: `Búsqueda: ${query}` });
  if (categorySlug) selections.push({ key: "categoria", value: categorySlug, label: category?.name ?? `Categoría: ${categorySlug}` });
  for (const key of new Set(params.keys())) {
    if (!isFilter(key) || key === "categoria") continue;
    for (const value of new Set(params.getAll(key).filter(Boolean))) selections.push({ key, value, label: key === "min" ? `Desde ${value} €` : key === "max" ? `Hasta ${value} €` : key === "marca" ? `Marca: ${value}` : key === "disponibilidad" ? availabilityLabel(value) : `${key.slice(5)}: ${value}` });
  }
  let results = searched.filter((product) => matches(product));
  if (sort === "precio-asc") results = [...results].sort((a, b) => a.price - b.price);
  if (sort === "precio-desc") results = [...results].sort((a, b) => b.price - a.price);
  if (sort === "mejor-valorados") results = [...results].sort((a, b) => b.rating - a.rating);
  const scopePrices = scoped.map((product) => product.price);
  return { query, category, categorySlug, sort, min, max, notices, results, facets, selections, categoryOptions, allCategoryCount: searched.filter((product) => matches(product, "categoria")).length, priceRange: scopePrices.length ? { min: Math.min(...scopePrices), max: Math.max(...scopePrices) } : null };
}

export function availabilityLabel(value: string) {
  return value === "en-stock" ? "En stock · demo" : value === "agotado" ? "Agotado · demo" : `Disponibilidad: ${value}`;
}
