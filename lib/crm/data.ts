import "server-only";

import { getCrmAccess } from "@/lib/crm/auth";

export type ProspectStatus = "new" | "qualified" | "contacted" | "converted" | "closed";

export type CrmOpportunity = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  company: string | null;
  message: string;
  status: ProspectStatus;
  source: string;
  createdAt: string;
  updatedAt: string;
};

export type CrmContact = {
  key: string;
  name: string;
  email: string;
  phone: string | null;
  company: string | null;
  lastSeenAt: string;
  sources: string[];
};

export type CrmOrganization = {
  id: string;
  name: string;
  legalName: string;
  email: string | null;
  slug: string;
  active: boolean;
  createdAt: string;
};

export type CrmActivity = {
  id: string;
  kind: "lead" | "quote-inquiry" | "business-quote";
  title: string;
  name: string;
  company: string | null;
  createdAt: string;
};

export type CrmSalesQuoteLine = {
  id: string;
  productName: string;
  sku: string;
  variantTitle: string;
  quantity: number;
  requestedUnitPrice: number;
  offeredUnitPrice: number | null;
  currency: string;
};

export type CrmSalesQuote = {
  id: string;
  number: string;
  status: "requested" | "in_review";
  organizationName: string;
  requesterName: string;
  requesterEmail: string;
  requestNote: string;
  createdAt: string;
  salesOwnerId: string | null;
  lines: CrmSalesQuoteLine[];
};

type QuoteInquiryRow = {
  id: string;
  contact_name: string;
  email: string;
  phone: string | null;
  company: string | null;
  message: string;
  status: ProspectStatus;
  source: string;
  created_at: string;
  updated_at: string;
};

type LeadRow = {
  id: string;
  contact_name: string;
  email: string;
  phone: string | null;
  company: string | null;
  source: string;
  created_at: string;
};

type OrganizationRow = {
  id: string;
  slug: string;
  legal_name: string;
  display_name: string;
  billing_email: string | null;
  is_active: boolean;
  created_at: string;
};

type BusinessQuoteRow = {
  id: string;
  quote_number: string;
  status: "requested" | "in_review";
  organization_name_snapshot: string;
  requester_name: string;
  requester_email: string;
  request_note: string;
  created_at: string;
  sales_owner_id: string | null;
};

type BusinessQuoteLineRow = {
  id: string;
  quote_id: string;
  product_name: string;
  product_sku: string;
  variant_title: string;
  quantity: number;
  requested_unit_price: number | string;
  offered_unit_price: number | string | null;
  currency: string;
};

type ActivityRow = {
  id: number;
  event_key: string;
  title: string;
  subject_name: string;
  company_snapshot: string;
  created_at: string;
  crm_lead_id: string | null;
  quote_inquiry_id: string | null;
};

function mergeContacts(leads: LeadRow[], inquiries: QuoteInquiryRow[]): CrmContact[] {
  const contacts = new Map<string, CrmContact>();
  const rows = [
    ...leads.map((row) => ({ ...row, kind: "lead" as const, createdAt: row.created_at })),
    ...inquiries.map((row) => ({ ...row, kind: "quote-inquiry" as const, createdAt: row.created_at })),
  ].sort((left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt));

  for (const row of rows) {
    const normalizedEmail = row.email.trim().toLocaleLowerCase("es-ES");
    const key = normalizedEmail || `${row.kind}:${row.id}`;
    const existing = contacts.get(key);
    if (existing) {
      if (!existing.sources.includes(row.kind)) existing.sources.push(row.kind);
      continue;
    }

    contacts.set(key, {
      key,
      name: row.contact_name,
      email: row.email,
      phone: row.phone,
      company: row.company,
      lastSeenAt: row.createdAt,
      sources: [row.kind],
    });
  }

  return [...contacts.values()];
}

