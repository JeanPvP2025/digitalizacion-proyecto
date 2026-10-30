import "server-only";

import { createClient } from "@supabase/supabase-js";
import { getServerDataMode } from "@/lib/server/data-mode";
import { getSupabaseCredentials } from "@/lib/supabase/config";
import { mapPcBuilderRows, type PcBuilderCatalogRows, type PcBuilderVariantRow } from "./catalog-mapping";
import { getVerifiedReferenceBuilderCatalog } from "./reference-catalog";
import type { PcBuilderCatalog } from "./types";

const CATALOG_ERROR = "No se pudieron cargar las piezas del configurador. Inténtalo de nuevo.";

async function readPcBuilderCatalog(): Promise<PcBuilderCatalog> {
  const credentials = getSupabaseCredentials();
  if (!credentials) return { source: "error", components: [], omittedVariants: 0, message: CATALOG_ERROR };

  try {
    // Authorized PC Builder components are read with the publishable key under public RLS.
    const client = createClient(credentials.url, credentials.key, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });

    // 1. Fetch active variants that possess the pc_builder configuration contract
    const variantsResult = await client
      .from("product_variants")
      .select("id,product_id,sku,title,attributes,current_price,currency,is_active")
      .not("attributes->pc_builder", "is", null)
      .eq("is_active", true);

    if (variantsResult.error) throw variantsResult.error;

    const variants = (variantsResult.data ?? []) as PcBuilderVariantRow[];
    if (variants.length === 0) return { source: "supabase", components: [], omittedVariants: 0 };

    const productIds = [...new Set(variants.map(({ product_id }) => product_id))];
    const variantIds = variants.map(({ id }) => id);

    // 2. Query matching products and live inventory in parallel
    const [productsResult, inventoryResult] = await Promise.all([
      client.from("products")
        .select("id,slug,name,brand,summary,image_url,image_alt,is_published")
        .in("id", productIds)
        .order("name"),
      client.from("inventory")
        .select("variant_id,on_hand,reserved")
        .in("variant_id", variantIds),
    ]);

    if (productsResult.error) throw productsResult.error;

    const inventory = (inventoryResult.data ?? []) as Array<{ variant_id: string; on_hand: number; reserved: number }>;
    const stockByVariantId = new Map<string, number>();
    for (const item of inventory) {
      const current = stockByVariantId.get(item.variant_id) ?? 0;
      stockByVariantId.set(item.variant_id, current + Math.max(0, (item.on_hand ?? 0) - (item.reserved ?? 0)));
    }

    const variantsWithStock: PcBuilderVariantRow[] = variants.map((variant) => {
      const liveStock = stockByVariantId.get(variant.id);
      return liveStock !== undefined
        ? { ...variant, stock: liveStock }
        : variant;
    });

    const products = (productsResult.data ?? []) as PcBuilderCatalogRows["products"];

    const mapped = mapPcBuilderRows({
      products,
      variants: variantsWithStock,
    });

    return { source: "supabase", ...mapped };
  } catch {
    return { source: "error", components: [], omittedVariants: 0, message: CATALOG_ERROR };
  }
}

export async function getPcBuilderCatalog(): Promise<PcBuilderCatalog> {
  const mode = getServerDataMode();
  if (mode === "local-demo") {
    // Show the same NODRIA product catalog as Supabase in local development.
    return { source: "demo", ...getVerifiedReferenceBuilderCatalog() };
  }
  if (mode === "unavailable") {
    return { source: "error", components: [], omittedVariants: 0, message: CATALOG_ERROR };
  }
  return readPcBuilderCatalog();
}
