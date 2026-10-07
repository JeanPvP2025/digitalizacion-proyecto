import { beforeEach, describe, expect, it, vi } from "vitest";

const operationsMock = vi.hoisted(() => ({
  getAccess: vi.fn(),
  createAdmin: vi.fn(),
  revalidate: vi.fn(),
}));

vi.mock("@/lib/operations/access", () => ({ getOperationsAccess: operationsMock.getAccess }));
vi.mock("@/lib/operations/admin", () => ({ createOperationsServiceClient: operationsMock.createAdmin }));
vi.mock("next/cache", () => ({ revalidatePath: operationsMock.revalidate }));

import {
  dispatchOperationsOrder,
  markOperationsOrderDelivered,
  packOperationsOrder,
  startOperationsPicking,
} from "@/lib/operations/actions";
import { getOperationsWorkspace } from "@/lib/operations/data";
import { idleOperationsActionState } from "@/lib/operations/contracts";

type QueryResult = { data: unknown; error: { code?: string } | null; count?: number | null };

function makeSupabase(results: Record<string, QueryResult[]>) {
  const calls: Array<{ table: string; methods: Array<[string, ...unknown[]]> }> = [];
  return {
    client: {
      from(table: string) {
        const call = { table, methods: [] as Array<[string, ...unknown[]]> };
        calls.push(call);
        const query = {
          record(name: string, ...args: unknown[]) { call.methods.push([name, ...args]); return this; },
          select(...args: unknown[]) { return this.record("select", ...args); },
          eq(...args: unknown[]) { return this.record("eq", ...args); },
          gte(...args: unknown[]) { return this.record("gte", ...args); },
          in(...args: unknown[]) { return this.record("in", ...args); },
          order(...args: unknown[]) { return this.record("order", ...args); },
          limit(...args: unknown[]) { return this.record("limit", ...args); },
          then(resolve: (result: QueryResult) => unknown, reject?: (reason: unknown) => unknown) {
            const result = results[table]?.shift() ?? { data: [], error: null };
            return Promise.resolve(result).then(resolve, reject);
          },
        };
        return query;
      },
    },
    calls,
  };
}

const orderId = "20000000-0000-4000-8000-000000000001";
const staffId = "20000000-0000-4000-8000-000000000002";
const orderRow = {
  id: orderId,
  order_number: "NOD-20261007-A1B2C3D4E5",
  status: "paid",
  grand_total: "899.99",
  currency: "EUR",
  created_at: "2026-10-07T09:00:00.000Z",
  shipping_address: { fullName: "Ana Martín", email: "ana@example.test", city: "Madrid", province: "Madrid", postalCode: "28013", address: "Calle privada, 1" },
};

beforeEach(() => {
  operationsMock.getAccess.mockReset();
  operationsMock.createAdmin.mockReset();
  operationsMock.revalidate.mockReset();
});

describe("operations workspace", () => {
  it("denies access before querying operational records", async () => {
    const { client, calls } = makeSupabase({});
    operationsMock.getAccess.mockResolvedValueOnce({ state: "forbidden" });

    expect(await getOperationsWorkspace()).toEqual({ status: "forbidden" });
    expect(calls).toEqual([]);
    expect(client).toBeDefined();
  });

  it("derives the queue, counts and timeline from protected order/event queries", async () => {
    const { client, calls } = makeSupabase({
      orders: [
        { data: [orderRow], error: null },
        { data: [], error: null },
        { data: null, error: null, count: 3 },
        { data: null, error: null, count: 1 },
        { data: [{ id: orderId, order_number: orderRow.order_number }], error: null },
      ],
      order_events: [
        { data: null, error: null, count: 5 },
        { data: null, error: null, count: 2 },
        { data: [{ id: 77, order_id: orderId, event_key: "order_created", note: "Pedido confirmado", occurred_at: "2026-10-07T09:01:00.000Z" }], error: null },
        { data: [{ order_id: orderId, event_key: "order_packed" }, { order_id: orderId, event_key: "order_picking_started" }], error: null },
      ],
      order_items: [{ data: [{ order_id: orderId, product_name: "Portátil NODRIA", product_sku: "NOD-LAP-01", quantity: 2 }], error: null }],
    });
    operationsMock.getAccess.mockResolvedValueOnce({ state: "ready", supabase: client });

    const snapshot = await getOperationsWorkspace(new Date("2026-10-07T10:00:00.000Z"));

    expect(snapshot).toMatchObject({
      status: "ready",
      readyForDispatch: 3,
      inTransit: 1,
      eventsLast24Hours: 5,
      deliveriesLast7Days: 2,
      orders: [{
        id: orderId,
        orderNumber: orderRow.order_number,
        fulfillmentStage: "packed",
        recipient: "Ana Martín",
        destination: "28013 · Madrid · Madrid",
        total: 899.99,
        items: [{ name: "Portátil NODRIA", sku: "NOD-LAP-01", quantity: 2 }],
      }],
      events: [{ orderNumber: orderRow.order_number, key: "Pedido creado", note: "Pedido confirmado" }],
    });
    expect(calls.map(({ table }) => table)).toContain("orders");
    expect(calls.map(({ table }) => table)).toContain("order_events");
    expect(calls.map(({ table }) => table)).toContain("order_items");
    expect(calls.some(({ table, methods }) => table === "orders" && methods.some(([method]) => method === "limit"))).toBe(true);
    const orderCalls = calls.filter(({ table }) => table === "orders");
    expect(orderCalls[0].methods).toContainEqual(["in", "status", ["paid", "processing"]]);
    expect(orderCalls[0].methods).toContainEqual(["eq", "payment_transactions.status", "paid"]);
    expect(orderCalls[1].methods).toContainEqual(["eq", "status", "shipped"]);
    expect(orderCalls[2].methods).toContainEqual(["in", "status", ["paid", "processing"]]);
    expect(orderCalls[2].methods).toContainEqual(["eq", "payment_transactions.status", "paid"]);
  });

  it("returns a real empty workspace and explicit errors from failed queries", async () => {
    const emptyClient = makeSupabase({
      orders: [
        { data: [], error: null },
        { data: [], error: null },
        { data: null, error: null, count: 0 },
        { data: null, error: null, count: 0 },
      ],
      order_events: [
        { data: null, error: null, count: 0 },
        { data: null, error: null, count: 0 },
        { data: [], error: null },
      ],
    });
    operationsMock.getAccess.mockResolvedValueOnce({ state: "ready", supabase: emptyClient.client });
    expect(await getOperationsWorkspace()).toMatchObject({
      status: "ready",
      orders: [],
      events: [],
      readyForDispatch: 0,
      inTransit: 0,
      eventsLast24Hours: 0,
      deliveriesLast7Days: 0,
    });

    const failedClient = makeSupabase({ orders: [{ data: null, error: { code: "XX000" } }] });
    operationsMock.getAccess.mockResolvedValueOnce({ state: "ready", supabase: failedClient.client });
    expect(await getOperationsWorkspace()).toEqual({ status: "error" });
  });
});

