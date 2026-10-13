import type { Product, ProductCategory, ProductPriceReference, ProductSpecification } from "@/lib/catalog";

export type CatalogCategory = {
  id: string;
  slug: string;
  name: string;
  description: string;
  sortOrder: number;
  parentId?: string | null;
};

export type CatalogProduct = Product & { categoryIds?: readonly string[] };

type ProductRow = {
  id: string;
  slug: string;
  sku: string;
  name: string;
  brand: string;
  summary: string;
  description: string;
  image_url: string | null;
  image_alt: string;
  badge: string | null;
  is_featured: boolean;
  is_published: boolean;
};

type CategoryRow = {
  id: string;
  slug: string;
  name: string;
  description: string;
  sort_order: number;
  parent_id?: string | null;
  is_active: boolean;
};

type ProductCategoryRow = { product_id: string; category_id: string };

type VariantRow = {
  id: string;
  product_id: string;
  sku: string;
  title: string;
  current_price: number | string;
  compare_at_price: number | string | null;
  currency: string;
  is_active: boolean;
  attributes?: unknown;
};

type SpecificationRow = {
  product_id: string;
  label: string;
  value: string;
  sort_order: number;
};

export type CatalogRows = {
  products: ProductRow[];
  categories: CategoryRow[];
  productCategories: ProductCategoryRow[];
  variants: VariantRow[];
  specifications: SpecificationRow[];
};

export type CatalogData =
  | { source: "demo"; products: CatalogProduct[]; categories: CatalogCategory[] }
  | { source: "supabase"; products: CatalogProduct[]; categories: CatalogCategory[] }
  | { source: "error"; products: []; categories: []; message: string };

export const CATALOG_READ_ERROR = "No se pudo cargar el catálogo. Inténtalo de nuevo más tarde.";
const productCategories = new Set<ProductCategory>(["Ordenadores", "Componentes", "Monitores", "Redes", "Telefonía", "Almacenamiento"]);

