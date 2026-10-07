"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const organizationSchema = z.object({
  displayName: z.string().trim().min(2).max(120),
  legalName: z.string().trim().min(2).max(180),
  taxId: z.string().trim().max(32),
  billingEmail: z.union([z.literal(""), z.string().trim().email().max(254)]),
});

const organizationIdSchema = z.string().uuid();
const emailSchema = z.string().trim().email().max(254);
const roleSchema = z.enum(["admin", "buyer", "viewer"]);
const quoteLinesSchema = z.array(z.object({
  variantId: z.string().uuid(),
  quantity: z.coerce.number().int().min(1).max(10000),
}).strict()).min(1).max(30);
const businessOrderSchema = z.object({
  quoteId: z.string().uuid(),
  organizationId: z.string().uuid(),
  shippingName: z.string().trim().min(2).max(120),
  shippingAddress: z.string().trim().min(5).max(200),
  shippingPostalCode: z.string().trim().regex(/^\d{5}$/),
  shippingCity: z.string().trim().min(2).max(80),
  billingName: z.string().trim().min(2).max(120),
  billingAddress: z.string().trim().min(5).max(200),
  billingPostalCode: z.string().trim().regex(/^\d{5}$/),
  billingCity: z.string().trim().min(2).max(80),
  confirmTerms: z.literal("accepted"),
}).strict();

function noticeFor(error: { code?: string; message?: string } | null): string {
  if (!error) return "error";
  if (error.code === "42501") return "forbidden";
  if (error.code === "23505") return "duplicate";
  if (error.code === "P0002") return "not-found";
  if (["22023", "23514"].includes(error.code ?? "")) return "invalid";
  return "error";
}

async function getSignedInClient() {
  const supabase = await createSupabaseServerClient();
  if (!supabase) redirect("/empresas/portal?notice=unconfigured");
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) redirect("/acceso?next=%2Fempresas%2Fportal");
  return supabase;
}

function finish(notice: string, organizationId?: string): never {
  revalidatePath("/empresas/portal");
  revalidatePath("/backoffice/crm");
  const organization = organizationIdSchema.safeParse(organizationId);
  const selected = organization.success ? `&organization=${organization.data}` : "";
  redirect(`/empresas/portal?notice=${encodeURIComponent(notice)}${selected}`);
}

export async function createOrganization(formData: FormData) {
  const input = organizationSchema.safeParse({
    displayName: formData.get("displayName"),
    legalName: formData.get("legalName"),
    taxId: formData.get("taxId") ?? "",
    billingEmail: formData.get("billingEmail") ?? "",
  });
  if (!input.success) finish("invalid");

  const supabase = await getSignedInClient();
  const slugBase = input.data.displayName
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48) || "empresa";
  const { error } = await supabase.rpc("create_organization", {
    p_slug: `${slugBase}-${crypto.randomUUID().slice(0, 8)}`,
    p_legal_name: input.data.legalName,
    p_display_name: input.data.displayName,
    p_tax_id: input.data.taxId || null,
    p_billing_email: input.data.billingEmail || null,
  });
  if (error) finish(noticeFor(error));
  finish("organization-created");
}

export async function addOrganizationMember(formData: FormData) {
  const organizationId = organizationIdSchema.safeParse(formData.get("organizationId"));
  const email = emailSchema.safeParse(formData.get("email"));
  const role = roleSchema.safeParse(formData.get("role"));
  if (!organizationId.success || !email.success || !role.success) finish("invalid");

  const supabase = await getSignedInClient();
  const { error } = await supabase.rpc("add_organization_member", {
    p_organization_id: organizationId.data,
    p_email: email.data,
    p_role: role.data,
  });
  if (error) finish(noticeFor(error), organizationId.data);
  finish("member-added", organizationId.data);
}

export async function setOrganizationMemberRole(formData: FormData) {
  const organizationId = organizationIdSchema.safeParse(formData.get("organizationId"));
  const userId = organizationIdSchema.safeParse(formData.get("userId"));
  const role = roleSchema.safeParse(formData.get("role"));
  if (!organizationId.success || !userId.success || !role.success) finish("invalid");

  const supabase = await getSignedInClient();
  const { error } = await supabase.rpc("set_organization_member_role", {
    p_organization_id: organizationId.data,
    p_user_id: userId.data,
    p_role: role.data,
  });
  if (error) finish(noticeFor(error), organizationId.data);
  finish("member-updated", organizationId.data);
}

export async function removeOrganizationMember(formData: FormData) {
  const organizationId = organizationIdSchema.safeParse(formData.get("organizationId"));
  const userId = organizationIdSchema.safeParse(formData.get("userId"));
  if (!organizationId.success || !userId.success) finish("invalid");

  const supabase = await getSignedInClient();
  const { error } = await supabase.rpc("remove_organization_member", {
    p_organization_id: organizationId.data,
    p_user_id: userId.data,
  });
  if (error) finish(noticeFor(error), organizationId.data);
  finish("member-removed", organizationId.data);
}

