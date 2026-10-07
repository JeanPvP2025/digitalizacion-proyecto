import { beforeEach, describe, expect, it, vi } from "vitest";

class RedirectSignal extends Error {
  constructor(readonly location: string) { super(`Redirected to ${location}`); }
}

const portalMock = vi.hoisted(() => ({ createClient: vi.fn(), revalidate: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createSupabaseServerClient: portalMock.createClient }));
vi.mock("next/cache", () => ({ revalidatePath: portalMock.revalidate }));
vi.mock("next/navigation", () => ({ redirect: (location: string) => { throw new RedirectSignal(location); } }));

import { addOrganizationMember, requestBusinessQuote, respondToBusinessQuote } from "@/app/(store)/empresas/portal/actions";

const organizationId = "10000000-0000-4000-8000-000000000201";
const variantId = "10000000-0000-4000-8000-000000000202";
const quoteId = "10000000-0000-4000-8000-000000000203";

function makeForm(entries: Record<string, string>) {
  const form = new FormData();
  for (const [key, value] of Object.entries(entries)) form.set(key, value);
  return form;
}

function connectedClient(rpc: ReturnType<typeof vi.fn>) {
  return {
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: "10000000-0000-4000-8000-000000000204" } }, error: null }) },
    rpc,
  };
}

async function redirected(action: () => Promise<unknown>, location: string) {
  await expect(action()).rejects.toMatchObject({ location });
}

beforeEach(() => {
  portalMock.createClient.mockReset();
  portalMock.revalidate.mockReset();
});

describe("B2B organization actions", () => {
  it("rejects attempts to grant the protected owner role before authentication lookup", async () => {
    const form = makeForm({ organizationId, email: "member@example.test", role: "owner" });
    await redirected(() => addOrganizationMember(form), "/empresas/portal?notice=invalid");
    expect(portalMock.createClient).not.toHaveBeenCalled();
  });

  it("submits only catalog variant ids and quantities to the price-snapshot RPC", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: quoteId, error: null });
    portalMock.createClient.mockResolvedValue(connectedClient(rpc));
    const form = makeForm({
      organizationId,
      requestNote: "Renovación de equipos para el equipo técnico.",
      lines: JSON.stringify([{ variantId, quantity: 4 }]),
    });

    await redirected(() => requestBusinessQuote(form), `/empresas/portal?notice=quote-requested&organization=${organizationId}`);
    expect(rpc).toHaveBeenCalledWith("create_business_quote", {
      p_organization_id: organizationId,
      p_request_note: "Renovación de equipos para el equipo técnico.",
      p_lines: [{ variant_id: variantId, quantity: 4 }],
    });
    expect(portalMock.revalidate).toHaveBeenCalledWith("/empresas/portal");
  });

  it("checks decision values and returns through the selected organization", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: "accepted", error: null });
    portalMock.createClient.mockResolvedValue(connectedClient(rpc));
    const form = makeForm({ quoteId, organizationId, decision: "accepted" });

    await redirected(() => respondToBusinessQuote(form), `/empresas/portal?notice=quote-accepted&organization=${organizationId}`);
    expect(rpc).toHaveBeenCalledWith("respond_to_business_quote", { p_quote_id: quoteId, p_decision: "accepted" });
  });
});
