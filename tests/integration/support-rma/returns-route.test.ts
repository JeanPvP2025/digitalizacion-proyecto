import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { isReturnWithinWindow } from "@/lib/support/returns";

const supabaseMock = vi.hoisted(() => ({ createClient: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createSupabaseServerClient: supabaseMock.createClient }));

type ReturnsRoute = typeof import("@/app/api/support/returns/route");
let route: ReturnsRoute;
const environmentKeys = ["NODE_ENV", "DEMO_MODE", "NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"] as const;
let originalEnvironment: Record<(typeof environmentKeys)[number], string | undefined>;

function query(data: unknown, error: unknown = null) {
  const builder = {
    select: vi.fn(() => builder),
    eq: vi.fn(() => builder),
    in: vi.fn(() => builder),
    order: vi.fn(() => builder),
    maybeSingle: vi.fn(async () => ({ data, error })),
    then: (resolve: (value: { data: unknown; error: unknown }) => unknown) => Promise.resolve({ data, error }).then(resolve),
  };
  return builder;
}

function request(url: string, body?: unknown) {
  return new Request(`http://localhost${url}`, {
    method: body === undefined ? "GET" : "POST",
    headers: body === undefined ? undefined : { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

function connectedClient(from: (table: string) => unknown, rpc = vi.fn()) {
  return {
    auth: { getUser: async () => ({ data: { user: { id: "20000000-0000-4000-8000-000000000001" } }, error: null }) },
    from,
    rpc,
  };
}

describe("support return routes", () => {
  beforeAll(() => {
    originalEnvironment = Object.fromEntries(environmentKeys.map((key) => [key, process.env[key]])) as typeof originalEnvironment;
  });

  beforeEach(async () => {
    Reflect.set(process.env, "NODE_ENV", "production");
    process.env.NEXT_PUBLIC_SUPABASE_URL = "http://127.0.0.1:56201";
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "qa-publishable-key";
    delete process.env.DEMO_MODE;
    supabaseMock.createClient.mockReset();
    route = await import("@/app/api/support/returns/route");
  });

  afterAll(() => {
    for (const key of environmentKeys) {
      const value = originalEnvironment?.[key];
      if (value === undefined) Reflect.deleteProperty(process.env, key);
      else Reflect.set(process.env, key, value);
    }
  });

  it("loads only remaining line quantities for an owned order inside the delivery window", async () => {
    const firstItemId = randomUUID();
    const secondItemId = randomUUID();
    const activeReturnId = randomUUID();
    const tableCalls: string[] = [];
    supabaseMock.createClient.mockResolvedValueOnce(connectedClient((table) => {
      tableCalls.push(table);
      if (table === "orders") return query({
        id: randomUUID(), order_number: "NDR-2026-000001", status: "delivered",
        delivered_at: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(), organization_id: null,
      });
      if (table === "organization_memberships") return query(null);
      if (table === "order_items") return query([
        { id: firstItemId, product_name: "Portátil", product_sku: "NOD-PORT-1", variant_title: "16 GB", quantity: 2 },
        { id: secondItemId, product_name: "Monitor", product_sku: "NOD-MON-2", variant_title: "27 pulgadas", quantity: 1 },
      ]);
      if (table === "return_requests") return query([
        { id: activeReturnId, status: "requested" },
        { id: randomUUID(), status: "rejected" },
      ]);
      if (table === "return_items") return query([{ order_item_id: firstItemId, quantity: 1 }]);
      throw new Error(`Unexpected table ${table}`);
    }));

    const response = await route.GET(request("/api/support/returns?orderNumber=NDR-2026-000001"));
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      ok: true,
      items: [
        { id: firstItemId, availableQuantity: 1 },
        { id: secondItemId, availableQuantity: 1 },
      ],
    });
    expect(tableCalls).toEqual(["orders", "order_items", "return_requests", "return_items"]);
    expect(response.headers.get("cache-control")).toBe("no-store");
  });

  it("does not look up or create a return for an order outside the current account", async () => {
    const rpc = vi.fn();
    const orderQuery = query(null);
    supabaseMock.createClient.mockResolvedValueOnce(connectedClient(() => orderQuery, rpc));

    const response = await route.POST(request("/api/support/returns", {
      orderNumber: "NDR-2026-OTHER",
      reason: "El producto no es adecuado para mi configuración.",
      idempotencyKey: randomUUID(),
      items: [{ orderItemId: randomUUID(), quantity: 1 }],
    }));

    expect(response.status).toBe(404);
    expect(rpc).not.toHaveBeenCalled();
    expect(orderQuery.eq).toHaveBeenNthCalledWith(2, "customer_id", "20000000-0000-4000-8000-000000000001");
  });

  it("passes a stable request key to the database and returns its confirmed reference", async () => {
    const orderId = randomUUID();
    const returnId = randomUUID();
    const key = randomUUID();
    const rpc = vi.fn().mockResolvedValueOnce({ data: returnId, error: null });
    supabaseMock.createClient.mockResolvedValueOnce(connectedClient((table) => {
      if (table === "orders") return query({ id: orderId, organization_id: null });
      if (table === "return_requests") return query({ return_number: "RET-20261007-ABC12345" });
      throw new Error(`Unexpected table ${table}`);
    }, rpc));

    const response = await route.POST(request("/api/support/returns", {
      orderNumber: "NDR-2026-000001",
      reason: "El producto no es adecuado para mi configuración.",
      idempotencyKey: key,
      items: [{ orderItemId: randomUUID(), quantity: 1 }],
    }));

    expect(response.status).toBe(201);
    expect(await response.json()).toMatchObject({ persisted: true, returnNumber: "RET-20261007-ABC12345" });
    expect(rpc).toHaveBeenCalledWith("request_return", expect.objectContaining({
      p_order_id: orderId,
      p_idempotency_key: key,
    }));
  });

  it("rejects repeated item lines and enforces delivery time from delivered_at", async () => {
    const itemId = randomUUID();
    const invalid = await route.POST(request("/api/support/returns", {
      orderNumber: "NDR-2026-000001",
      reason: "El producto no es adecuado para mi configuración.",
      idempotencyKey: randomUUID(),
      items: [{ orderItemId: itemId, quantity: 1 }, { orderItemId: itemId, quantity: 1 }],
    }));
    expect(invalid.status).toBe(400);
    expect(supabaseMock.createClient).not.toHaveBeenCalled();

    const now = Date.now();
    expect(isReturnWithinWindow("delivered", new Date(now - 30 * 24 * 60 * 60 * 1000).toISOString(), now)).toBe(true);
    expect(isReturnWithinWindow("delivered", new Date(now - 30 * 24 * 60 * 60 * 1000 - 1).toISOString(), now)).toBe(false);
    expect(isReturnWithinWindow("processing", new Date(now).toISOString(), now)).toBe(false);
  });
});
