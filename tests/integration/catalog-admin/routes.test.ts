import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ getAccess: vi.fn() }));
vi.mock("@/lib/catalog/admin/access", () => ({ getCatalogAdminAccess: mocks.getAccess }));

import { PATCH } from "@/app/api/backoffice/catalog/route";

function request(body: unknown, origin = "http://localhost") {
  return new Request("http://localhost/api/backoffice/catalog", {
    method: "PATCH",
    headers: { "content-type": "application/json", origin, host: "localhost" },
    body: JSON.stringify(body),
  });
}

function authorized(rpc = vi.fn()) {
  mocks.getAccess.mockResolvedValueOnce({ status: "ready", supabase: { rpc }, userId: "staff-1" });
  return rpc;
}

describe("catalog admin API", () => {
  beforeEach(() => vi.clearAllMocks());

  it("denies signed-out requests and roles outside catalog_manager/super_admin", async () => {
    mocks.getAccess.mockResolvedValueOnce({ status: "unauthenticated" });
    const signedOut = await PATCH(request({ productId: "pr_demo", changes: { name: "Nuevo nombre" } }));
    expect(signedOut.status).toBe(401);

    mocks.getAccess.mockResolvedValueOnce({ status: "forbidden" });
    const otherRole = await PATCH(request({ productId: "pr_demo", changes: { name: "Nuevo nombre" } }));
    expect(otherRole.status).toBe(403);
    expect(mocks.getAccess).toHaveBeenCalledTimes(2);
  });

  it("rejects unknown/protected fields and cross-origin writes before RPC", async () => {
    const rpc = authorized();
    const invalid = await PATCH(request({ productId: "pr_demo", changes: { name: "Nuevo", is_published: true } }));
    expect(invalid.status).toBe(400);
    authorized(rpc);
    const crossOrigin = await PATCH(request({ productId: "pr_demo", changes: { name: "Nuevo" } }, "https://other.example"));
    expect(crossOrigin.status).toBe(403);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("calls only the exact scoped RPC with the validated changes", async () => {
    const rpc = authorized().mockResolvedValueOnce({ data: null, error: null });
    const response = await PATCH(request({ productId: "pr_fluxbook14", changes: { name: "FluxBook 14 Pro renovado", image_url: null } }));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ saved: true });
    expect(rpc).toHaveBeenCalledExactlyOnceWith("update_catalog_product_editorial", {
      p_product_id: "pr_fluxbook14",
      p_changes: { name: "FluxBook 14 Pro renovado", image_url: null },
    });
  });

  it("reports the missing RPC as a dependency instead of falling back to DML", async () => {
    const rpc = authorized().mockResolvedValueOnce({ data: null, error: { code: "PGRST202" } });
    const response = await PATCH(request({ productId: "pr_demo", changes: { name: "Cambio pendiente" } }));
    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({ error: expect.stringContaining("RPC segura") });
    expect(rpc).toHaveBeenCalledOnce();
  });
});
