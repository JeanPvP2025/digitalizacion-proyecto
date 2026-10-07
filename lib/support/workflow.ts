import "server-only";

import { z } from "zod";
import type { SupabaseServerClient } from "@/lib/supabase/auth";

export const supportTicketIdSchema = z.uuid();

export const supportMessageSchema = z.object({
  body: z.string().trim().min(1).max(10000),
  idempotencyKey: z.uuid(),
  status: z.enum(["in_progress", "waiting_customer", "resolved", "closed"]).optional(),
}).strict();

export const returnReviewSchema = z.object({
  decision: z.enum(["approved", "rejected"]),
  reason: z.string().trim().max(1000).optional().default(""),
  idempotencyKey: z.uuid(),
}).strict().superRefine((decision, context) => {
  if (decision.decision === "rejected" && decision.reason.trim().length < 10) {
    context.addIssue({ code: "custom", path: ["reason"], message: "Indica un motivo de rechazo de al menos 10 caracteres." });
  }
});

type DbError = { message: string; code?: string };

export type SupportTicketSummary = {
  id: string;
  ticketNumber: string;
  subject: string;
  status: string;
  createdAt: string;
  updatedAt: string;
};

export async function listSupportTickets(supabase: SupabaseServerClient) {
  const { data, error } = await supabase
    .from("support_tickets")
    .select("id, ticket_number, subject, status, created_at, updated_at")
    .order("updated_at", { ascending: false })
    .limit(100);
  if (error) return { data: null, error };

  return {
    data: (data ?? []).map((ticket) => ({
      id: String(ticket.id),
      ticketNumber: String(ticket.ticket_number),
      subject: String(ticket.subject),
      status: String(ticket.status),
      createdAt: String(ticket.created_at),
      updatedAt: String(ticket.updated_at),
    })) satisfies SupportTicketSummary[],
    error: null,
  };
}

export async function loadSupportTicket(supabase: SupabaseServerClient, ticketId: string) {
  const { data: ticket, error: ticketError } = await supabase
    .from("support_tickets")
    .select("id, ticket_number, subject, status, created_at, updated_at")
    .eq("id", ticketId)
    .maybeSingle();
  if (ticketError) return { data: null, error: ticketError };
  if (!ticket) return { data: null, error: null };

  const [messagesResult, eventsResult] = await Promise.all([
    supabase
      .from("support_messages")
      .select("id, author_type, body, is_internal, created_at")
      .eq("ticket_id", ticketId)
      .order("created_at", { ascending: true }),
    supabase
      .from("support_ticket_events")
      .select("id, event_type, from_status, to_status, occurred_at")
      .eq("ticket_id", ticketId)
      .order("occurred_at", { ascending: true }),
  ]);
  if (messagesResult.error) return { data: null, error: messagesResult.error };
  if (eventsResult.error) return { data: null, error: eventsResult.error };

  return {
    data: {
      ticket: {
        id: String(ticket.id),
        ticketNumber: String(ticket.ticket_number),
        subject: String(ticket.subject),
        status: String(ticket.status),
        createdAt: String(ticket.created_at),
        updatedAt: String(ticket.updated_at),
      },
      messages: (messagesResult.data ?? []).map((message) => ({
        id: String(message.id),
        authorType: String(message.author_type),
        body: String(message.body),
        internal: Boolean(message.is_internal),
        createdAt: String(message.created_at),
      })),
      events: (eventsResult.data ?? []).map((event) => ({
        id: String(event.id),
        type: String(event.event_type),
        fromStatus: event.from_status ? String(event.from_status) : null,
        toStatus: String(event.to_status),
        occurredAt: String(event.occurred_at),
      })),
    },
    error: null,
  };
}

export async function sendSupportMessage(
  supabase: SupabaseServerClient,
  ticketId: string,
  input: z.infer<typeof supportMessageSchema>,
) {
  const { data, error } = await supabase.rpc("send_support_message", {
    p_ticket_id: ticketId,
    p_body: input.body,
    p_next_status: input.status ?? null,
    p_idempotency_key: input.idempotencyKey,
  });
  if (error) return { data: null, error: error as DbError };
  const row = Array.isArray(data) ? data[0] : data;
  if (!row || typeof row !== "object" || !("message_id" in row) || !("ticket_status" in row)) {
    return { data: null, error: { code: "INVALID_RPC_RESPONSE", message: "Support message response is incomplete" } };
  }
  return { data: { messageId: String(row.message_id), status: String(row.ticket_status) }, error: null };
}

export type ReturnTimelineItem = {
  id: string;
  type: string;
  fromStatus: string | null;
  toStatus: string;
  reason: string;
  occurredAt: string;
};

export type ReturnCase = {
  id: string;
  returnNumber: string;
  orderNumber: string;
  customerId: string;
  status: string;
  reason: string;
  decisionReason: string;
  requestedAt: string;
  reviewedAt: string | null;
  items: Array<{
    orderItemId: string;
    name: string;
    sku: string;
    variant: string;
    requestedQuantity: number;
    purchasedQuantity: number;
  }>;
  timeline: ReturnTimelineItem[];
};

