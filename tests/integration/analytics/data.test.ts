import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getServerDataMode: vi.fn(),
  getServerAuthState: vi.fn(),
}));

vi.mock("@/lib/server/data-mode", () => ({ getServerDataMode: mocks.getServerDataMode }));
vi.mock("@/lib/supabase/auth", () => ({ getServerAuthState: mocks.getServerAuthState }));

import { getAnalyticsSnapshot } from "@/lib/analytics/data";

type DbResult = { data: unknown; error: { code?: string } | null };
type QueryCall = { table: string; methods: Array<[string, ...unknown[]]> };

function makeSupabase(options: {
  role?: DbResult;
  rows?: Record<string, unknown[]>;
  errors?: Record<string, { code?: string }>;
  calls?: QueryCall[];
} = {}) {
  const calls = options.calls ?? [];
  const client = {
    from(table: string) {
      let rangeStart = 0;
      let rangeEnd = 499;
      const query = {
        methods: [] as Array<[string, ...unknown[]]>,
        record(name: string, ...args: unknown[]) { this.methods.push([name, ...args]); return this; },
        select(columns: string) { return this.record("select", columns); },
        eq(column: string, value: unknown) { return this.record("eq", column, value); },
        in(column: string, values: unknown[]) { return this.record("in", column, values); },
        gte(column: string, value: unknown) { return this.record("gte", column, value); },
        lt(column: string, value: unknown) { return this.record("lt", column, value); },
        order(column: string, options?: unknown) { return this.record("order", column, options); },
        range(from: number, to: number) { rangeStart = from; rangeEnd = to; return this.record("range", from, to); },
        returns() { return this; },
        maybeSingle() { return Promise.resolve(options.role ?? { data: { role: "super_admin" }, error: null }); },
        then(resolve: (value: DbResult) => unknown, reject?: (reason: unknown) => unknown) {
          const rows = options.rows?.[table] ?? [];
          const result = {
            data: rows.slice(rangeStart, rangeEnd + 1),
            error: options.errors?.[table] ?? null,
          };
          return Promise.resolve(result).then(resolve, reject);
        },
      };
      calls.push({ table, methods: query.methods });
      return query;
    },
  };

  return { client, calls };
}

function signedIn(client: unknown) {
  mocks.getServerDataMode.mockReturnValue("supabase");
  mocks.getServerAuthState.mockResolvedValue({
    kind: "signed-in",
    supabase: client,
    user: { id: "10000000-0000-4000-8000-000000000001", email: "admin@nodria.example" },
  });
}

beforeEach(() => {
  mocks.getServerDataMode.mockReset();
  mocks.getServerAuthState.mockReset();
});

describe("analytics server data boundary", () => {
  it("does not expose fixture data when Supabase is not configured", async () => {
    mocks.getServerDataMode.mockReturnValue("unavailable");

    expect(await getAnalyticsSnapshot(new Date("2026-10-07T12:00:00.000Z"))).toEqual({ state: "not_configured" });
    expect(mocks.getServerAuthState).not.toHaveBeenCalled();
  });

  it("does not query any business source for an unauthenticated request", async () => {
    mocks.getServerDataMode.mockReturnValue("supabase");
    mocks.getServerAuthState.mockResolvedValue({ kind: "signed-out" });

    expect(await getAnalyticsSnapshot()).toEqual({ state: "unauthenticated" });
  });

  it("requires the persisted super_admin grant before querying metrics", async () => {
    const calls: QueryCall[] = [];
    const { client } = makeSupabase({ role: { data: null, error: null }, calls });
    signedIn(client);

    expect(await getAnalyticsSnapshot()).toEqual({ state: "forbidden" });
    expect(calls.map(({ table }) => table)).toEqual(["user_role_grants"]);
    expect(calls[0].methods).toContainEqual(["eq", "role", "super_admin"]);
    expect(calls[0].methods).toContainEqual(["eq", "user_id", "10000000-0000-4000-8000-000000000001"]);
  });

  it("returns complete zero metrics from empty connected sources", async () => {
    const calls: QueryCall[] = [];
    const { client } = makeSupabase({ calls });
    signedIn(client);

    const snapshot = await getAnalyticsSnapshot(new Date("2026-10-07T12:00:00.000Z"));

    expect(snapshot.state).toBe("ready");
    if (snapshot.state !== "ready") return;
    expect(snapshot.metrics).toEqual({
      orderCount: 0,
      grossSalesEurCents: 0,
      grossSalesExcludedCurrencyOrders: 0,
      approvedPaymentOrders: 0,
      resolvedPaymentOrders: 0,
      paymentApprovalRate: null,
      inventory: { availableUnits: 0, reservedUnits: 0, rowCount: 0 },
      crm: { convertedRequests: 0, totalRequests: 0, conversionRate: null },
    });
    expect(calls.map(({ table }) => table).sort()).toEqual([
      "inventory",
      "order_events",
      "orders",
      "payment_transactions",
      "quote_inquiries",
      "user_role_grants",
    ]);
  });

  it("uses one Madrid period for order, payment-event, payment and CRM reads", async () => {
    const calls: QueryCall[] = [];
    const { client } = makeSupabase({ calls });
    signedIn(client);
    await getAnalyticsSnapshot(new Date("2026-10-07T12:00:00.000Z"));

    const start = "2026-09-07T22:00:00.000Z";
    const end = "2026-10-07T12:00:00.000Z";
    for (const table of ["orders", "order_events", "payment_transactions", "quote_inquiries"]) {
      const methods = calls.find((call) => call.table === table)?.methods ?? [];
      expect(methods).toContainEqual(["gte", table === "orders" ? "placed_at" : table === "order_events" ? "occurred_at" : table === "payment_transactions" ? "processed_at" : "created_at", start]);
      expect(methods).toContainEqual(["lt", table === "orders" ? "placed_at" : table === "order_events" ? "occurred_at" : table === "payment_transactions" ? "processed_at" : "created_at", end]);
    }
  });

  it("withholds the entire dashboard if one source read fails", async () => {
    const { client } = makeSupabase({ errors: { inventory: { code: "42501" } } });
    signedIn(client);

    expect(await getAnalyticsSnapshot()).toEqual({ state: "error", reason: "query" });
  });

  it("withholds an inconsistent payment/order join instead of rendering sales", async () => {
    const { client } = makeSupabase({
      rows: {
        order_events: [{ id: 1, order_id: "order-1", event_key: "payment_paid", occurred_at: "2026-10-06T10:00:00.000Z" }],
        payment_transactions: [{
          id: "payment-1",
          order_id: "order-1",
          status: "failed",
          amount: "100.00",
          currency: "EUR",
          processed_at: "2026-10-06T10:00:00.000Z",
          order: { id: "order-1", status: "paid", grand_total: "100.00", currency: "EUR" },
        }],
      },
    });
    signedIn(client);

    expect(await getAnalyticsSnapshot(new Date("2026-10-07T12:00:00.000Z")))
      .toEqual({ state: "error", reason: "inconsistent" });
  });

  it("fails closed when a source exceeds the full-read cap", async () => {
    const stockRows = Array.from({ length: 5_001 }, (_, index) => ({
      warehouse_id: "warehouse-1",
      variant_id: `variant-${index}`,
      on_hand: 1,
      reserved: 0,
    }));
    const { client } = makeSupabase({ rows: { inventory: stockRows } });
    signedIn(client);

    expect(await getAnalyticsSnapshot()).toEqual({ state: "error", reason: "limit" });
  });
});
