import { beforeEach, describe, expect, it, vi } from "vitest";

class RedirectSignal extends Error {
  constructor(readonly location: string) { super(`Redirected to ${location}`); }
}

const crmMock = vi.hoisted(() => ({ getAccess: vi.fn(), revalidate: vi.fn() }));
vi.mock("@/lib/crm/auth", () => ({ getCrmAccess: crmMock.getAccess }));
vi.mock("next/cache", () => ({ revalidatePath: crmMock.revalidate }));
vi.mock("next/navigation", () => ({ redirect: (location: string) => { throw new RedirectSignal(location); } }));

import { claimBusinessQuote, sendBusinessQuote } from "@/app/backoffice/crm/actions";

const quoteId = "10000000-0000-4000-8000-000000000101";
const lineId = "10000000-0000-4000-8000-000000000102";

function quoteForm(id = quoteId) {
  const form = new FormData();
  form.set("quoteId", id);
  return form;
}

function offerForm() {
  const form = quoteForm();
  form.set("validityDays", "14");
  form.set("offer", JSON.stringify([{ quote_item_id: lineId, unit_price: 1099.95 }]));
  return form;
}

async function redirected(action: () => Promise<unknown>, location: string) {
  await expect(action()).rejects.toMatchObject({ location });
}

beforeEach(() => {
  crmMock.getAccess.mockReset();
  crmMock.revalidate.mockReset();
});

describe("B2B sales quote actions", () => {
  it("validates a quote identifier before asking for staff access", async () => {
    await redirected(() => claimBusinessQuote(quoteForm("bad-id")), "/backoffice/crm?notice=invalid");
    expect(crmMock.getAccess).not.toHaveBeenCalled();
  });

  it("requires staff access, then claims only through the guarded RPC", async () => {
    crmMock.getAccess.mockResolvedValue({ state: "forbidden" });
    await redirected(() => claimBusinessQuote(quoteForm()), "/backoffice/crm?notice=forbidden");

    const rpc = vi.fn().mockResolvedValue({ data: quoteId, error: null });
    crmMock.getAccess.mockResolvedValue({ state: "ready", supabase: { rpc } });
    await redirected(() => claimBusinessQuote(quoteForm()), "/backoffice/crm?notice=quote-claimed");
    expect(rpc).toHaveBeenCalledWith("claim_business_quote", { p_quote_id: quoteId });
    expect(crmMock.revalidate).toHaveBeenCalledWith("/backoffice/crm");
    expect(crmMock.revalidate).toHaveBeenCalledWith("/empresas/portal");
  });

  it("rejects malformed prices before making a database call", async () => {
    const form = offerForm();
    form.set("offer", "[{broken json]");
    await redirected(() => sendBusinessQuote(form), "/backoffice/crm?notice=invalid");
    expect(crmMock.getAccess).not.toHaveBeenCalled();

    const invalidPrice = offerForm();
    invalidPrice.set("offer", JSON.stringify([{ quote_item_id: lineId, unit_price: -1 }]));
    await redirected(() => sendBusinessQuote(invalidPrice), "/backoffice/crm?notice=invalid");
    expect(crmMock.getAccess).not.toHaveBeenCalled();
  });

  it("sends every validated line and lets PostgreSQL enforce quote ownership and state", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: quoteId, error: null });
    crmMock.getAccess.mockResolvedValue({ state: "ready", supabase: { rpc } });
    const before = Date.now();
    await redirected(() => sendBusinessQuote(offerForm()), "/backoffice/crm?notice=quote-sent");

    expect(rpc).toHaveBeenCalledTimes(1);
    const [functionName, payload] = rpc.mock.calls[0];
    expect(functionName).toBe("send_business_quote");
    expect(payload.p_quote_id).toBe(quoteId);
    expect(payload.p_offers).toEqual([{ item_id: lineId, unit_price: 1099.95 }]);
    expect(Date.parse(payload.p_valid_until)).toBeGreaterThanOrEqual(before + 13 * 24 * 60 * 60 * 1000);
    expect(Date.parse(payload.p_valid_until)).toBeLessThanOrEqual(Date.now() + 15 * 24 * 60 * 60 * 1000);
    expect(crmMock.revalidate).toHaveBeenCalledWith("/backoffice/crm");
    expect(crmMock.revalidate).toHaveBeenCalledWith("/empresas/portal");
  });
});
