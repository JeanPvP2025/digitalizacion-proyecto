import verifiedReferenceCatalog from "./catalog-data/verified-reference-products.json";

export type ProductCategory = "Ordenadores" | "Componentes" | "Monitores" | "Redes" | "Telefonía" | "Almacenamiento";

export type ProductSpecification = {
  label: string;
  value: string;
};

export type ProductPriceReference = {
  retailer: "PcComponentes";
  productUrl: string;
  checkedAt: string;
  modelNumber?: string;
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
  priceReference?: ProductPriceReference;
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

/** Product references checked against PcComponentes. They are not NODRIA inventory or offers. */
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
  stock: 0,
  image: product.imageUrl,
  imageAlt: product.imageAlt,
  priceReference: {
    retailer: "PcComponentes",
    productUrl: product.productUrl,
    checkedAt: product.checkedAt,
    modelNumber: product.modelNumber,
  },
  summary: product.summary,
  specifications: product.specifications,
  featured: featuredReferenceIds.has(product.id),
}));

export const categories = [
  { name: "Componentes", code: "componentes", description: "Procesadores, placas, memoria, gráficas, cajas, fuentes y refrigeración con fichas de referencia." },
  { name: "Almacenamiento", code: "almacenamiento", description: "SSD con precio e imagen de referencia enlazados al vendedor." },
] as const;

export const formatPrice = (price: number) =>
  new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR", minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(price);

/** Explicitly local-mode lookup; the records themselves are verified external references. */
export const getDemoProduct = (slug: string) => demoProducts.find((product) => product.slug === slug);
