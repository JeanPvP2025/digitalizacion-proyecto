import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ auth: vi.fn(), grants: vi.fn() }));
vi.mock("@/lib/supabase/auth", () => ({ getServerAuthState: mocks.auth, getStaffRoleGrants: mocks.grants }));

import { getCatalogAdminAccess } from "@/lib/catalog/admin/access";

describe("catalog admin server authorization", () => {
  beforeEach(() => vi.clearAllMocks());

  it("requires a verified signed-in session", async () => {
    mocks.auth.mockResolvedValueOnce({ kind: "signed-out" });
    expect(await getCatalogAdminAccess()).toEqual({ status: "unauthenticated" });
    expect(mocks.grants).not.toHaveBeenCalled();
  });

  it("allows only the persisted catalog_manager or super_admin grants", async () => {
    const auth = { kind: "signed-in", supabase: {}, user: { id: "staff-1" } };
    mocks.auth.mockResolvedValue(auth);
    mocks.grants.mockResolvedValueOnce({ roles: ["catalog_manager"], error: null });
    expect((await getCatalogAdminAccess()).status).toBe("ready");
    expect(mocks.grants).toHaveBeenCalledWith(auth.supabase, auth.user.id);

    mocks.grants.mockResolvedValueOnce({ roles: ["fulfillment_manager"], error: null });
    expect(await getCatalogAdminAccess()).toEqual({ status: "forbidden" });

    mocks.grants.mockResolvedValueOnce({ roles: ["super_admin"], error: null });
    expect((await getCatalogAdminAccess()).status).toBe("ready");
  });

  it("fails closed when role grants cannot be read", async () => {
    mocks.auth.mockResolvedValueOnce({ kind: "signed-in", supabase: {}, user: { id: "staff-1" } });
    mocks.grants.mockResolvedValueOnce({ roles: [], error: new Error("database offline") });
    expect(await getCatalogAdminAccess()).toEqual({ status: "error" });
  });
});

