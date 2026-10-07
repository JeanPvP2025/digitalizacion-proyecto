import "server-only";

import { getProcurementAccess, type ProcurementAccess } from "./access";

const ORDER_LIMIT = 100;
const INVENTORY_LIMIT = 500;

type SupplierDbRow = {
  id: string; supplier_code: string; name: string; contact_email: string | null;
  contact_phone: string | null; notes: string | null; is_active: boolean; created_at: string;
};
type WarehouseDbRow = { id: string; code: string; name: string; city: string };
type InventoryDbRow = {
  warehouse_id: string; variant_id: string; on_hand: number; reserved: number;
  warehouse: { code: string; name: string; city: string };
};
type VariantDbRow = { id: string; sku: string; title: string; product_id: string; is_active: boolean };
type ProductDbRow = { id: string; name: string; brand: string };
type PurchaseOrderDbRow = {
  id: string; order_number: string; supplier_id: string; supplier_name_snapshot: string;
  warehouse_id: string; status: string; expected_delivery: string | null; notes: string | null;
  created_at: string; updated_at: string; placed_at: string | null; cancelled_at: string | null; received_at: string | null;
};
type PurchaseOrderLineDbRow = {
  id: string; purchase_order_id: string; variant_id: string; sku_snapshot: string;
  product_name_snapshot: string; variant_title_snapshot: string; ordered_quantity: number;
  received_quantity: number; unit_cost: string | number; currency: string;
};
type ReceiptDbRow = {
  id: string; purchase_order_id: string; received_by: string | null; supplier_reference: string;
  requested_lines: unknown; status: string; error_code: string | null; created_at: string;
};
type ReceiptLineDbRow = { id: string; receipt_id: string; purchase_order_line_id: string; quantity: number; inventory_movement_id: number };
type EventDbRow = {
  id: number; purchase_order_id: string; event_type: string; from_status: string | null;
  to_status: string | null; details: Record<string, unknown>; created_at: string;
};

export type ProcurementSupplier = {
  id: string; code: string; name: string; contactEmail: string | null;
  contactPhone: string | null; notes: string | null; isActive: boolean; createdAt: string;
};
export type ProcurementWarehouse = { id: string; code: string; name: string; city: string };
export type ProcurementStockOption = {
  warehouseId: string; warehouseCode: string; warehouseName: string; variantId: string;
  sku: string | null; variantTitle: string | null; productName: string | null; brand: string | null;
};
export type ProcurementLine = {
  id: string; variantId: string; sku: string; productName: string; variantTitle: string;
  orderedQuantity: number; receivedQuantity: number; unitCost: number; currency: string;
};
export type ProcurementReceiptLine = { id: string; purchaseOrderLineId: string; quantity: number; inventoryMovementId: number };
export type ProcurementReceipt = {
  id: string; supplierReference: string; requestedLines: unknown; status: string;
  errorCode: string | null; createdAt: string; lines: ProcurementReceiptLine[];
};
export type ProcurementEvent = {
  id: number; eventType: string; fromStatus: string | null; toStatus: string | null;
  details: Record<string, unknown>; createdAt: string;
};
export type ProcurementOrder = {
  id: string; orderNumber: string; supplierId: string; supplierName: string; warehouseId: string;
  warehouseName: string; status: string; expectedDelivery: string | null; notes: string | null;
  createdAt: string; updatedAt: string; placedAt: string | null; cancelledAt: string | null; receivedAt: string | null;
  lines: ProcurementLine[]; receipts: ProcurementReceipt[]; events: ProcurementEvent[];
};

export type ProcurementWorkspace =
  | Exclude<ProcurementAccess, { status: "ready" }>
  | {
      status: "ready"; suppliers: ProcurementSupplier[]; warehouses: ProcurementWarehouse[];
      stockOptions: ProcurementStockOption[]; orders: ProcurementOrder[];
      isOrdersLimited: boolean; isInventoryLimited: boolean;
    };