type PcComponentReference = {
  source: "PcComponentes";
  seller: "PcComponentes";
  url: string;
  observed_at: string;
  price_eur: number;
  image_url: string;
  mpn?: string | null;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isPcComponentHost(hostname: string): boolean {
  return hostname === "www.pccomponentes.com";
}

function getPriceReference(variant: VariantRow, productImageUrl: string): { reference: ProductPriceReference; price: number; modelNumber?: string } | null {
  if (!isRecord(variant.attributes) || !isRecord(variant.attributes.reference_price)) return null;
  const reference = variant.attributes.reference_price as Partial<PcComponentReference>;
  const price = Number(variant.current_price);
  if (reference.source !== "PcComponentes" || reference.seller !== "PcComponentes" ||
      typeof reference.url !== "string" || typeof reference.observed_at !== "string" ||
      !/^\d{4}-\d{2}-\d{2}$/.test(reference.observed_at) ||
      typeof reference.price_eur !== "number" || !Number.isFinite(reference.price_eur) ||
      typeof reference.image_url !== "string" || reference.image_url !== productImageUrl ||
      Math.abs(reference.price_eur - price) > 0.001) return null;
  try {
    const url = new URL(reference.url);
    if (url.protocol !== "https:" || !isPcComponentHost(url.hostname)) return null;
  } catch {
    return null;
  }
  return {
    reference: {
      retailer: "PcComponentes",
      productUrl: reference.url,
      checkedAt: reference.observed_at,
      ...(typeof reference.mpn === "string" && reference.mpn.trim() ? { modelNumber: reference.mpn.trim() } : {}),
    },
    price,
    ...(typeof reference.mpn === "string" && reference.mpn.trim() ? { modelNumber: reference.mpn.trim() } : {}),
  };
}

function isExactProductPhoto(url: string | null): url is string {
  if (!url) return false;
  try {
    const parsed = new URL(url);
    const productImageHost = parsed.hostname === "img.pccomponentes.com" || parsed.hostname === "thumb.pccomponentes.com";
    const productImagePath = /\/articles\//.test(parsed.pathname);
    return parsed.protocol === "https:" && productImageHost && productImagePath;
  } catch {
    return false;
  }
}

function isProductCategory(value: string): value is ProductCategory {
  return productCategories.has(value as ProductCategory);
}

export function mapCatalogRows(rows: CatalogRows): { products: CatalogProduct[]; categories: CatalogCategory[] } {
  const categories = rows.categories
    .filter((category) => category.is_active)
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((category): CatalogCategory => ({
      id: category.id,
      slug: category.slug,
      name: category.name as ProductCategory,
      description: category.description,
      sortOrder: category.sort_order,
      parentId: category.parent_id ?? null,
    }));
  const activeCategoryIds = new Set(categories.map((category) => category.id));
  const categoryIdsByProduct = new Map<string, string[]>();
  for (const link of rows.productCategories) {
    if (!activeCategoryIds.has(link.category_id)) continue;
    const ids = categoryIdsByProduct.get(link.product_id) ?? [];
    ids.push(link.category_id);
    categoryIdsByProduct.set(link.product_id, ids);
  }

  const variantsByProduct = new Map<string, VariantRow[]>();
  for (const variant of rows.variants) {
    if (!variant.is_active) continue;
    const variants = variantsByProduct.get(variant.product_id) ?? [];
    variants.push(variant);
    variantsByProduct.set(variant.product_id, variants);
  }

  const specificationsByProduct = new Map<string, Array<{ specification: ProductSpecification; sortOrder: number }>>();
  for (const specification of rows.specifications) {
    const specifications = specificationsByProduct.get(specification.product_id) ?? [];
    specifications.push({ specification: { label: specification.label, value: specification.value }, sortOrder: specification.sort_order });
    specificationsByProduct.set(specification.product_id, specifications);
  }

  const categoriesById = new Map(categories.map((category) => [category.id, category]));
  const seenImageUrls = new Set<string>();
  const products = rows.products
    .filter((product) => product.is_published)
    .flatMap((product): CatalogProduct[] => {
      const variant = (variantsByProduct.get(product.id) ?? [])
        .filter((item) => item.currency === "EUR")
        .sort((a, b) => Number(b.sku === product.sku) - Number(a.sku === product.sku) || Number(a.current_price) - Number(b.current_price))[0];
      const productCategoryIds = categoryIdsByProduct.get(product.id) ?? [];
      const category = productCategoryIds
        .map((id) => categoriesById.get(id))
        .filter((item): item is CatalogCategory & { name: ProductCategory } => item !== undefined && isProductCategory(item.name))
        .sort((a, b) => a.sortOrder - b.sortOrder)[0];
      // Only products with a source-checked model price and its own product photo enter the store.
      if (!variant || !category || !isExactProductPhoto(product.image_url) || !product.image_alt.trim() || seenImageUrls.has(product.image_url)) return [];
      const priceReference = getPriceReference(variant, product.image_url);
      if (!priceReference) return [];
      seenImageUrls.add(product.image_url);

      const specifications = (specificationsByProduct.get(product.id) ?? [])
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .map(({ specification }) => specification);

      return [{
        id: product.id,
        categoryIds: productCategoryIds,
        slug: product.slug,
        sku: variant.sku,
        name: product.name,
        category: category.name,
        brand: product.brand,
        ...(priceReference.modelNumber ? { modelNumber: priceReference.modelNumber } : {}),
        price: priceReference.price,
        priceReference: priceReference.reference,
        // Seeded aggregate ratings are not backed by a connected review workflow yet.
        rating: 0,
        reviewCount: 0,
        // Exact inventory is protected by RLS. Connected storefront UI must not treat this as stock.
        stock: 0,
        image: product.image_url,
        imageAlt: product.image_alt,
        ...(product.badge ? { badge: product.badge } : {}),
        summary: product.summary,
        specifications,
        featured: product.is_featured,
      }];
    });

  return { products, categories };
}

export async function catalogDataFromSupabase(readRows: () => Promise<CatalogRows>): Promise<CatalogData> {
  try {
    return { source: "supabase", ...mapCatalogRows(await readRows()) };
  } catch {
    return { source: "error", products: [], categories: [], message: CATALOG_READ_ERROR };
  }
}