/** Loads customer-owned history or the staff queue; RLS remains the row boundary. */
export async function loadReturnCases(supabase: SupabaseServerClient, requestedOnly = false) {
  let requestQuery = supabase
    .from("return_requests")
    .select("id, return_number, order_id, customer_id, status, reason, decision_reason, requested_at, reviewed_at")
    .order("requested_at", { ascending: false })
    .limit(100);
  if (requestedOnly) requestQuery = requestQuery.eq("status", "requested");

  const { data: requests, error: requestsError } = await requestQuery;
  if (requestsError) return { data: null, error: requestsError };
  if (!requests?.length) return { data: [] as ReturnCase[], error: null };

  const requestIds = requests.map((request) => String(request.id));
  const orderIds = [...new Set(requests.map((request) => String(request.order_id)))];
  const [itemsResult, eventsResult, ordersResult] = await Promise.all([
    supabase
      .from("return_items")
      .select("return_request_id, order_item_id, quantity")
      .in("return_request_id", requestIds),
    supabase
      .from("return_request_events")
      .select("id, return_request_id, event_type, from_status, to_status, decision_reason, occurred_at")
      .in("return_request_id", requestIds)
      .order("occurred_at", { ascending: true }),
    supabase
      .from("orders")
      .select("id, order_number")
      .in("id", orderIds),
  ]);
  if (itemsResult.error) return { data: null, error: itemsResult.error };
  if (eventsResult.error) return { data: null, error: eventsResult.error };
  if (ordersResult.error) return { data: null, error: ordersResult.error };

  const orderItemIds = [...new Set((itemsResult.data ?? []).map((item) => String(item.order_item_id)))];
  const orderItemsResult = orderItemIds.length
    ? await supabase
      .from("order_items")
      .select("id, product_name, product_sku, variant_title, quantity")
      .in("id", orderItemIds)
    : { data: [], error: null };
  if (orderItemsResult.error) return { data: null, error: orderItemsResult.error };

  const ordersById = new Map((ordersResult.data ?? []).map((order) => [String(order.id), String(order.order_number)]));
  const itemsById = new Map((orderItemsResult.data ?? []).map((item) => [String(item.id), item]));
  const requestItems = new Map<string, ReturnCase["items"]>();
  for (const item of itemsResult.data ?? []) {
    const orderItemId = String(item.order_item_id);
    const orderItem = itemsById.get(orderItemId);
    if (!orderItem) continue;
    const requestId = String(item.return_request_id);
    const existing = requestItems.get(requestId) ?? [];
    existing.push({
      orderItemId,
      name: String(orderItem.product_name),
      sku: String(orderItem.product_sku),
      variant: String(orderItem.variant_title),
      requestedQuantity: Number(item.quantity),
      purchasedQuantity: Number(orderItem.quantity),
    });
    requestItems.set(requestId, existing);
  }
  const requestEvents = new Map<string, ReturnTimelineItem[]>();
  for (const event of eventsResult.data ?? []) {
    const requestId = String(event.return_request_id);
    const existing = requestEvents.get(requestId) ?? [];
    existing.push({
      id: String(event.id),
      type: String(event.event_type),
      fromStatus: event.from_status ? String(event.from_status) : null,
      toStatus: String(event.to_status),
      reason: String(event.decision_reason ?? ""),
      occurredAt: String(event.occurred_at),
    });
    requestEvents.set(requestId, existing);
  }

  return {
    data: requests.map((request) => ({
      id: String(request.id),
      returnNumber: String(request.return_number),
      orderNumber: ordersById.get(String(request.order_id)) ?? "Pedido",
      customerId: String(request.customer_id),
      status: String(request.status),
      reason: String(request.reason),
      decisionReason: String(request.decision_reason ?? ""),
      requestedAt: String(request.requested_at),
      reviewedAt: request.reviewed_at ? String(request.reviewed_at) : null,
      items: requestItems.get(String(request.id)) ?? [],
      timeline: requestEvents.get(String(request.id)) ?? [],
    })) satisfies ReturnCase[],
    error: null,
  };
}

export async function reviewReturn(
  supabase: SupabaseServerClient,
  returnRequestId: string,
  input: z.infer<typeof returnReviewSchema>,
) {
  const { data, error } = await supabase.rpc("review_return_request", {
    p_return_request_id: returnRequestId,
    p_decision: input.decision,
    p_decision_reason: input.reason,
    p_idempotency_key: input.idempotencyKey,
  });
  if (error) return { data: null, error: error as DbError };
  const row = Array.isArray(data) ? data[0] : data;
  if (!row || typeof row !== "object" || !("return_request_id" in row) || !("return_status" in row)) {
    return { data: null, error: { code: "INVALID_RPC_RESPONSE", message: "Return review response is incomplete" } };
  }
  return { data: { id: String(row.return_request_id), status: String(row.return_status) }, error: null };
}
