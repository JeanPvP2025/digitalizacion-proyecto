import "server-only";

import { getProcurementAccess, type ProcurementAccess } from "./procurement/access";

type RequestRow = { id: string; return_number: string; order_id: string; requested_at: string };
type ReturnItemRow = {
  id: string; return_request_id: string; order_item_id: string; quantity: number;
  inventory_disposition: string; inspection_quantity: number;
};
type OrderItemRow = {
  id: string; product_name: string; product_sku: string; variant_title: string;
  variant_id: string | null; order_id: string;
};
type WarehouseRow = { id: string; code: string; name: string; city: string };
type OrderRow = { id: string; order_number: string };

export type ReturnInspectionItem = {
  id: string;
  orderItemId: string;
  productName: string;
  sku: string;
  variantTitle: string;
  variantId: string | null;
  quantity: number;
};
export type ReturnInspectionCase = {
  id: string;
  returnNumber: string;
  orderNumber: string;
  requestedAt: string;
  items: ReturnInspectionItem[];
};
export type ReturnInspectionWorkspace =
  | Exclude<ProcurementAccess, { status: "ready" }>
  | { status: "ready"; cases: ReturnInspectionCase[]; warehouses: WarehouseRow[] };

export async function getReturnInspectionWorkspace(): Promise<ReturnInspectionWorkspace> {
  const access = await getProcurementAccess();
  if (access.status !== "ready") return access;
  const { supabase } = access;

  const [requestResult, warehouseResult] = await Promise.all([
    supabase.from("return_requests")
      .select("id, return_number, order_id, requested_at")
      .eq("status", "approved")
      .order("requested_at", { ascending: false })
      .limit(100)
      .returns<RequestRow[]>(),
    supabase.from("warehouses").select("id, code, name, city")
      .eq("is_active", true).order("name").returns<WarehouseRow[]>(),
  ]);
  if (requestResult.error || !requestResult.data || warehouseResult.error || !warehouseResult.data) return { status: "error" };
  if (!requestResult.data.length) return { status: "ready", cases: [], warehouses: warehouseResult.data };

  const requestIds = requestResult.data.map(({ id }) => id);
  const [itemResult, orderResult] = await Promise.all([
    supabase.from("return_items")
      .select("id, return_request_id, order_item_id, quantity, inventory_disposition, inspection_quantity")
      .in("return_request_id", requestIds)
      .eq("inventory_disposition", "pending_inspection")
      .order("created_at", { ascending: true })
      .limit(500)
      .returns<ReturnItemRow[]>(),
    supabase.from("orders").select("id, order_number")
      .in("id", [...new Set(requestResult.data.map(({ order_id }) => order_id))])
      .returns<OrderRow[]>(),
  ]);
  if (itemResult.error || !itemResult.data || orderResult.error || !orderResult.data) return { status: "error" };
  const orderItemIds = [...new Set(itemResult.data.map(({ order_item_id }) => order_item_id))];
  const orderItemsResult = orderItemIds.length
    ? await supabase.from("order_items")
      .select("id, product_name, product_sku, variant_title, variant_id, order_id")
      .in("id", orderItemIds).returns<OrderItemRow[]>()
    : { data: [] as OrderItemRow[], error: null };
  if (orderItemsResult.error || !orderItemsResult.data) return { status: "error" };

  const orderNumbers = new Map(orderResult.data.map((row) => [row.id, row.order_number]));
  const orderItems = new Map(orderItemsResult.data.map((row) => [row.id, row]));
  const itemsByRequest = new Map<string, ReturnInspectionItem[]>();
  for (const item of itemResult.data) {
    const orderItem = orderItems.get(item.order_item_id);
    if (!orderItem || item.inventory_disposition !== "pending_inspection") continue;
    const list = itemsByRequest.get(item.return_request_id) ?? [];
    list.push({
      id: item.id,
      orderItemId: item.order_item_id,
      productName: orderItem.product_name,
      sku: orderItem.product_sku,
      variantTitle: orderItem.variant_title,
      variantId: orderItem.variant_id,
      quantity: item.inspection_quantity,
    });
    itemsByRequest.set(item.return_request_id, list);
  }

  return {
    status: "ready",
    warehouses: warehouseResult.data,
    cases: requestResult.data.flatMap((request) => {
      const items = itemsByRequest.get(request.id) ?? [];
      if (!items.length) return [];
      return [{
        id: request.id,
        returnNumber: request.return_number,
        orderNumber: orderNumbers.get(request.order_id) ?? "Pedido",
        requestedAt: request.requested_at,
        items,
      }];
    }),
  };
}
