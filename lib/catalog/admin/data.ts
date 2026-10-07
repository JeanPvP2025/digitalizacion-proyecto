import "server-only";

import type { SupabaseServerClient } from "@/lib/supabase/auth";
import type { CatalogAdminProduct } from "./contracts";

export type CatalogAdminSnapshot =
  | { status: "ready"; products: CatalogAdminProduct[]; truncated: boolean }
  | { status: "error" };

export async function listCatalogAdminProducts(supabase: SupabaseServerClient): Promise<CatalogAdminSnapshot> {
  try {
    const result = await supabase.from("products")
      .select("id, slug, sku, name, brand, summary, description, image_url, image_alt, badge, is_published, updated_at")
      .order("name", { ascending: true })
      .limit(501)
      .returns<CatalogAdminProduct[]>();
    if (result.error || !result.data) return { status: "error" };
    return {
      status: "ready",
      products: result.data.slice(0, 500),
      truncated: result.data.length > 500,
    };
  } catch {
    return { status: "error" };
  }
}

