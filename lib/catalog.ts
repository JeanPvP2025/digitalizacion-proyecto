import verifiedReferenceCatalog from "./catalog-data/verified-reference-products.json";

export type ProductCategory = "Ordenadores" | "Componentes" | "Monitores" | "Redes" | "Telefonía" | "Almacenamiento";

export type ProductSpecification = {
  label: string;
  value: string;
};

export type Product = {
  id: string;
  slug: string;
  sku: string;
  name: string;
  category: ProductCategory;
  brand: string;
  modelNumber?: string;
  price: number;
  previousPrice?: number;
  rating: number;
  reviewCount: number;
  stock: number;
  image: string;
  imageAlt: string;
  badge?: string;
  summary: string;
  specifications: ProductSpecification[];
  featured?: boolean;
};

const featuredReferenceIds = new Set(
  verifiedReferenceCatalog.products
    .filter((product, index, products) => products.findIndex((candidate) => candidate.categorySlug === product.categorySlug) === index)
    .map((product) => product.id),
);

/** Product records used by NODRIA's academic storefront simulation. */
export const demoProducts: Product[] = verifiedReferenceCatalog.products.map((product) => ({
  id: product.id,
  slug: product.slug,
  sku: product.sku,
  name: product.name,
  category: product.rootCategory === "Almacenamiento" ? "Almacenamiento" : "Componentes",
  brand: product.brand,
  modelNumber: product.modelNumber,
  price: product.priceEur,
  rating: 0,
  reviewCount: 0,
  stock: 12,
  image: product.imageUrl,
  imageAlt: product.imageAlt,
  summary: `${product.brand} · modelo ${product.modelNumber}. Precio de catálogo para la experiencia de compra de demostración NODRIA.`,
  specifications: product.specifications,
  featured: featuredReferenceIds.has(product.id),
}));

export const categories = [
  { name: "Componentes", code: "componentes", description: "Procesadores, placas, memoria, gráficas, cajas, fuentes y refrigeración." },
  { name: "Almacenamiento", code: "almacenamiento", description: "Unidades SSD para ampliar tu equipo." },
] as const;

export const formatPrice = (price: number) =>
  new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR", minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(price);

/** Explicitly local-mode lookup for the academic storefront simulation. */
export const getDemoProduct = (slug: string) => demoProducts.find((product) => product.slug === slug);
