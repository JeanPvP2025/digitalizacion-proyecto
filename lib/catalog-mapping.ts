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

type CatalogVisual = { url: string; alt: string };
const unsplashPhoto = (id: string, alt: string): CatalogVisual => ({
  url: `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=1200&q=85`,
  alt: `Imagen ilustrativa: ${alt}. No representa necesariamente el modelo exacto.`,
});

// The academic catalogue reuses a small number of editorial photos across many SKUs.
// Rotate those repeats through category-specific imagery while preserving unique curated photos.
const categoryVisuals: Record<string, readonly CatalogVisual[]> = {
  portatiles: [
    unsplashPhoto("1496181133206-80ce9b88a853", "un portátil abierto"),
    unsplashPhoto("1705508216613-be1715a31212", "un portátil en un escritorio"),
    unsplashPhoto("1767716843182-c2ab215555a8", "un portátil negro sobre una mesa de trabajo"),
    unsplashPhoto("1572197491557-5b1a2c767c7b", "un portátil compacto sobre una mesa"),
    unsplashPhoto("1665686310974-2ed1eb7f57ac", "un equipo portátil de trabajo"),
    unsplashPhoto("1637250046663-a6e60170f044", "un ordenador portátil en un escritorio"),
    unsplashPhoto("1652804869634-06877de0347d", "un portátil sobre una mesa clara"),
  ],
  sobremesas: [
    unsplashPhoto("1587202372775-e229f172b9d7", "un ordenador de sobremesa"),
    unsplashPhoto("1587202372634-32705e3bf49c", "una torre de ordenador"),
    unsplashPhoto("1756576630197-875e7632b19c", "una torre compacta de ordenador"),
    unsplashPhoto("1583414381542-c0ed01dc29ae", "una torre de ordenador negra y plateada"),
    unsplashPhoto("1760708528862-c07b820354c6", "el interior de un ordenador con sus componentes"),
  ],
  "estaciones-creativas": [
    unsplashPhoto("1760708528862-c07b820354c6", "componentes de una estación de trabajo"),
    unsplashPhoto("1583414381542-c0ed01dc29ae", "una torre de trabajo"),
    unsplashPhoto("1632064824547-e77c36851495", "un puesto de trabajo con monitor"),
    unsplashPhoto("1510519138101-570d1dca3d66", "un escritorio con ordenador"),
  ],
  procesadores: [
    unsplashPhoto("1555617981-dac3880eac6e", "un procesador para ordenador"),
    unsplashPhoto("1760708528862-c07b820354c6", "un procesador instalado en una placa"),
    unsplashPhoto("1771189957022-63bb560121ab", "componentes electrónicos de un ordenador"),
  ],
  "placas-base": [
    unsplashPhoto("1518770660439-4636190af475", "una placa electrónica"),
    unsplashPhoto("1760708528862-c07b820354c6", "una placa base con componentes"),
    unsplashPhoto("1771189957022-63bb560121ab", "una placa con chips de memoria"),
  ],
  "memoria-ram": [
    unsplashPhoto("1562976540-1502c2145186", "módulos de memoria para ordenador"),
    unsplashPhoto("1676554565685-3aeb5d7ad1b7", "módulos de memoria sobre una mesa"),
    unsplashPhoto("1771189957022-63bb560121ab", "chips de memoria electrónica"),
  ],
  cajas: [
    unsplashPhoto("1587202372775-e229f172b9d7", "una caja de ordenador"),
    unsplashPhoto("1756576630197-875e7632b19c", "una torre de ordenador de diseño sobrio"),
    unsplashPhoto("1583414381542-c0ed01dc29ae", "una caja de ordenador de sobremesa"),
  ],
  "fuentes-alimentacion": [
    unsplashPhoto("1591488320449-011701bb6704", "componentes internos de un ordenador"),
    unsplashPhoto("1762838362205-adb0724c5c69", "un componente de hardware para PC"),
    unsplashPhoto("1760708528862-c07b820354c6", "el interior de un ordenador"),
  ],
  "tarjetas-graficas": [
    unsplashPhoto("1762838362205-adb0724c5c69", "una tarjeta gráfica"),
    unsplashPhoto("1512756290469-ec264b7fbf87", "una tarjeta gráfica para PC"),
    unsplashPhoto("1771046831228-54766bba552b", "dos tarjetas gráficas"),
    unsplashPhoto("1760708528862-c07b820354c6", "una tarjeta gráfica instalada en una placa"),
  ],
  refrigeracion: [
    unsplashPhoto("1591488320449-011701bb6704", "el interior de un ordenador"),
    unsplashPhoto("1762838362205-adb0724c5c69", "un componente con ventilación para PC"),
    unsplashPhoto("1760708528862-c07b820354c6", "componentes y refrigeración de un ordenador"),
  ],
  concentradores: [
    unsplashPhoto("1606904825846-647eb07f5be2", "un dispositivo de red"),
    unsplashPhoto("1518770660439-4636190af475", "un circuito electrónico"),
  ],
  "monitores-oficina": [
    unsplashPhoto("1527443224154-c4a3942d3acf", "un monitor de ordenador"),
    unsplashPhoto("1705579609949-f4a73c9eee4f", "un monitor sobre un escritorio"),
    unsplashPhoto("1510519138101-570d1dca3d66", "un puesto de trabajo con pantalla"),
  ],
  "monitores-creacion": [
    unsplashPhoto("1527443224154-c4a3942d3acf", "un monitor de trabajo"),
    unsplashPhoto("1632064824547-e77c36851495", "una pantalla en un escritorio"),
    unsplashPhoto("1705579609949-f4a73c9eee4f", "un monitor de ordenador"),
  ],
  "monitores-juego": [
    unsplashPhoto("1632064824547-e77c36851495", "un monitor para jugar"),
    unsplashPhoto("1527443224154-c4a3942d3acf", "una pantalla de ordenador"),
    unsplashPhoto("1510519138101-570d1dca3d66", "un espacio de juego con monitor"),
  ],
  routers: [unsplashPhoto("1606904825846-647eb07f5be2", "un router inalámbrico")],
  "sistemas-mesh": [unsplashPhoto("1606904825846-647eb07f5be2", "un sistema de red inalámbrica")],
  switches: [
    unsplashPhoto("1606904825846-647eb07f5be2", "un equipo de red"),
    unsplashPhoto("1518770660439-4636190af475", "un circuito de comunicación"),
  ],
  moviles: [
    unsplashPhoto("1544244015-0df4b3ffc6b0", "un dispositivo móvil"),
    unsplashPhoto("1726057403600-725ebb4a20b6", "una tableta en uso"),
  ],
  tablets: [
    unsplashPhoto("1544244015-0df4b3ffc6b0", "una tableta"),
    unsplashPhoto("1726057403600-725ebb4a20b6", "una persona utilizando una tableta"),
  ],
  "ssd-internos": [
    unsplashPhoto("1597872200969-2b65d56bd16b", "una unidad SSD"),
    unsplashPhoto("1771189957022-63bb560121ab", "chips de almacenamiento"),
    unsplashPhoto("1518770660439-4636190af475", "un circuito de almacenamiento"),
  ],
  "ssd-externos": [
    unsplashPhoto("1597872200969-2b65d56bd16b", "una unidad de almacenamiento"),
    unsplashPhoto("1676554565685-3aeb5d7ad1b7", "un componente de almacenamiento"),
  ],
};

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
  const imageUseCount = new Map<string, number>();
  for (const product of rows.products) {
    if (product.image_url) imageUseCount.set(product.image_url, (imageUseCount.get(product.image_url) ?? 0) + 1);
  }
  const seenOriginalImages = new Set<string>();
  const categoryImageCursor = new Map<string, number>();
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
      // A public storefront needs an active sellable variant and an active category.
      if (!variant || !category) return [];

      const specifications = (specificationsByProduct.get(product.id) ?? [])
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .map(({ specification }) => specification);

      const linkedCategories = productCategoryIds
        .map((id) => categoriesById.get(id))
        .filter((item): item is CatalogCategory => item !== undefined)
        .sort((a, b) => Number(Boolean(a.parentId)) - Number(Boolean(b.parentId)) || a.sortOrder - b.sortOrder);
      const visualCategory = [...linkedCategories].reverse().find((item) => categoryVisuals[item.slug]) ?? category;
      const visualOptions = categoryVisuals[visualCategory.slug];
      const sourceImageIsRepeated = product.image_url && (imageUseCount.get(product.image_url) ?? 0) > 1;
      const shouldUseCategoryVisual = !product.image_url || Boolean(sourceImageIsRepeated && seenOriginalImages.has(product.image_url));
      if (product.image_url) seenOriginalImages.add(product.image_url);
      const imageIndex = categoryImageCursor.get(visualCategory.slug) ?? 0;
      categoryImageCursor.set(visualCategory.slug, imageIndex + 1);
      const categoryVisual = visualOptions?.[imageIndex % visualOptions.length];

      return [{
        id: product.id,
        categoryIds: productCategoryIds,
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
        image: shouldUseCategoryVisual ? categoryVisual?.url ?? product.image_url ?? "" : product.image_url ?? "",
        imageAlt: shouldUseCategoryVisual ? categoryVisual?.alt ?? product.image_alt : product.image_alt,
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
