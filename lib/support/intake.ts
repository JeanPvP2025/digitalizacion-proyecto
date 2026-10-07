import "server-only";

import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const supportSubmissionSchema = z.object({
  subject: z.string().trim().min(5).max(120),
  message: z.string().trim().min(20).max(2400),
  email: z.string().trim().max(200).optional().default(""),
  orderNumber: z.string().trim().max(40).optional().default(""),
  organizationSlug: z.string().trim().max(96).optional().default(""),
  privacyAccepted: z.literal(true),
}).strict();

export const supportEmailSchema = z.email().max(200);

type SupportSubmission = z.infer<typeof supportSubmissionSchema>;
type SupabaseServerClient = NonNullable<Awaited<ReturnType<typeof createSupabaseServerClient>>>;

export type PersistSupportTicketResult =
  | { ok: true; ticketId: string; ticketNumber: string }
  | { ok: false; reason: "order_not_owned" | "organization_not_owned" | "database_error" | "ticket_not_created" };

/** Creates a session-owned ticket and its first message in one PostgreSQL RPC. */
export async function persistAuthenticatedSupportTicket(
  supabase: SupabaseServerClient,
  customerId: string,
  submission: SupportSubmission,
): Promise<PersistSupportTicketResult> {
  let organizationId: string | null = null;
  let orderId: string | null = null;
  let memberships: Set<string> | null = null;

  async function loadMemberships() {
    if (memberships) return { ids: memberships, error: null };
    const { data, error } = await supabase
      .from("organization_memberships")
      .select("organization_id")
      .eq("user_id", customerId);
    if (error) return { ids: null, error };
    memberships = new Set((data ?? []).map((membership) => String(membership.organization_id)));
    return { ids: memberships, error: null };
  }

  if (submission.organizationSlug) {
    const membershipResult = await loadMemberships();
    if (membershipResult.error || !membershipResult.ids) return { ok: false, reason: "database_error" };

    const { data: organization, error } = await supabase
      .from("organizations")
      .select("id")
      .eq("slug", submission.organizationSlug)
      .maybeSingle();
    if (error) return { ok: false, reason: "database_error" };
    if (!organization || !membershipResult.ids.has(String(organization.id))) {
      return { ok: false, reason: "organization_not_owned" };
    }
    organizationId = String(organization.id);
  }

  if (submission.orderNumber) {
    const { data: order, error } = await supabase
      .from("orders")
      .select("id, customer_id, organization_id")
      .eq("order_number", submission.orderNumber)
      .eq("customer_id", customerId)
      .maybeSingle();

    if (error) return { ok: false, reason: "database_error" };
    if (!order) return { ok: false, reason: "order_not_owned" };

    orderId = String(order.id);
    const orderOrganizationId = order.organization_id ? String(order.organization_id) : null;
    if (orderOrganizationId) {
      const membershipResult = await loadMemberships();
      if (membershipResult.error || !membershipResult.ids) return { ok: false, reason: "database_error" };
      if (!membershipResult.ids.has(orderOrganizationId)) return { ok: false, reason: "order_not_owned" };
    }
    if (organizationId && organizationId !== orderOrganizationId) {
      return { ok: false, reason: "order_not_owned" };
    }
    organizationId = orderOrganizationId;
  }

  const { data, error } = await supabase.rpc("create_support_ticket", {
    p_subject: submission.subject,
    p_message: submission.message,
    p_order_id: orderId,
    p_organization_id: organizationId,
  });
  if (error) return { ok: false, reason: "database_error" };

  const ticket = Array.isArray(data) ? data[0] : data;
  if (!ticket || typeof ticket !== "object" || !("ticket_id" in ticket) || !("ticket_number" in ticket)) {
    return { ok: false, reason: "ticket_not_created" };
  }

  return {
    ok: true,
    ticketId: String(ticket.ticket_id),
    ticketNumber: String(ticket.ticket_number),
  };
}
