import "server-only";

import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const supportSubmissionSchema = z.object({
  subject: z.string().trim().min(5).max(120),
  message: z.string().trim().min(20).max(2400),
  email: z.string().trim().max(200).optional().default(""),
  orderNumber: z.string().trim().max(40).optional().default(""),
  privacyAccepted: z.literal(true),
}).strict();

export const supportEmailSchema = z.email().max(200);

type SupportSubmission = z.infer<typeof supportSubmissionSchema>;
type SupabaseServerClient = NonNullable<Awaited<ReturnType<typeof createSupabaseServerClient>>>;

export type PersistSupportTicketResult =
  | { ok: true; ticketId: string; ticketNumber: string }
  | { ok: false; reason: "order_not_owned" | "database_error"; failedAt?: "ticket" | "message"; ticketNumber?: string };

/** Persists customer-authored public tickets using the caller's RLS-scoped session. */
export async function persistAuthenticatedSupportTicket(
  supabase: SupabaseServerClient,
  customerId: string,
  submission: SupportSubmission,
): Promise<PersistSupportTicketResult> {
  let orderId: string | null = null;

  if (submission.orderNumber) {
    const { data: order, error } = await supabase
      .from("orders")
      .select("id")
      .eq("order_number", submission.orderNumber)
      .eq("customer_id", customerId)
      .maybeSingle();

    if (error) return { ok: false, reason: "database_error", failedAt: "ticket" };
    if (!order) return { ok: false, reason: "order_not_owned" };
    orderId = String(order.id);
  }

  const { data: ticket, error: ticketError } = await supabase
    .from("support_tickets")
    .insert({
      customer_id: customerId,
      organization_id: null,
      order_id: orderId,
      subject: submission.subject,
      status: "open",
      priority: "normal",
      assigned_to: null,
    })
    .select("id, ticket_number")
    .single();

  if (ticketError || !ticket?.id || !ticket.ticket_number) {
    return { ok: false, reason: "database_error", failedAt: "ticket" };
  }

  const { data: message, error: messageError } = await supabase
    .from("support_messages")
    .insert({
      ticket_id: ticket.id,
      author_id: customerId,
      body: submission.message,
      is_internal: false,
    })
    .select("id")
    .single();

  if (messageError || !message?.id) {
    return {
      ok: false,
      reason: "database_error",
      failedAt: "message",
      ticketNumber: String(ticket.ticket_number),
    };
  }

  return {
    ok: true,
    ticketId: String(ticket.id),
    ticketNumber: String(ticket.ticket_number),
  };
}
