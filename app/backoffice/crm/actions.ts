"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getCrmAccess } from "@/lib/crm/auth";

const statusSchema = z.enum(["new", "qualified", "contacted", "converted", "closed"]);
const updateSchema = z.object({
  id: z.string().uuid(),
  status: statusSchema,
});

export async function updateOpportunityStatus(formData: FormData) {
  const input = updateSchema.safeParse({
    id: formData.get("id"),
    status: formData.get("status"),
  });
  if (!input.success) redirect("/backoffice/crm?notice=invalid");

  const access = await getCrmAccess();
  if (access.state === "unconfigured") redirect("/backoffice/crm?notice=unconfigured");
  if (access.state === "unauthenticated") redirect("/acceso?next=%2Fbackoffice%2Fcrm");
  if (access.state === "forbidden") redirect("/backoffice/crm?notice=forbidden");
  if (access.state === "error") redirect("/backoffice/crm?notice=error");

  const { data, error } = await access.supabase.rpc("update_quote_inquiry_status", {
    p_inquiry_id: input.data.id,
    p_status: input.data.status,
  });

  if (error) redirect(error.code === "23514" ? "/backoffice/crm?notice=invalid" : "/backoffice/crm?notice=error");
  if (data == null) redirect("/backoffice/crm?notice=not-found");

  revalidatePath("/backoffice/crm");
  redirect("/backoffice/crm?notice=updated");
}

const quoteIdSchema = z.string().uuid();
const offerSchema = z.array(z.object({
  quote_item_id: z.string().uuid(),
  unit_price: z.coerce.number().finite().min(0).max(100000000),
}).strict()).min(1).max(30);

async function getSalesClient() {
  const access = await getCrmAccess();
  if (access.state === "unconfigured") redirect("/backoffice/crm?notice=unconfigured");
  if (access.state === "unauthenticated") redirect("/acceso?next=%2Fbackoffice%2Fcrm");
  if (access.state === "forbidden") redirect("/backoffice/crm?notice=forbidden");
  if (access.state === "error") redirect("/backoffice/crm?notice=error");
  return access.supabase;
}

function refreshCrm() {
  revalidatePath("/backoffice/crm");
  revalidatePath("/empresas/portal");
}

export async function claimBusinessQuote(formData: FormData) {
  const quoteId = quoteIdSchema.safeParse(formData.get("quoteId"));
  if (!quoteId.success) redirect("/backoffice/crm?notice=invalid");

  const supabase = await getSalesClient();
  const { data, error } = await supabase.rpc("claim_business_quote", { p_quote_id: quoteId.data });
  if (error) redirect(error.code === "42501" ? "/backoffice/crm?notice=forbidden" : "/backoffice/crm?notice=error");
  if (data == null) redirect("/backoffice/crm?notice=not-found");

  refreshCrm();
  redirect("/backoffice/crm?notice=quote-claimed");
}

export async function sendBusinessQuote(formData: FormData) {
  const quoteId = quoteIdSchema.safeParse(formData.get("quoteId"));
  const validityDays = z.coerce.number().int().min(1).max(90).safeParse(formData.get("validityDays"));
  let rawOffer: unknown;
  try {
    rawOffer = JSON.parse(String(formData.get("offer") ?? ""));
  } catch {
    redirect("/backoffice/crm?notice=invalid");
  }
  const offer = offerSchema.safeParse(rawOffer);
  if (!quoteId.success || !validityDays.success || !offer.success) redirect("/backoffice/crm?notice=invalid");

  const supabase = await getSalesClient();
  const validUntil = new Date(Date.now() + validityDays.data * 24 * 60 * 60 * 1000).toISOString();
  const { error } = await supabase.rpc("send_business_quote", {
    p_quote_id: quoteId.data,
    p_valid_until: validUntil,
    p_offers: offer.data.map(({ quote_item_id, unit_price }) => ({ item_id: quote_item_id, unit_price })),
  });
  if (error) redirect(error.code === "42501" ? "/backoffice/crm?notice=forbidden" : error.code === "22023" ? "/backoffice/crm?notice=invalid" : "/backoffice/crm?notice=error");

  refreshCrm();
  redirect("/backoffice/crm?notice=quote-sent");
}
