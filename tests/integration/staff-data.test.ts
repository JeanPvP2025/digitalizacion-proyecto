import { beforeEach, describe, expect, it, vi } from "vitest";

const supabaseMock = vi.hoisted(() => ({ createClient: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createSupabaseServerClient: supabaseMock.createClient }));

import { getCrmWorkspace } from "@/lib/crm/data";
import { getInventorySnapshot } from "@/lib/inventory";

type QueryResult = { data: unknown; error: { code?: string } | null };
type ClientOptions = {
  user?: { id: string; email?: string } | null;
  authError?: { message: string } | null;
  results?: Record<string, QueryResult>;
  calls?: Array<{ table: string; methods: Array<[string, ...unknown[]]> }>;
};

const user = { id: "10000000-0000-4000-8000-000000000001", email: "staff@nodria.example" };

function makeClient(options: ClientOptions = {}) {
  const calls = options.calls ?? [];
  const client = {
    auth: {
      getUser: vi.fn(async () => ({ data: { user: options.user === undefined ? user : options.user }, error: options.authError ?? null })),
    },
    from(table: string) {
      const query = {
        table,
        methods: [] as Array<[string, ...unknown[]]>,
        record(name: string, ...args: unknown[]) { this.methods.push([name, ...args]); return this; },
        select(columns: string) { return this.record("select", columns); },
        eq(column: string, value: unknown) { return this.record("eq", column, value); },
        in(column: string, values: unknown[]) { return this.record("in", column, values); },
        order(column: string, options: unknown) { return this.record("order", column, options); },
        limit(count: number) { return this.record("limit", count); },
        returns() { return this; },
        result() { return options.results?.[table] ?? { data: [], error: null }; },
        then(resolve: (value: QueryResult) => unknown, reject?: (reason: unknown) => unknown) {
          return Promise.resolve(this.result()).then(resolve, reject);
        },
      };
      calls.push({ table, methods: query.methods });
      return query;
    },
  };
  return { client, calls };
}

function successfulResults(role: string, data: Record<string, unknown[]> = {}) {
  return {
    user_role_grants: { data: [{ role }], error: null },
    quote_inquiries: { data: [], error: null },
    crm_leads: { data: [], error: null },
    organizations: { data: [], error: null },
    inventory: { data: [], error: null },
    product_variants: { data: [], error: null },
    products: { data: [], error: null },
    ...Object.fromEntries(Object.entries(data).map(([table, rows]) => [table, { data: rows, error: null }])),
  } satisfies Record<string, QueryResult>;
}

beforeEach(() => {
  supabaseMock.createClient.mockReset();
});

describe("CRM access and workspace integration", () => {
  it("distinguishes missing configuration and signed-out sessions", async () => {
    supabaseMock.createClient.mockResolvedValueOnce(null);
    expect(await getCrmWorkspace()).toEqual({ state: "unconfigured" });

    const { client } = makeClient({ user: null });
    supabaseMock.createClient.mockResolvedValueOnce(client);
    expect(await getCrmWorkspace()).toEqual({ state: "unauthenticated" });
  });

  it("does not query CRM records for users without a sales role", async () => {
    const calls: ClientOptions["calls"] = [];
    const { client } = makeClient({
      results: { user_role_grants: { data: [{ role: "fulfillment_manager" }], error: null } },
      calls,
    });
    supabaseMock.createClient.mockResolvedValueOnce(client);

    expect(await getCrmWorkspace()).toEqual({ state: "forbidden" });
    expect(calls?.map(({ table }) => table)).toEqual(["user_role_grants"]);
  });

  it("returns explicit errors when role or CRM reads fail", async () => {
    const roleFailure = makeClient({ results: { user_role_grants: { data: null, error: { code: "42501" } } } });
    supabaseMock.createClient.mockResolvedValueOnce(roleFailure.client);
    expect(await getCrmWorkspace()).toEqual({ state: "error" });

    const inquiryFailure = makeClient({
      results: {
        ...successfulResults("sales_manager"),
        quote_inquiries: { data: null, error: { code: "XX000" } },
      },
    });
    supabaseMock.createClient.mockResolvedValueOnce(inquiryFailure.client);
    expect(await getCrmWorkspace()).toEqual({ state: "error" });
  });

  it("treats empty CRM tables as a valid empty workspace", async () => {
    const { client } = makeClient({ results: successfulResults("sales_manager") });
    supabaseMock.createClient.mockResolvedValueOnce(client);

    expect(await getCrmWorkspace()).toMatchObject({
      state: "ready",
      opportunities: [],
      contacts: [],
      organizations: [],
      activities: [],
    });
  });

  it("merges contacts by normalized email and orders opportunities and activity", async () => {
    const { client } = makeClient({
      results: successfulResults("super_admin", {
        quote_inquiries: [{
          id: "20000000-0000-4000-8000-000000000001",
          contact_name: "Ana Martín",
          email: "ana@example.test",
          phone: null,
          company: "Prisma",
          message: "Solicitud de equipos para el estudio.",
          status: "new",
          source: "b2b-form",
          created_at: "2026-10-06T10:00:00.000Z",
          updated_at: "2026-10-06T10:00:00.000Z",
        }],
        crm_leads: [{
          id: "30000000-0000-4000-8000-000000000001",
          contact_name: "Ana M.",
          email: "ANA@example.test",
          phone: "+34 600 000 000",
          company: "Prisma",
          source: "contact-form",
          created_at: "2026-10-07T10:00:00.000Z",
        }],
        organizations: [{
          id: "40000000-0000-4000-8000-000000000001",
          slug: "estudio-prisma",
          legal_name: "Estudio Prisma SL",
          display_name: "Prisma",
          billing_email: "compras@prisma.example",
          is_active: true,
          created_at: "2026-10-05T10:00:00.000Z",
        }],
      }),
    });
    supabaseMock.createClient.mockResolvedValueOnce(client);

    const workspace = await getCrmWorkspace();
    expect(workspace.state).toBe("ready");
    if (workspace.state !== "ready") throw new Error("Expected a ready CRM workspace.");
    expect(workspace.opportunities[0]?.status).toBe("new");
    expect(workspace.contacts).toEqual([expect.objectContaining({
      key: "ana@example.test",
      name: "Ana M.",
      sources: ["lead", "quote-inquiry"],
    })]);
    expect(workspace.organizations[0]).toMatchObject({ name: "Prisma", active: true });
    expect(workspace.activities[0]?.kind).toBe("lead");
  });
});