export async function getCrmWorkspace() {
  const access = await getCrmAccess();
  if (access.state !== "ready") return access;

  const [inquiryResult, leadResult, organizationResult, quoteResult, activityResult] = await Promise.all([
    access.supabase
      .from("quote_inquiries")
      .select("id, contact_name, email, phone, company, message, status, source, created_at, updated_at")
      .order("created_at", { ascending: false }),
    access.supabase
      .from("crm_leads")
      .select("id, contact_name, email, phone, company, source, created_at")
      .order("created_at", { ascending: false }),
    access.supabase
      .from("organizations")
      .select("id, slug, legal_name, display_name, billing_email, is_active, created_at")
      .order("created_at", { ascending: false }),
    access.supabase
      .from("quotes")
      .select("id, quote_number, status, organization_name_snapshot, requester_name, requester_email, request_note, created_at, sales_owner_id")
      .in("status", ["requested", "in_review"])
      .order("created_at", { ascending: false })
      .limit(30),
    access.supabase
      .from("crm_activities")
      .select("id, event_key, title, subject_name, company_snapshot, created_at, crm_lead_id, quote_inquiry_id")
      .order("created_at", { ascending: false })
      .limit(8),
  ]);

  if (inquiryResult.error || leadResult.error || organizationResult.error || quoteResult.error || activityResult.error) {
    return { state: "error" } as const;
  }

  const inquiries = (inquiryResult.data ?? []) as QuoteInquiryRow[];
  const leads = (leadResult.data ?? []) as LeadRow[];
  const organizationRows = (organizationResult.data ?? []) as OrganizationRow[];
  const businessQuoteRows = (quoteResult.data ?? []) as BusinessQuoteRow[];
  const activityRows = (activityResult.data ?? []) as ActivityRow[];
  const quoteIds = businessQuoteRows.map((quote) => quote.id);
  const quoteItemsResult = quoteIds.length
    ? await access.supabase.from("quote_items")
        .select("id, quote_id, product_name, product_sku, variant_title, quantity, requested_unit_price, offered_unit_price, currency")
        .in("quote_id", quoteIds)
        .order("created_at")
    : { data: [], error: null };
  if (quoteItemsResult.error) return { state: "error" } as const;
  const quoteLineRows = (quoteItemsResult.data ?? []) as BusinessQuoteLineRow[];

  const opportunities: CrmOpportunity[] = inquiries.map((row) => ({
    id: row.id,
    name: row.contact_name,
    email: row.email,
    phone: row.phone,
    company: row.company,
    message: row.message,
    status: row.status,
    source: row.source,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));

  const activities: CrmActivity[] = activityRows.map((row) => ({
    id: String(row.id),
    kind: row.crm_lead_id ? "lead" : row.quote_inquiry_id ? "quote-inquiry" : "business-quote",
    title: row.title,
    name: row.subject_name,
    company: row.company_snapshot || null,
    createdAt: row.created_at,
  }));

  const salesQuotes: CrmSalesQuote[] = businessQuoteRows.map((quote) => ({
    id: quote.id,
    number: quote.quote_number,
    status: quote.status,
    organizationName: quote.organization_name_snapshot,
    requesterName: quote.requester_name,
    requesterEmail: quote.requester_email,
    requestNote: quote.request_note,
    createdAt: quote.created_at,
    salesOwnerId: quote.sales_owner_id,
    lines: quoteLineRows.filter((line) => line.quote_id === quote.id).map((line) => ({
      id: line.id,
      productName: line.product_name,
      sku: line.product_sku,
      variantTitle: line.variant_title,
      quantity: line.quantity,
      requestedUnitPrice: Number(line.requested_unit_price),
      offeredUnitPrice: line.offered_unit_price == null ? null : Number(line.offered_unit_price),
      currency: line.currency,
    })),
  }));

  return {
    state: "ready",
    userEmail: access.user.email ?? "",
    userId: access.user.id,
    opportunities,
    salesQuotes,
    contacts: mergeContacts(leads, inquiries),
    organizations: organizationRows.map((row) => ({
      id: row.id,
      slug: row.slug,
      legalName: row.legal_name,
      name: row.display_name,
      email: row.billing_email,
      active: row.is_active,
      createdAt: row.created_at,
    })),
    activities,
  } as const;
}
