import "server-only";
import { createClient } from "@supabase/supabase-js";
import { getSupabaseCredentials } from "@/lib/supabase/config";
import { getServerDataMode } from "@/lib/server/data-mode";
import { mapDetailVariants, type DetailVariantRow } from "@/lib/content/product-editorial";

export async function getProductPurchaseData(productId: string) {
  const credentials = getSupabaseCredentials();
  if (getServerDataMode() !== "supabase" || !credentials) return { ok: false as const, variants: [], description: "" };
  try {
    // Publishable key, public RLS, no private inventory or elevated credentials.
    const client = createClient(credentials.url, credentials.key, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
    const product = await client.from("products").select("description").eq("id", productId).eq("is_published", true).maybeSingle();
    if (product.error || !product.data) throw new Error("Product unavailable");
    const result = await client.from("product_variants")
      .select("id,product_id,sku,title,current_price,compare_at_price,currency,is_active,products!inner(is_published)")
      .eq("product_id", productId).eq("is_active", true).eq("currency", "EUR").eq("products.is_published", true);
    if (result.error) throw result.error;
    return { ok: true as const, variants: mapDetailVariants((result.data ?? []) as DetailVariantRow[], productId), description: typeof product.data.description === "string" ? product.data.description : "" };
  } catch {
    return { ok: false as const, variants: [], description: "" };
  }
}
