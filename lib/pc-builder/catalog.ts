import "server-only";

import { createClient } from "@supabase/supabase-js";
import { getServerDataMode } from "@/lib/server/data-mode";
import { getSupabaseCredentials } from "@/lib/supabase/config";
import { mapPcBuilderRows, type PcBuilderCatalogRows } from "./catalog-mapping";
import type { PcBuilderCatalog } from "./types";

const CATALOG_ERROR = "No se pudieron cargar las piezas del configurador. Inténtalo de nuevo.";

async function readPcBuilderCatalog(): Promise<PcBuilderCatalog> {
  const credentials = getSupabaseCredentials();
  if (!credentials) return { source: "error", components: [], omittedVariants: 0, message: CATALOG_ERROR };

  try {
    // Public catalogue data is read with the publishable key under public RLS.
    const client = createClient(credentials.url, credentials.key, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });
    const [productsResult, categoriesResult] = await Promise.all([
      client.from("products")
        .select("id,slug,name,brand,summary,is_published")
        .eq("is_published", true)
        .order("name"),
      client.from("categories")
        .select("id,slug,is_active")
        .eq("is_active", true),
    ]);
    if (productsResult.error || categoriesResult.error) throw productsResult.error ?? categoriesResult.error;

    const products = (productsResult.data ?? []) as PcBuilderCatalogRows["products"];
    const categories = (categoriesResult.data ?? []) as PcBuilderCatalogRows["categories"];
    if (products.length === 0) return { source: "supabase", components: [], omittedVariants: 0 };

    const productIds = products.map(({ id }) => id);
    const [linksResult, variantsResult] = await Promise.all([
      client.from("product_categories")
        .select("product_id,category_id")
        .in("product_id", productIds),
      client.from("product_variants")
        .select("id,product_id,sku,title,attributes,current_price,currency,is_active")
        .in("product_id", productIds)
        .eq("is_active", true),
    ]);
    if (linksResult.error || variantsResult.error) throw linksResult.error ?? variantsResult.error;

    const mapped = mapPcBuilderRows({
      products,
      categories,
      productCategories: (linksResult.data ?? []) as PcBuilderCatalogRows["productCategories"],
      variants: (variantsResult.data ?? []) as PcBuilderCatalogRows["variants"],
    });
    return { source: "supabase", ...mapped };
  } catch {
    return { source: "error", components: [], omittedVariants: 0, message: CATALOG_ERROR };
  }
}

export async function getPcBuilderCatalog(): Promise<PcBuilderCatalog> {
  const mode = getServerDataMode();
  if (mode === "local-demo") {
    // The checked-in fictional PC parts have no product or sellable variant IDs.
    // Showing them as compatible or adding them to the cart would imply a sale
    // that the catalogue cannot support.
    return { source: "demo", components: [], omittedVariants: 0 };
  }
  if (mode === "unavailable") {
    return { source: "error", components: [], omittedVariants: 0, message: CATALOG_ERROR };
  }
  return readPcBuilderCatalog();
}

