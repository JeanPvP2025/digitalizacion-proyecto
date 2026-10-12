import "server-only";

import { z } from "zod";
import { getCrmAccess } from "@/lib/crm/auth";

const crmOrderStatus = z.enum([
  "pending_payment", "paid", "processing", "shipped", "delivered", "cancelled", "refunded",
]);
const crmPaymentStatus = z.enum([
  "pending", "authorized", "paid", "failed", "partially_refunded", "refunded",
]);
const crmFulfillmentStatus = z.enum([
  "not_started", "pending", "picking", "packed", "shipped", "delivered", "cancelled", "not_required",
]);
const crmReturnStatus = z.enum(["requested", "approved", "rejected", "received", "refunded", "closed"]);

const customerRowSchema = z.object({
  customer_id: z.string().uuid(),
  display_name: z.string(),
  email: z.string(),
  phone: z.string().nullable(),
  created_at: z.string(),
  order_count: z.coerce.number().int().nonnegative(),
  latest_order_id: z.string().uuid().nullable(),
  latest_order_number: z.string().nullable(),
  latest_order_status: crmOrderStatus.nullable(),
  latest_payment_status: crmPaymentStatus.nullable(),
  latest_order_at: z.string().nullable(),
  total_count: z.coerce.number().int().nonnegative(),
});

const customerProfileSchema = z.object({
  customer_id: z.string().uuid(),
  display_name: z.string(),
  email: z.string(),
  phone: z.string().nullable(),
  created_at: z.string(),
  order_count: z.coerce.number().int().nonnegative(),
  latest_order_at: z.string().nullable(),
});

const orderRowSchema = z.object({
  order_id: z.string().uuid(),
  order_number: z.string(),
  customer_id: z.string().uuid(),
  customer_name: z.string(),
  customer_email: z.string(),
  organization_name: z.string().nullable(),
  order_status: crmOrderStatus,
  payment_status: crmPaymentStatus.nullable(),
  fulfillment_status: crmFulfillmentStatus,
  return_status: crmReturnStatus.nullable(),
  grand_total: z.coerce.number().nonnegative(),
  currency: z.string().length(3),
  placed_at: z.string(),
  total_count: z.coerce.number().int().nonnegative(),
});

const orderDetailSchema = orderRowSchema.omit({ total_count: true }).extend({
  subtotal: z.coerce.number().nonnegative(),
  tax_total: z.coerce.number().nonnegative(),
  shipping_total: z.coerce.number().nonnegative(),
  discount_total: z.coerce.number().nonnegative(),
  items: z.array(z.object({
    productName: z.string(),
    sku: z.string(),
    variantTitle: z.string(),
    quantity: z.coerce.number().int().positive(),
    unitPrice: z.coerce.number().nonnegative(),
    lineTotal: z.coerce.number().nonnegative(),
    currency: z.string().length(3),
  })),
  timeline: z.array(z.object({
    eventKey: z.string(),
    note: z.string(),
    occurredAt: z.string(),
  })),
});

export type CrmOrderStatus = z.infer<typeof crmOrderStatus>;
export type CrmPaymentStatus = z.infer<typeof crmPaymentStatus>;
export type CrmFulfillmentStatus = z.infer<typeof crmFulfillmentStatus>;
export type CrmReturnStatus = z.infer<typeof crmReturnStatus>;
export type CrmCustomerRow = z.infer<typeof customerRowSchema>;
export type CrmCustomerProfile = z.infer<typeof customerProfileSchema>;
export type CrmOrderRow = z.infer<typeof orderRowSchema>;
export type CrmOrderDetail = z.infer<typeof orderDetailSchema>;

export type CrmOrdersState =
  | { state: "unconfigured" | "unauthenticated" | "forbidden" | "error" }
  | { state: "ready"; rows: CrmOrderRow[]; totalCount: number };