describe("fulfillment actions", () => {
  it("rejects a denied role before invoking the service-only fulfillment RPC", async () => {
    const rpc = vi.fn();
    operationsMock.getAccess.mockResolvedValueOnce({ state: "forbidden" });
    operationsMock.createAdmin.mockReturnValue({ rpc });
    const formData = new FormData();
    formData.set("orderId", orderId);

    const result = await startOperationsPicking(idleOperationsActionState, formData);

    expect(result).toEqual({ status: "error", message: "Tu cuenta no tiene permisos para operar pedidos." });
    expect(operationsMock.createAdmin).not.toHaveBeenCalled();
    expect(rpc).not.toHaveBeenCalled();
  });

  it("rejects an unexpected persisted result instead of refreshing the queue", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: "shipped", error: null });
    operationsMock.getAccess.mockResolvedValueOnce({ state: "ready", supabase: {}, user: { id: staffId } });
    operationsMock.createAdmin.mockReturnValue({ rpc });
    const formData = new FormData();
    formData.set("orderId", orderId);

    const result = await startOperationsPicking(idleOperationsActionState, formData);

    expect(rpc).toHaveBeenCalledWith("start_order_picking", { p_order_id: orderId, p_actor_user_id: staffId });
    expect(operationsMock.revalidate).not.toHaveBeenCalled();
    expect(result.status).toBe("error");
    expect(result.message).toContain("no confirmó");
  });

  it("accepts an idempotent retry after picking has already started", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: "picking", error: null });
    operationsMock.getAccess.mockResolvedValueOnce({ state: "ready", supabase: {}, user: { id: staffId } });
    operationsMock.createAdmin.mockReturnValue({ rpc });
    const formData = new FormData();
    formData.set("orderId", orderId);

    const result = await startOperationsPicking(idleOperationsActionState, formData);

    expect(result.status).toBe("success");
    expect(rpc).toHaveBeenCalledTimes(1);
  });

  it.each([
    [packOperationsOrder, "pack_order", "packed"],
    [dispatchOperationsOrder, "dispatch_order", "shipped"],
    [markOperationsOrderDelivered, "confirm_order_delivery", "delivered"],
  ] as const)("calls %s with the actor and accepts %s", async (action, rpcName, expected) => {
    const rpc = vi.fn().mockResolvedValue({ data: expected, error: null });
    operationsMock.getAccess.mockResolvedValueOnce({ state: "ready", supabase: {}, user: { id: staffId } });
    operationsMock.createAdmin.mockReturnValue({ rpc });
    const formData = new FormData();
    formData.set("orderId", orderId);

    const result = await action(idleOperationsActionState, formData);

    expect(rpc).toHaveBeenCalledWith(rpcName, { p_order_id: orderId, p_actor_user_id: staffId });
    expect(result.status).toBe("success");
    expect(operationsMock.revalidate).toHaveBeenCalledWith("/backoffice");
  });

  it("translates invalid persisted transitions and does not claim success", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: null, error: { code: "23514" } });
    operationsMock.getAccess.mockResolvedValueOnce({ state: "ready", supabase: {}, user: { id: staffId } });
    operationsMock.createAdmin.mockReturnValue({ rpc });
    const formData = new FormData();
    formData.set("orderId", orderId);

    const result = await dispatchOperationsOrder(idleOperationsActionState, formData);

    expect(result).toEqual({ status: "error", message: "El estado actual del pedido no permite esta acción." });
    expect(operationsMock.revalidate).not.toHaveBeenCalled();
  });

});