describe("protected inventory snapshot integration", () => {
  it("distinguishes unconfigured and unauthenticated access", async () => {
    supabaseMock.createClient.mockResolvedValueOnce(null);
    expect(await getInventorySnapshot()).toEqual({ status: "not_configured" });

    const { client } = makeClient({ user: null });
    supabaseMock.createClient.mockResolvedValueOnce(client);
    expect(await getInventorySnapshot()).toEqual({ status: "unauthenticated" });
  });

  it("checks a fulfillment role before reading inventory and handles grant errors", async () => {
    const deniedCalls: ClientOptions["calls"] = [];
    const denied = makeClient({
      results: { user_role_grants: { data: [{ role: "sales_manager" }], error: null } },
      calls: deniedCalls,
    });
    supabaseMock.createClient.mockResolvedValueOnce(denied.client);
    expect(await getInventorySnapshot()).toEqual({ status: "forbidden" });
    expect(deniedCalls?.map(({ table }) => table)).toEqual(["user_role_grants"]);

    const failing = makeClient({ results: { user_role_grants: { data: null, error: { code: "XX000" } } } });
    supabaseMock.createClient.mockResolvedValueOnce(failing.client);
    expect(await getInventorySnapshot()).toEqual({ status: "error" });
  });

  it("returns a valid empty snapshot and surfaces inventory query failures", async () => {
    const empty = makeClient({ results: successfulResults("fulfillment_manager") });
    supabaseMock.createClient.mockResolvedValueOnce(empty.client);
    expect(await getInventorySnapshot()).toEqual({
      status: "ready",
      rows: [],
      isLimited: false,
      variantDetailsLimited: false,
    });

    const failure = makeClient({
      results: {
        ...successfulResults("fulfillment_manager"),
        inventory: { data: null, error: { code: "XX000" } },
      },
    });
    supabaseMock.createClient.mockResolvedValueOnce(failure.client);
    expect(await getInventorySnapshot()).toEqual({ status: "error" });
  });

  it("derives available stock and degrades safely when catalogue details are hidden", async () => {
    const { client } = makeClient({
      results: {
        ...successfulResults("fulfillment_manager", {
          inventory: [{
            warehouse_id: "50000000-0000-4000-8000-000000000001",
            variant_id: "60000000-0000-4000-8000-000000000001",
            on_hand: 8,
            reserved: 3,
            updated_at: "2026-10-07T09:00:00.000Z",
            warehouse: { code: "MAD-CENTRAL", name: "Madrid", city: "Madrid" },
          }],
        }),
        product_variants: { data: null, error: { code: "42501" } },
      },
    });
    supabaseMock.createClient.mockResolvedValueOnce(client);

    expect(await getInventorySnapshot()).toEqual({
      status: "ready",
      rows: [expect.objectContaining({
        warehouseCode: "MAD-CENTRAL",
        onHand: 8,
        reserved: 3,
        available: 5,
        sku: null,
        productName: null,
      })],
      isLimited: false,
      variantDetailsLimited: true,
    });
  });
});
