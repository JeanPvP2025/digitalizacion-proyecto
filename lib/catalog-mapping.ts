import type { Product, ProductCategory, ProductSpecification } from "@/lib/catalog";

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

type AvailabilityRow = { variant_id: string; available_quantity: number | string };
type PublishedReviewRow = { product_id: string; average_rating: number | string; review_count: number | string };

export type CatalogRows = {
  products: ProductRow[];
  categories: CategoryRow[];
  productCategories: ProductCategoryRow[];
  variants: VariantRow[];
  specifications: SpecificationRow[];
  availability?: AvailabilityRow[];
  publishedReviews?: PublishedReviewRow[];
};

export type CatalogData =
  | { source: "demo"; products: CatalogProduct[]; categories: CatalogCategory[] }
  | { source: "supabase"; products: CatalogProduct[]; categories: CatalogCategory[] }
  | { source: "error"; products: []; categories: []; message: string };

export const CATALOG_READ_ERROR = "No se pudo cargar el catálogo. Inténtalo de nuevo más tarde.";
const productCategories = new Set<ProductCategory>([
  "Infraestructuras de Telecomunicaciones",
  "Equipos y Sistemas de Telecomunicaciones",
  "Domótica y Hogar Digital",
  "Telefonía y Comunicaciones",
  "Digitalización e Industria Conectada",
  "Ordenadores",
  "Componentes",
  "Monitores",
  "Redes",
  "Telefonía",
  "Almacenamiento",
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function getModelNumber(attributes: unknown): string | undefined {
  if (!isRecord(attributes) || !isRecord(attributes.nodria_store)) return undefined;
  const modelNumber = attributes.nodria_store.model_number;
  return typeof modelNumber === "string" && modelNumber.trim() ? modelNumber.trim() : undefined;
}

function isNodriaStoreVariant(attributes: unknown): boolean {
  return isRecord(attributes) && isRecord(attributes.nodria_store) && attributes.nodria_store.mode === "academic_demo";
}

function publishedReviewAggregates(reviews: PublishedReviewRow[] = []) {
  const totals = new Map<string, { count: number; average: number }>();
  for (const review of reviews) {
    const count = Number(review.review_count);
    const average = Number(review.average_rating);
    if (!Number.isSafeInteger(count) || count < 1 || !Number.isFinite(average) || average < 1 || average > 5) continue;
    totals.set(review.product_id, { count, average });
  }
  return totals;
}

function isExactProductPhoto(url: string | null): url is string {
  if (!url) return false;
  if (url.startsWith("/images/products/") || url.startsWith("/images/")) {
    return /\.(svg|webp|png|jpg|jpeg)$/i.test(url);
  }
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
  const availabilityByVariant = new Map((rows.availability ?? []).map((item) => [item.variant_id, item.available_quantity]));
  const reviewAggregates = publishedReviewAggregates(rows.publishedReviews);
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
      // Only published products with their own product photo enter the store.
      if (!variant || !category || !isNodriaStoreVariant(variant.attributes) || !isExactProductPhoto(product.image_url) || !product.image_alt.trim() || seenImageUrls.has(product.image_url)) return [];
      seenImageUrls.add(product.image_url);

      const specifications = (specificationsByProduct.get(product.id) ?? [])
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .map(({ specification }) => specification);

      const aggregate = reviewAggregates.get(product.id) ?? { count: 0, average: 0 };
      return [{
        id: product.id,
        categoryIds: productCategoryIds,
        slug: product.slug,
        sku: variant.sku,
        name: product.name,
        category: category.name,
        brand: product.brand,
        ...(getModelNumber(variant.attributes) ? { modelNumber: getModelNumber(variant.attributes) } : {}),
        price: Number(variant.current_price),
        rating: aggregate.count > 0 ? aggregate.average : 0,
        reviewCount: aggregate.count,
        stock: Math.max(0, Number(availabilityByVariant.get(variant.id) ?? 0)),
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