export async function requestBusinessQuote(formData: FormData) {
  const organizationId = organizationIdSchema.safeParse(formData.get("organizationId"));
  const note = z.string().trim().max(2000).safeParse(formData.get("requestNote") ?? "");
  let rawLines: unknown;
  try {
    rawLines = JSON.parse(String(formData.get("lines") ?? ""));
  } catch {
    finish("invalid");
  }
  const lines = quoteLinesSchema.safeParse(rawLines);
  if (!organizationId.success || !note.success || !lines.success) finish("invalid");

  const supabase = await getSignedInClient();
  const { error } = await supabase.rpc("create_business_quote", {
    p_organization_id: organizationId.data,
    p_request_note: note.data,
    p_lines: lines.data.map(({ variantId, quantity }) => ({ variant_id: variantId, quantity })),
  });
  if (error) finish(noticeFor(error), organizationId.data);
  finish("quote-requested", organizationId.data);
}

export async function respondToBusinessQuote(formData: FormData) {
  const quoteId = organizationIdSchema.safeParse(formData.get("quoteId"));
  const organizationId = organizationIdSchema.safeParse(formData.get("organizationId"));
  const decision = z.enum(["accepted", "rejected"]).safeParse(formData.get("decision"));
  if (!quoteId.success || !organizationId.success || !decision.success) finish("invalid");

  const supabase = await getSignedInClient();
  const { data, error } = await supabase.rpc("respond_to_business_quote", {
    p_quote_id: quoteId.data,
    p_decision: decision.data,
  });
  if (error) finish(noticeFor(error), organizationId.data);
  finish(data === "expired" ? "expired" : decision.data === "accepted" ? "quote-accepted" : "quote-rejected", organizationId.data);
}

export async function convertAcceptedBusinessQuote(formData: FormData) {
  const quoteId = organizationIdSchema.safeParse(formData.get("quoteId"));
  const organizationId = organizationIdSchema.safeParse(formData.get("organizationId"));
  if (!quoteId.success || !organizationId.success) finish("invalid");

  const supabase = await getSignedInClient();
  const { error } = await supabase.rpc("convert_accepted_business_quote", {
    p_quote_id: quoteId.data,
  });
  if (error) finish(noticeFor(error), organizationId.data);
  finish("quote-converted", organizationId.data);
}

export async function createBusinessOrderFromAcceptedQuote(formData: FormData) {
  const input = businessOrderSchema.safeParse({
    quoteId: formData.get("quoteId"),
    organizationId: formData.get("organizationId"),
    shippingName: formData.get("shippingName"),
    shippingAddress: formData.get("shippingAddress"),
    shippingPostalCode: formData.get("shippingPostalCode"),
    shippingCity: formData.get("shippingCity"),
    billingName: formData.get("billingName"),
    billingAddress: formData.get("billingAddress"),
    billingPostalCode: formData.get("billingPostalCode"),
    billingCity: formData.get("billingCity"),
    confirmTerms: formData.get("confirmTerms"),
  });
  if (!input.success) finish("invalid", organizationIdFrom(formData));

  const supabase = await getSignedInClient();
  const { data, error } = await supabase.rpc("create_business_order_from_accepted_quote", {
    p_quote_id: input.data.quoteId,
    p_shipping_address: {
      fullName: input.data.shippingName,
      address: input.data.shippingAddress,
      postalCode: input.data.shippingPostalCode,
      city: input.data.shippingCity,
      countryCode: "ES",
    },
    p_billing_address: {
      fullName: input.data.billingName,
      address: input.data.billingAddress,
      postalCode: input.data.billingPostalCode,
      city: input.data.billingCity,
      countryCode: "ES",
    },
  });
  if (error) {
    const notice = error.code === "42501" ? "forbidden"
      : error.code === "P0002" ? "not-found"
        : error.code === "P0001" ? "stock-unavailable"
          : error.code === "23505" ? "order-conflict"
            : ["22023", "23514"].includes(error.code ?? "") ? "invalid" : "error";
    finish(notice, input.data.organizationId);
  }
  if (!Array.isArray(data) || data.length !== 1 || !z.string().uuid().safeParse(data[0]?.order_id).success) {
    finish("error", input.data.organizationId);
  }
  finish("business-order-created", input.data.organizationId);
}

function organizationIdFrom(formData: FormData) {
  const parsed = organizationIdSchema.safeParse(formData.get("organizationId"));
  return parsed.success ? parsed.data : undefined;
}