export async function getProcurementWorkspace(): Promise<ProcurementWorkspace> {
  const access = await getProcurementAccess();
  if (access.status !== "ready") return access;

  const { supabase } = access;
  try {
    const [supplierResult, warehouseResult, inventoryResult, orderResult] = await Promise.all([
      supabase.from("inventory_suppliers").select("id, supplier_code, name, contact_email, contact_phone, notes, is_active, created_at")
        .order("is_active", { ascending: false }).order("name", { ascending: true }).limit(250).returns<SupplierDbRow[]>(),
      supabase.from("warehouses").select("id, code, name, city").eq("is_active", true).order("name").returns<WarehouseDbRow[]>(),
      supabase.from("inventory").select("warehouse_id, variant_id, on_hand, reserved, warehouse:warehouses!inner(code, name, city)")
        .order("updated_at", { ascending: false }).limit(INVENTORY_LIMIT + 1).returns<InventoryDbRow[]>(),
      supabase.from("purchase_orders").select("id, order_number, supplier_id, supplier_name_snapshot, warehouse_id, status, expected_delivery, notes, created_at, updated_at, placed_at, cancelled_at, received_at")
        .order("created_at", { ascending: false }).limit(ORDER_LIMIT + 1).returns<PurchaseOrderDbRow[]>(),
    ]);
    if (supplierResult.error || !supplierResult.data || warehouseResult.error || !warehouseResult.data
      || inventoryResult.error || !inventoryResult.data || orderResult.error || !orderResult.data) {
      return { status: "error" };
    }

    const suppliers: ProcurementSupplier[] = supplierResult.data.map((row) => ({
      id: row.id, code: row.supplier_code, name: row.name, contactEmail: row.contact_email,
      contactPhone: row.contact_phone, notes: row.notes, isActive: row.is_active, createdAt: row.created_at,
    }));
    const warehouses: ProcurementWarehouse[] = warehouseResult.data.map((row) => ({
      id: row.id, code: row.code, name: row.name, city: row.city,
    }));
    const isInventoryLimited = inventoryResult.data.length > INVENTORY_LIMIT;
    const stockRows = inventoryResult.data.slice(0, INVENTORY_LIMIT);
    const variantIds = [...new Set(stockRows.map((row) => row.variant_id))];
    let variants: VariantDbRow[] = [];
    let products: ProductDbRow[] = [];
    if (variantIds.length) {
      const variantResult = await supabase.from("product_variants").select("id, sku, title, product_id, is_active")
        .in("id", variantIds).returns<VariantDbRow[]>();
      if (!variantResult.error && variantResult.data) {
        variants = variantResult.data;
        const productIds = [...new Set(variants.map((row) => row.product_id))];
        if (productIds.length) {
          const productResult = await supabase.from("products").select("id, name, brand").in("id", productIds).returns<ProductDbRow[]>();
          if (!productResult.error && productResult.data) products = productResult.data;
        }
      }
    }
    const variantById = new Map(variants.map((row) => [row.id, row]));
    const productById = new Map(products.map((row) => [row.id, row]));
    const activeWarehouseIds = new Set(warehouses.map((row) => row.id));
    const stockOptions: ProcurementStockOption[] = stockRows.flatMap((row) => {
      const variant = variantById.get(row.variant_id);
      if (!activeWarehouseIds.has(row.warehouse_id) || !variant?.is_active) return [];
      const product = productById.get(variant.product_id);
      return [{
        warehouseId: row.warehouse_id, warehouseCode: row.warehouse.code, warehouseName: row.warehouse.name,
        variantId: row.variant_id, sku: variant.sku, variantTitle: variant.title,
        productName: product?.name ?? null, brand: product?.brand ?? null,
      }];
    });

    const isOrdersLimited = orderResult.data.length > ORDER_LIMIT;
    const orderRows = orderResult.data.slice(0, ORDER_LIMIT);
    const orderIds = orderRows.map((row) => row.id);
    const [lineResult, receiptResult, eventResult] = orderIds.length ? await Promise.all([
      supabase.from("purchase_order_lines").select("id, purchase_order_id, variant_id, sku_snapshot, product_name_snapshot, variant_title_snapshot, ordered_quantity, received_quantity, unit_cost, currency")
        .in("purchase_order_id", orderIds).order("created_at", { ascending: true }).returns<PurchaseOrderLineDbRow[]>(),
      supabase.from("purchase_order_receipts").select("id, purchase_order_id, received_by, supplier_reference, requested_lines, status, error_code, created_at")
        .in("purchase_order_id", orderIds).order("created_at", { ascending: false }).limit(500).returns<ReceiptDbRow[]>(),
      supabase.from("purchase_order_events").select("id, purchase_order_id, event_type, from_status, to_status, details, created_at")
        .in("purchase_order_id", orderIds).order("created_at", { ascending: false }).limit(1000).returns<EventDbRow[]>(),
    ]) : [
      { data: [] as PurchaseOrderLineDbRow[], error: null },
      { data: [] as ReceiptDbRow[], error: null },
      { data: [] as EventDbRow[], error: null },
    ];
    if (lineResult.error || !lineResult.data || receiptResult.error || !receiptResult.data || eventResult.error || !eventResult.data) {
      return { status: "error" };
    }

    const receiptIds = receiptResult.data.map((row) => row.id);
    const receiptLineResult = receiptIds.length
      ? await supabase.from("purchase_order_receipt_lines").select("id, receipt_id, purchase_order_line_id, quantity, inventory_movement_id")
        .in("receipt_id", receiptIds).order("created_at", { ascending: true }).returns<ReceiptLineDbRow[]>()
      : { data: [] as ReceiptLineDbRow[], error: null };
    if (receiptLineResult.error || !receiptLineResult.data) return { status: "error" };

    const supplierById = new Map(suppliers.map((row) => [row.id, row]));
    const warehouseById = new Map(warehouses.map((row) => [row.id, row]));
    const linesByOrder = groupBy(lineResult.data, (row) => row.purchase_order_id);
    const receiptsByOrder = groupBy(receiptResult.data, (row) => row.purchase_order_id);
    const receiptLinesById = groupBy(receiptLineResult.data, (row) => row.receipt_id);
    const eventsByOrder = groupBy(eventResult.data, (row) => row.purchase_order_id);
    const orders: ProcurementOrder[] = orderRows.map((row) => ({
      id: row.id, orderNumber: row.order_number, supplierId: row.supplier_id,
      supplierName: row.supplier_name_snapshot || supplierById.get(row.supplier_id)?.name || "Proveedor archivado",
      warehouseId: row.warehouse_id, warehouseName: warehouseById.get(row.warehouse_id)?.name ?? "Almacén archivado",
      status: row.status, expectedDelivery: row.expected_delivery, notes: row.notes,
      createdAt: row.created_at, updatedAt: row.updated_at, placedAt: row.placed_at,
      cancelledAt: row.cancelled_at, receivedAt: row.received_at,
      lines: (linesByOrder.get(row.id) ?? []).map((line) => ({
        id: line.id, variantId: line.variant_id, sku: line.sku_snapshot,
        productName: line.product_name_snapshot, variantTitle: line.variant_title_snapshot,
        orderedQuantity: line.ordered_quantity, receivedQuantity: line.received_quantity,
        unitCost: Number(line.unit_cost), currency: line.currency,
      })),
      receipts: (receiptsByOrder.get(row.id) ?? []).map((receipt) => ({
        id: receipt.id, supplierReference: receipt.supplier_reference, requestedLines: receipt.requested_lines,
        status: receipt.status, errorCode: receipt.error_code, createdAt: receipt.created_at,
        lines: (receiptLinesById.get(receipt.id) ?? []).map((line) => ({
          id: line.id, purchaseOrderLineId: line.purchase_order_line_id,
          quantity: line.quantity, inventoryMovementId: line.inventory_movement_id,
        })),
      })),
      events: (eventsByOrder.get(row.id) ?? []).map((event) => ({
        id: event.id, eventType: event.event_type, fromStatus: event.from_status,
        toStatus: event.to_status, details: event.details, createdAt: event.created_at,
      })),
    }));

    return { status: "ready", suppliers, warehouses, stockOptions, orders, isOrdersLimited, isInventoryLimited };
  } catch {
    return { status: "error" };
  }
}

function groupBy<T, K extends string>(rows: T[], key: (row: T) => K): Map<K, T[]> {
  const grouped = new Map<K, T[]>();
  for (const row of rows) {
    const value = key(row);
    const list = grouped.get(value) ?? [];
    list.push(row);
    grouped.set(value, list);
  }
  return grouped;
}
