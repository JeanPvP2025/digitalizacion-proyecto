import { createHash } from "node:crypto";
import verifiedReferenceCatalog from "@/lib/catalog-data/verified-reference-products.json";
import { mapPcBuilderRows, type PcBuilderCatalogRows } from "./catalog-mapping";

function variantIdForSku(sku: string) {
  const digest = createHash("md5").update("nodria-reference:" + sku).digest("hex");
  return `${digest.slice(0, 8)}-${digest.slice(8, 12)}-4${digest.slice(13, 16)}-8${digest.slice(17, 20)}-${digest.slice(20, 32)}`;
}

/** Build the same NODRIA storefront rows locally that Supabase publishes. */
export function getVerifiedReferenceBuilderCatalog() {
  const rootIds: Record<string, string> = { componentes: "root-componentes", almacenamiento: "root-almacenamiento" };
  const leafSlugs = [...new Set(verifiedReferenceCatalog.products.map((product) => product.categorySlug))];
  const categorySlugs = ["componentes", "almacenamiento", ...leafSlugs];
  const categories = categorySlugs.map((slug) => ({
    id: rootIds[slug as keyof typeof rootIds] ?? `category-${slug}`,
    slug,
    is_active: true,
  }));

  const products = verifiedReferenceCatalog.products.map((product) => ({
    id: product.id,
    slug: product.slug,
    name: product.name,
    brand: product.brand,
    summary: `${product.brand} · modelo ${product.modelNumber}. Precio de catálogo de demostración NODRIA.`,
    image_url: product.imageUrl,
    image_alt: product.imageAlt,
    is_published: true,
  }));

  const productCategories = verifiedReferenceCatalog.products.flatMap((product) => {
    const rootSlug = product.rootCategory === "Almacenamiento" ? "almacenamiento" : "componentes";
    return [
      { product_id: product.id, category_id: rootIds[rootSlug]! },
      { product_id: product.id, category_id: `category-${product.categorySlug}` },
    ];
  });

  const variants = verifiedReferenceCatalog.products.map((product) => ({
    id: variantIdForSku(product.sku),
    product_id: product.id,
    sku: product.sku,
    title: "Estándar",
    attributes: {
      pc_builder: product.pcBuilder,
      nodria_store: {
        mode: "academic_demo",
        model_number: product.modelNumber,
      },
    },
    current_price: product.priceEur,
    currency: "EUR",
    is_active: true,
  }));

  const rows: PcBuilderCatalogRows = { products, categories, productCategories, variants };
  return mapPcBuilderRows(rows);
}