export async function getCrmCustomers(query: string, limit: number, offset: number) {
  const access = await getCrmAccess();
  if (access.state !== "ready") return access;

  const { data, error } = await access.supabase.rpc("crm_customer_directory", {
    p_query: query.trim().slice(0, 100) || null,
    p_limit: limit,
    p_offset: offset,
  });
  if (error) return { state: "error" } as const;
  const parsed = z.array(customerRowSchema).safeParse(data);
  if (!parsed.success) return { state: "error" } as const;

  let totalCount = parsed.data[0]?.total_count ?? 0;
  if (parsed.data.length === 0 && offset > 0) {
    const countResult = await access.supabase.rpc("crm_customer_directory", {
      p_query: query.trim().slice(0, 100) || null,
      p_limit: 1,
      p_offset: 0,
    });
    if (countResult.error) return { state: "error" } as const;
    const countRows = z.array(customerRowSchema).safeParse(countResult.data);
    if (!countRows.success) return { state: "error" } as const;
    totalCount = countRows.data[0]?.total_count ?? 0;
  }

  return {
    state: "ready",
    rows: parsed.data,
    totalCount,
  } as const;
}

export async function getCrmCustomerProfile(customerId: string) {
  const access = await getCrmAccess();
  if (access.state !== "ready") return access;

  const { data, error } = await access.supabase.rpc("crm_customer_profile", { p_customer_id: customerId });
  if (error) return { state: "error" } as const;
  const parsed = z.array(customerProfileSchema).safeParse(data);
  if (!parsed.success) return { state: "error" } as const;
  return parsed.data[0] ? { state: "ready", profile: parsed.data[0] } as const : { state: "not-found" } as const;
}

export async function getCrmOrders(options: {
  customerId?: string;
  query: string;
  orderStatus?: CrmOrderStatus;
  paymentStatus?: CrmPaymentStatus;
  fulfillmentStatus?: CrmFulfillmentStatus;
  returnStatus?: CrmReturnStatus;
  limit: number;
  offset: number;
}): Promise<CrmOrdersState> {
  const access = await getCrmAccess();
  if (access.state !== "ready") return access;

  const { data, error } = await access.supabase.rpc("crm_orders", {
    p_customer_id: options.customerId ?? null,
    p_query: options.query.trim().slice(0, 100) || null,
    p_order_status: options.orderStatus ?? null,
    p_payment_status: options.paymentStatus ?? null,
    p_fulfillment_status: options.fulfillmentStatus ?? null,
    p_return_status: options.returnStatus ?? null,
    p_limit: options.limit,
    p_offset: options.offset,
  });
  if (error) return { state: "error" };
  const parsed = z.array(orderRowSchema).safeParse(data);
  if (!parsed.success) return { state: "error" };

  let totalCount = parsed.data[0]?.total_count ?? 0;
  if (parsed.data.length === 0 && options.offset > 0) {
    const countResult = await access.supabase.rpc("crm_orders", {
      p_customer_id: options.customerId ?? null,
      p_query: options.query.trim().slice(0, 100) || null,
      p_order_status: options.orderStatus ?? null,
      p_payment_status: options.paymentStatus ?? null,
      p_fulfillment_status: options.fulfillmentStatus ?? null,
      p_return_status: options.returnStatus ?? null,
      p_limit: 1,
      p_offset: 0,
    });
    if (countResult.error) return { state: "error" };
    const countRows = z.array(orderRowSchema).safeParse(countResult.data);
    if (!countRows.success) return { state: "error" };
    totalCount = countRows.data[0]?.total_count ?? 0;
  }

  return {
    state: "ready",
    rows: parsed.data,
    totalCount,
  };
}

export async function getCrmOrderDetail(orderId: string) {
  const access = await getCrmAccess();
  if (access.state !== "ready") return access;

  const { data, error } = await access.supabase.rpc("crm_order_detail", { p_order_id: orderId });
  if (error) return { state: "error" } as const;
  const parsed = z.array(orderDetailSchema).safeParse(data);
  if (!parsed.success) return { state: "error" } as const;
  return parsed.data[0] ? { state: "ready", order: parsed.data[0] } as const : { state: "not-found" } as const;
}
