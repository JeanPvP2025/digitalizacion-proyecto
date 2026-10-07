import { randomUUID } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";

const accessMock = vi.hoisted(() => ({ get: vi.fn() }));
vi.mock("@/lib/inventory/procurement/access", () => ({ getProcurementAccess: accessMock.get }));

let route: typeof import("@/app/api/backoffice/returns/inspection/route");
const returnRequestId = "20000000-0000-4000-8000-000000000101";
const returnItemId = "20000000-0000-4000-8000-000000000102";
const warehouseId = "20000000-0000-4000-8000-000000000103";

function request(body: unknown, origin = "http://localhost") {
  return new Request("http://localhost/api/backoffice/returns/inspection", {
    method: "POST",
    headers: { "content-type": "application/json", origin, host: "localhost" },
    body: JSON.stringify(body),
  });
}

function payload() {
  return {
    returnRequestId, returnItemId, warehouseId,
    disposition: "restocked", quantity: 2,
    reason: "Unidad comprobada, sellada y apta para volver a la venta.",
    idempotencyKey: randomUUID(),
  };
}

function ready(rpc = vi.fn()) {
  accessMock.get.mockResolvedValueOnce({ status: "ready", supabase: { rpc } });
  return rpc;
}

beforeEach(async () => {
  accessMock.get.mockReset();
  route = await import("@/app/api/backoffice/returns/inspection/route");
});

describe("warehouse return inspection route", () => {
  it("denies non-warehouse access before the RPC", async () => {
    accessMock.get.mockResolvedValueOnce({ status: "forbidden" });
    const response = await route.POST(request(payload()));
    expect(response.status).toBe(403);
    expect(await response.json()).toMatchObject({ error: expect.stringContaining("fulfillment_manager") });
  });

  it("rejects an altered quantity or cross-origin mutation before persistence", async () => {
    const rpc = ready();
    const altered = await route.POST(request({ ...payload(), quantity: 100001 }));
    const crossOrigin = await route.POST(request(payload(), "https://other.example"));
    expect(altered.status).toBe(400);
    expect(crossOrigin.status).toBe(403);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("sends a validated disposition and idempotency key to PostgreSQL", async () => {
    const input = payload();
    const rpc = ready().mockResolvedValueOnce({ data: [{
      return_request_id: returnRequestId, return_item_id: returnItemId,
      disposition: "restocked", quantity: 2, inventory_movement_id: 17, replayed: false,
    }], error: null });
    const response = await route.POST(request(input));
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      inspection: { return_request_id: returnRequestId, disposition: "restocked", quantity: 2, inventory_movement_id: 17 },
    });
    expect(rpc).toHaveBeenCalledWith("inspect_return_item", {
      p_return_request_id: input.returnRequestId,
      p_return_item_id: input.returnItemId,
      p_warehouse_id: input.warehouseId,
      p_disposition: input.disposition,
      p_quantity: input.quantity,
      p_reason: input.reason,
      p_idempotency_key: input.idempotencyKey,
    });
  });

  it("surfaces an idempotency conflict without hiding it as a success", async () => {
    ready().mockResolvedValueOnce({ data: null, error: { code: "23505" } });
    const response = await route.POST(request(payload()));
    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({ error: expect.stringContaining("ya se inspeccionó") });
  });
});
