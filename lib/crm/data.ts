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
  kind: "lead" | "quote-inquiry";
  title: string;
  name: string;
  company: string | null;
  createdAt: string;
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

function sortNewest<T extends { createdAt: string }>(rows: T[]): T[] {
  return rows.sort((left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt));
}

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

  const [inquiryResult, leadResult, organizationResult] = await Promise.all([
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
  ]);

  if (inquiryResult.error || leadResult.error || organizationResult.error) {
    return { state: "error" } as const;
  }

  const inquiries = (inquiryResult.data ?? []) as QuoteInquiryRow[];
  const leads = (leadResult.data ?? []) as LeadRow[];
  const organizationRows = (organizationResult.data ?? []) as OrganizationRow[];

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

  const activities: CrmActivity[] = [
    ...leads.map((row) => ({
      id: `lead:${row.id}`,
      kind: "lead" as const,
      title: "Nuevo contacto",
      name: row.contact_name,
      company: row.company,
      createdAt: row.created_at,
    })),
    ...inquiries.map((row) => ({
      id: `inquiry:${row.id}`,
      kind: "quote-inquiry" as const,
      title: "Solicitud de presupuesto",
      name: row.contact_name,
      company: row.company,
      createdAt: row.created_at,
    })),
  ];

  return {
    state: "ready",
    userEmail: access.user.email ?? "",
    opportunities,
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
    activities: sortNewest(activities).slice(0, 8),
  } as const;
}
