import { beforeEach, describe, expect, it, vi } from "vitest";

class RedirectSignal extends Error {
  constructor(readonly location: string) { super(`Redirected to ${location}`); }
}

const crmMock = vi.hoisted(() => ({ getAccess: vi.fn(), revalidate: vi.fn() }));
vi.mock("@/lib/crm/auth", () => ({ getCrmAccess: crmMock.getAccess }));
vi.mock("next/cache", () => ({ revalidatePath: crmMock.revalidate }));
vi.mock("next/navigation", () => ({ redirect: (location: string) => { throw new RedirectSignal(location); } }));

import { updateOpportunityStatus } from "@/app/backoffice/crm/actions";

function form(id = "10000000-0000-4000-8000-000000000099", status = "qualified") {
  const data = new FormData();
  data.set("id", id);
  data.set("status", status);
  return data;
}

async function redirected(action: () => Promise<unknown>, location: string) {
  await expect(action()).rejects.toMatchObject({ location });
}

beforeEach(() => {
  crmMock.getAccess.mockReset();
  crmMock.revalidate.mockReset();
});

describe("CRM stage mutation integration", () => {
  it("rejects invalid identifiers and forged stages before checking access", async () => {
    await redirected(() => updateOpportunityStatus(form("not-a-uuid", "super_admin")), "/backoffice/crm?notice=invalid");
    expect(crmMock.getAccess).not.toHaveBeenCalled();
    expect(crmMock.revalidate).not.toHaveBeenCalled();
  });

  it("requires sales authorization before attempting an update", async () => {
    crmMock.getAccess.mockResolvedValue({ state: "forbidden" });
    const from = vi.fn();
    await redirected(() => updateOpportunityStatus(form()), "/backoffice/crm?notice=forbidden");
    expect(from).not.toHaveBeenCalled();
    expect(crmMock.revalidate).not.toHaveBeenCalled();
  });

  it.each([
    ["unconfigured", "/backoffice/crm?notice=unconfigured"],
    ["unauthenticated", "/acceso?next=%2Fbackoffice%2Fcrm"],
    ["error", "/backoffice/crm?notice=error"],
  ] as const)("routes the %s access state without writing", async (state, location) => {
    crmMock.getAccess.mockResolvedValue({ state });
    await redirected(() => updateOpportunityStatus(form()), location);
    expect(crmMock.revalidate).not.toHaveBeenCalled();
  });

  it("writes only a schema-valid stage and reports a missing or failed row", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: "qualified", error: null });
    const supabase = { rpc };
    crmMock.getAccess.mockResolvedValue({ state: "ready", supabase });

    await redirected(() => updateOpportunityStatus(form()), "/backoffice/crm?notice=updated");
    expect(rpc).toHaveBeenCalledWith("update_quote_inquiry_status", {
      p_inquiry_id: "10000000-0000-4000-8000-000000000099",
      p_status: "qualified",
    });
    expect(crmMock.revalidate).toHaveBeenCalledWith("/backoffice/crm");

    crmMock.revalidate.mockReset();
    rpc.mockResolvedValueOnce({ data: null, error: null });
    await redirected(() => updateOpportunityStatus(form()), "/backoffice/crm?notice=not-found");
    expect(crmMock.revalidate).not.toHaveBeenCalled();

    rpc.mockResolvedValueOnce({ data: null, error: { code: "XX000" } });
    await redirected(() => updateOpportunityStatus(form()), "/backoffice/crm?notice=error");
    expect(crmMock.revalidate).not.toHaveBeenCalled();
  });
});
