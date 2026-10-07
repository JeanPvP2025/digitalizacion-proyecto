import type { Product, ProductCategory, ProductSpecification } from "@/lib/catalog";

export type CatalogCategory = {
  id: string;
  slug: string;
  name: ProductCategory;
  description: string;
  sortOrder: number;
};

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
  | { source: "demo"; products: Product[]; categories: CatalogCategory[] }
  | { source: "supabase"; products: Product[]; categories: CatalogCategory[] }
  | { source: "error"; products: []; categories: []; message: string };

export const CATALOG_READ_ERROR = "No se pudo cargar el catálogo. Inténtalo de nuevo más tarde.";
const productCategories = new Set<ProductCategory>(["Ordenadores", "Componentes", "Monitores", "Redes", "Telefonía", "Almacenamiento"]);

function isProductCategory(value: string): value is ProductCategory {
  return productCategories.has(value as ProductCategory);
}

export function mapCatalogRows(rows: CatalogRows): { products: Product[]; categories: CatalogCategory[] } {
  const categories = rows.categories
    .filter((category) => category.is_active && isProductCategory(category.name))
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((category) => ({
      id: category.id,
      slug: category.slug,
      name: category.name as ProductCategory,
      description: category.description,
      sortOrder: category.sort_order,
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
  const products = rows.products
    .filter((product) => product.is_published)
    .flatMap((product): Product[] => {
      const variant = (variantsByProduct.get(product.id) ?? [])
        .filter((item) => item.currency === "EUR")
        .sort((a, b) => Number(b.sku === product.sku) - Number(a.sku === product.sku) || Number(a.current_price) - Number(b.current_price))[0];
      const category = (categoryIdsByProduct.get(product.id) ?? [])
        .map((id) => categoriesById.get(id))
        .filter((item): item is CatalogCategory => Boolean(item))
        .sort((a, b) => a.sortOrder - b.sortOrder)[0];
      // A public storefront needs an active sellable variant and an active category.
      if (!variant || !category) return [];

      const specifications = (specificationsByProduct.get(product.id) ?? [])
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .map(({ specification }) => specification);

      return [{
        id: product.id,
        slug: product.slug,
        sku: variant.sku,
        name: product.name,
        category: category.name,
        brand: product.brand,
        price: Number(variant.current_price),
        ...(variant.compare_at_price === null ? {} : { previousPrice: Number(variant.compare_at_price) }),
        // Seeded aggregate ratings are not backed by a connected review workflow yet.
        rating: 0,
        reviewCount: 0,
        // Exact inventory is protected by RLS. Connected storefront UI must not treat this as stock.
        stock: 0,
        image: product.image_url ?? "",
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
