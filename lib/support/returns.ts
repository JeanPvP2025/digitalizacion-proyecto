import "server-only";

import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const orderNumberSchema = z.string().trim().min(1).max(40);

export const returnRequestSchema = z.object({
  orderNumber: orderNumberSchema,
  reason: z.string().trim().min(10).max(2000),
  idempotencyKey: z.uuid(),
  items: z.array(z.object({
    orderItemId: z.uuid(),
    quantity: z.number().int().min(1).max(100),
  }).strict()).min(1).max(50),
}).strict().superRefine((request, context) => {
  const ids = request.items.map((item) => item.orderItemId);
  if (new Set(ids).size !== ids.length) {
    context.addIssue({ code: "custom", path: ["items"], message: "No repitas una misma línea del pedido." });
  }
});

type SupabaseServerClient = NonNullable<Awaited<ReturnType<typeof createSupabaseServerClient>>>;

export type ReturnableOrderResult =
  | { ok: true; orderNumber: string; items: Array<{ id: string; name: string; sku: string; variant: string; orderedQuantity: number; availableQuantity: number }> }
  | { ok: false; reason: "order_not_owned" | "not_eligible" | "no_units_left" | "database_error" };

export function isReturnWithinWindow(status: unknown, deliveredAt: unknown, now = Date.now()) {
  if (status !== "delivered" || typeof deliveredAt !== "string") return false;
  const deliveredAtMs = Date.parse(deliveredAt);
  const windowMs = 30 * 24 * 60 * 60 * 1000;
  return Number.isFinite(deliveredAtMs) && deliveredAtMs <= now && deliveredAtMs >= now - windowMs;
}

async function hasActiveOrganizationMembership(
  supabase: SupabaseServerClient,
  userId: string,
  organizationId: string | null,
) {
  if (!organizationId) return { allowed: true, error: null };
  const { data, error } = await supabase
    .from("organization_memberships")
    .select("organization_id")
    .eq("user_id", userId)
    .eq("organization_id", organizationId)
    .maybeSingle();
  return { allowed: Boolean(data), error };
}

export async function loadReturnableOrder(
  supabase: SupabaseServerClient,
  userId: string,
  orderNumber: string,
  now = Date.now(),
): Promise<ReturnableOrderResult> {
  const { data: order, error: orderError } = await supabase
    .from("orders")
    .select("id, order_number, status, delivered_at, organization_id")
    .eq("order_number", orderNumber)
    .eq("customer_id", userId)
    .maybeSingle();
  if (orderError) return { ok: false, reason: "database_error" };
  if (!order) return { ok: false, reason: "order_not_owned" };

  const membership = await hasActiveOrganizationMembership(
    supabase,
    userId,
    order.organization_id ? String(order.organization_id) : null,
  );
  if (membership.error) return { ok: false, reason: "database_error" };
  if (!membership.allowed) return { ok: false, reason: "order_not_owned" };

  if (!isReturnWithinWindow(order.status, order.delivered_at, now)) {
    return { ok: false, reason: "not_eligible" };
  }

  const { data: orderItems, error: itemsError } = await supabase
    .from("order_items")
    .select("id, product_name, product_sku, variant_title, quantity")
    .eq("order_id", order.id)
    .order("created_at", { ascending: true });
  if (itemsError) return { ok: false, reason: "database_error" };

  const { data: requests, error: requestsError } = await supabase
    .from("return_requests")
    .select("id, status")
    .eq("order_id", order.id);
  if (requestsError) return { ok: false, reason: "database_error" };

  const activeRequests = (requests ?? []).filter((request) => request.status !== "rejected");
  const requestedByItem = new Map<string, number>();
  if (activeRequests.length > 0) {
    const { data: returnItems, error: returnItemsError } = await supabase
      .from("return_items")
      .select("order_item_id, quantity")
      .in("return_request_id", activeRequests.map((request) => String(request.id)));
    if (returnItemsError) return { ok: false, reason: "database_error" };
    for (const item of returnItems ?? []) {
      const itemId = String(item.order_item_id);
      requestedByItem.set(itemId, (requestedByItem.get(itemId) ?? 0) + Number(item.quantity));
    }
  }

  const items = (orderItems ?? []).map((item) => {
    const orderedQuantity = Number(item.quantity);
    return {
      id: String(item.id),
      name: String(item.product_name),
      sku: String(item.product_sku),
      variant: String(item.variant_title),
      orderedQuantity,
      availableQuantity: Math.max(0, orderedQuantity - (requestedByItem.get(String(item.id)) ?? 0)),
    };
  }).filter((item) => item.availableQuantity > 0);

  if (items.length === 0) return { ok: false, reason: "no_units_left" };
  return { ok: true, orderNumber: String(order.order_number), items };
}

export type CreateReturnResult =
  | { ok: true; returnId: string; returnNumber: string }
  | { ok: false; reason: "order_not_owned" | "not_eligible" | "quantity_conflict" | "invalid_request" | "database_error" };

export async function createReturnRequest(
  supabase: SupabaseServerClient,
  userId: string,
  submission: z.infer<typeof returnRequestSchema>,
): Promise<CreateReturnResult> {
  const { data: order, error: orderError } = await supabase
    .from("orders")
    .select("id, organization_id")
    .eq("order_number", submission.orderNumber)
    .eq("customer_id", userId)
    .maybeSingle();
  if (orderError) return { ok: false, reason: "database_error" };
  if (!order) return { ok: false, reason: "order_not_owned" };

  const membership = await hasActiveOrganizationMembership(
    supabase,
    userId,
    order.organization_id ? String(order.organization_id) : null,
  );
  if (membership.error) return { ok: false, reason: "database_error" };
  if (!membership.allowed) return { ok: false, reason: "order_not_owned" };

  const { data: returnId, error: returnError } = await supabase.rpc("request_return", {
    p_order_id: String(order.id),
    p_reason: submission.reason,
    p_items: submission.items.map((item) => ({ order_item_id: item.orderItemId, quantity: item.quantity })),
    p_idempotency_key: submission.idempotencyKey,
  });
  if (returnError) {
    if (returnError.code === "P0002") return { ok: false, reason: "order_not_owned" };
    if (returnError.code === "23514") {
      return returnError.message.includes("30 days after delivery")
        ? { ok: false, reason: "not_eligible" }
        : { ok: false, reason: "quantity_conflict" };
    }
    if (returnError.code === "22023") return { ok: false, reason: "invalid_request" };
    if (returnError.code === "28000") return { ok: false, reason: "order_not_owned" };
    return { ok: false, reason: "database_error" };
  }
  if (typeof returnId !== "string") return { ok: false, reason: "database_error" };

  const { data: request, error: readError } = await supabase
    .from("return_requests")
    .select("return_number")
    .eq("id", returnId)
    .maybeSingle();
  if (readError || !request?.return_number) return { ok: false, reason: "database_error" };

  return { ok: true, returnId, returnNumber: String(request.return_number) };
}
