import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";

const INVENTORY_READ_LIMIT = 500;
const STAFF_ROLES = ["fulfillment_manager", "super_admin"] as const;

type InventoryDbRow = {
  warehouse_id: string;
  variant_id: string;
  on_hand: number;
  reserved: number;
  updated_at: string;
  warehouse: {
    code: string;
    name: string;
    city: string;
  };
};

type VariantDbRow = {
  id: string;
  sku: string;
  title: string;
  product_id: string;
};

type ProductDbRow = {
  id: string;
  name: string;
  brand: string;
};

export type InventoryRow = {
  warehouseId: string;
  warehouseCode: string;
  warehouseName: string;
  warehouseCity: string;
  variantId: string;
  sku: string | null;
  variantTitle: string | null;
  productName: string | null;
  brand: string | null;
  onHand: number;
  reserved: number;
  available: number;
  updatedAt: string;
};

export type InventorySnapshot =
  | { status: "not_configured" }
  | { status: "unauthenticated" }
  | { status: "forbidden" }
  | { status: "error" }
  | {
      status: "ready";
      rows: InventoryRow[];
      isLimited: boolean;
      variantDetailsLimited: boolean;
    };

/** Reads inventory only after checking the caller's persisted staff role. */
export async function getInventorySnapshot(): Promise<InventorySnapshot> {
  try {
    const supabase = await createSupabaseServerClient();
    if (!supabase) return { status: "not_configured" };

    const { data: authData, error: authError } = await supabase.auth.getUser();
    const user = authData.user;
    if (authError) return { status: "error" };
    if (!user) return { status: "unauthenticated" };

    const { data: roleGrants, error: roleError } = await supabase
      .from("user_role_grants")
      .select("role")
      .eq("user_id", user.id)
      .in("role", [...STAFF_ROLES])
      .returns<{ role: string }[]>();

    if (roleError) return { status: "error" };
    if (!roleGrants?.some(({ role }) => role === "fulfillment_manager" || role === "super_admin")) {
      return { status: "forbidden" };
    }

    const { data: inventoryData, error: inventoryError } = await supabase
      .from("inventory")
      .select("warehouse_id, variant_id, on_hand, reserved, updated_at, warehouse:warehouses!inner(code, name, city)")
      .order("updated_at", { ascending: false })
      .limit(INVENTORY_READ_LIMIT + 1)
      .returns<InventoryDbRow[]>();

    if (inventoryError || !inventoryData) return { status: "error" };

    const isLimited = inventoryData.length > INVENTORY_READ_LIMIT;
    const stockRows = inventoryData.slice(0, INVENTORY_READ_LIMIT);
    const variantIds = [...new Set(stockRows.map(({ variant_id }) => variant_id))];
    let variantDetailsLimited = false;
    let variants: VariantDbRow[] = [];
    let products: ProductDbRow[] = [];

    if (variantIds.length) {
      const { data, error } = await supabase
        .from("product_variants")
        .select("id, sku, title, product_id")
        .in("id", variantIds)
        .returns<VariantDbRow[]>();

      if (error || !data) {
        variantDetailsLimited = true;
      } else {
        variants = data;
        variantDetailsLimited = variants.length < variantIds.length;

        const productIds = [...new Set(variants.map(({ product_id }) => product_id))];
        if (productIds.length) {
          const { data: productData, error: productError } = await supabase
            .from("products")
            .select("id, name, brand")
            .in("id", productIds)
            .returns<ProductDbRow[]>();

          if (productError || !productData) {
            variantDetailsLimited = true;
          } else {
            products = productData;
            if (products.length < productIds.length) variantDetailsLimited = true;
          }
        }
      }
    }

    const variantById = new Map(variants.map((variant) => [variant.id, variant]));
    const productById = new Map(products.map((product) => [product.id, product]));
    const rows = stockRows.map((row): InventoryRow => {
      const variant = variantById.get(row.variant_id);
      const product = variant ? productById.get(variant.product_id) : undefined;
      return {
        warehouseId: row.warehouse_id,
        warehouseCode: row.warehouse.code,
        warehouseName: row.warehouse.name,
        warehouseCity: row.warehouse.city,
        variantId: row.variant_id,
        sku: variant?.sku ?? null,
        variantTitle: variant?.title ?? null,
        productName: product?.name ?? null,
        brand: product?.brand ?? null,
        onHand: row.on_hand,
        reserved: row.reserved,
        available: row.on_hand - row.reserved,
        updatedAt: row.updated_at,
      };
    });

    return { status: "ready", rows, isLimited, variantDetailsLimited };
  } catch {
    return { status: "error" };
  }
}
