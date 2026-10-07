import { beforeEach, describe, expect, it, vi } from "vitest";

class RedirectSignal extends Error {
  constructor(readonly location: string) { super(`Redirected to ${location}`); }
}

const mocks = vi.hoisted(() => ({ createClient: vi.fn(), revalidatePath: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createSupabaseServerClient: mocks.createClient }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("next/navigation", () => ({ redirect: (location: string) => { throw new RedirectSignal(location); } }));

import { convertAcceptedBusinessQuote, createBusinessOrderFromAcceptedQuote } from "@/app/(store)/empresas/portal/actions";

const quoteId = "10000000-0000-4000-8000-000000000099";
const organizationId = "10000000-0000-4000-8000-000000000098";

function form(quote = quoteId, organization = organizationId) {
  const data = new FormData();
  data.set("quoteId", quote);
  data.set("organizationId", organization);
  return data;
}

function orderForm(quote = quoteId, organization = organizationId) {
  const data = form(quote, organization);
  data.set("shippingName", "CRM Organización A SL");
  data.set("shippingAddress", "Calle de prueba 42");
  data.set("shippingPostalCode", "28013");
  data.set("shippingCity", "Madrid");
  data.set("billingName", "CRM Organización A SL");
  data.set("billingAddress", "Avenida de prueba 19");
  data.set("billingPostalCode", "28014");
  data.set("billingCity", "Madrid");
  data.set("confirmTerms", "accepted");
  return data;
}

async function redirected(action: () => Promise<unknown>, location: string) {
  await expect(action()).rejects.toMatchObject({ location });
}

beforeEach(() => {
  mocks.createClient.mockReset();
  mocks.revalidatePath.mockReset();
});

describe("B2B quote conversion action", () => {
  it("rejects malformed ids before connecting to Supabase", async () => {
    await redirected(() => convertAcceptedBusinessQuote(form("invalid")), "/empresas/portal?notice=invalid");
    expect(mocks.createClient).not.toHaveBeenCalled();
  });

  it("requires an authenticated Supabase user", async () => {
    mocks.createClient.mockResolvedValue({ auth: { getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: null }) } });
    await redirected(() => convertAcceptedBusinessQuote(form()), "/acceso?next=%2Fempresas%2Fportal");
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });

  it("sends only the quote id to the tenant-authorized idempotent RPC", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: "conversion-id", error: null });
    mocks.createClient.mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: "user-a" } }, error: null }) },
      rpc,
    });
    await redirected(() => convertAcceptedBusinessQuote(form()), `/empresas/portal?notice=quote-converted&organization=${organizationId}`);
    expect(rpc).toHaveBeenCalledExactlyOnceWith("convert_accepted_business_quote", { p_quote_id: quoteId });
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/empresas/portal");
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/backoffice/crm");
  });

  it("surfaces database authorization failures without reporting success", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: null, error: { code: "42501" } });
    mocks.createClient.mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: "user-b" } }, error: null }) },
      rpc,
    });
    await redirected(() => convertAcceptedBusinessQuote(form()), `/empresas/portal?notice=forbidden&organization=${organizationId}`);
  });
});

describe("B2B accepted quote order action", () => {
  it("rejects malformed address fields before connecting to Supabase", async () => {
    const invalid = orderForm();
    invalid.set("shippingPostalCode", "12");
    await redirected(() => createBusinessOrderFromAcceptedQuote(invalid), `/empresas/portal?notice=invalid&organization=${organizationId}`);
    expect(mocks.createClient).not.toHaveBeenCalled();
  });

  it("requires a signed-in tenant owner or admin session before calling the guarded RPC", async () => {
    mocks.createClient.mockResolvedValue({ auth: { getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: null }) } });
    await redirected(() => createBusinessOrderFromAcceptedQuote(orderForm()), "/acceso?next=%2Fempresas%2Fportal");
  });

  it("sends only the quote id and validated address snapshots to the tenant-authorized RPC", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: [{ order_id: "20000000-0000-4000-8000-000000000001" }], error: null });
    mocks.createClient.mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: "user-a" } }, error: null }) },
      rpc,
    });
    await redirected(() => createBusinessOrderFromAcceptedQuote(orderForm()), `/empresas/portal?notice=business-order-created&organization=${organizationId}`);
    expect(rpc).toHaveBeenCalledExactlyOnceWith("create_business_order_from_accepted_quote", {
      p_quote_id: quoteId,
      p_shipping_address: {
        fullName: "CRM Organización A SL", address: "Calle de prueba 42", postalCode: "28013", city: "Madrid", countryCode: "ES",
      },
      p_billing_address: {
        fullName: "CRM Organización A SL", address: "Avenida de prueba 19", postalCode: "28014", city: "Madrid", countryCode: "ES",
      },
    });
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/empresas/portal");
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/backoffice/crm");
  });

  it("does not report success when tenant authorization or stock reservation fails", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: null, error: { code: "42501" } });
    mocks.createClient.mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: "user-b" } }, error: null }) },
      rpc,
    });
    await redirected(() => createBusinessOrderFromAcceptedQuote(orderForm()), `/empresas/portal?notice=forbidden&organization=${organizationId}`);

    rpc.mockResolvedValue({ data: null, error: { code: "P0001" } });
    await redirected(() => createBusinessOrderFromAcceptedQuote(orderForm()), `/empresas/portal?notice=stock-unavailable&organization=${organizationId}`);
  });
});
