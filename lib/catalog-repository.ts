import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { demoProducts, categories as demoCategories } from "@/lib/catalog";
import { getServerDataMode } from "@/lib/server/data-mode";
import { getSupabaseCredentials } from "@/lib/supabase/config";
import { CATALOG_READ_ERROR, catalogDataFromSupabase, type CatalogData, type CatalogRows, type CatalogCategory } from "@/lib/catalog-mapping";

export { CATALOG_READ_ERROR, catalogDataFromSupabase, mapCatalogRows } from "@/lib/catalog-mapping";
export type { CatalogCategory, CatalogData, CatalogRows } from "@/lib/catalog-mapping";

const demoCategoryData: CatalogCategory[] = demoCategories.map((category, index) => ({
  id: category.code,
  slug: category.code,
  name: category.name,
  description: category.description,
  sortOrder: (index + 1) * 10,
}));

async function readPublishedCatalog(client: SupabaseClient): Promise<CatalogRows> {
  const productResult = await client
    .from("products")
    .select("id,slug,sku,name,brand,summary,description,image_url,image_alt,badge,is_featured,is_published")
    .eq("is_published", true)
    .order("name");

  if (productResult.error) throw productResult.error;
  const products = (productResult.data ?? []) as CatalogRows["products"];
  const categoryResult = await client.from("categories")
    .select("id,slug,name,description,sort_order,is_active")
    .eq("is_active", true)
    .order("sort_order");
  if (categoryResult.error) throw categoryResult.error;
  const categories = (categoryResult.data ?? []) as CatalogRows["categories"];
  if (!products.length) return { products, categories, productCategories: [], variants: [], specifications: [] };

  const productIds = products.map((product) => product.id);
  const [linkResult, variantResult, specificationResult] = await Promise.all([
    client.from("product_categories").select("product_id,category_id").in("product_id", productIds),
    client.from("product_variants").select("id,product_id,sku,title,current_price,compare_at_price,currency,is_active").in("product_id", productIds).eq("is_active", true),
    client.from("product_specifications").select("product_id,label,value,sort_order").in("product_id", productIds).order("sort_order"),
  ]);

  for (const result of [linkResult, variantResult, specificationResult]) {
    if (result.error) throw result.error;
  }

  return {
    products,
    categories,
    productCategories: (linkResult.data ?? []) as CatalogRows["productCategories"],
    variants: (variantResult.data ?? []) as CatalogRows["variants"],
    specifications: (specificationResult.data ?? []) as CatalogRows["specifications"],
  };
}

export async function getCatalogData(): Promise<CatalogData> {
  const mode = getServerDataMode();
  if (mode === "local-demo") return { source: "demo", products: demoProducts, categories: demoCategoryData };
  if (mode === "unavailable") {
    return { source: "error", products: [], categories: [], message: CATALOG_READ_ERROR };
  }

  const credentials = getSupabaseCredentials();
  if (!credentials) return { source: "error", products: [], categories: [], message: CATALOG_READ_ERROR };

  try {
    // Public storefront reads run under anon RLS policies; no service-role key is involved.
    const client = createClient(credentials.url, credentials.key, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });
    return await catalogDataFromSupabase(() => readPublishedCatalog(client));
  } catch {
    return { source: "error", products: [], categories: [], message: CATALOG_READ_ERROR };
  }
}

export function getCatalogSourceNotice(source: CatalogData["source"]): string | null {
  if (source === "demo") return "Catálogo local de demostración. No hay credenciales de Supabase configuradas.";
  if (source === "supabase") return "Catálogo conectado. El catálogo público no muestra unidades exactas de inventario.";
  return null;
}
