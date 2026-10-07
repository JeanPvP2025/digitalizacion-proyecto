import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { DemoOrderRecord } from "../../lib/server/demo-orders";

type CheckoutRoute = typeof import("../../app/api/checkout/route");
type DemoOrders = typeof import("../../lib/server/demo-orders");

const customer = {
  name: "Alex García",
  email: "alex.garcia@demo.nodria.test",
  phone: "600 000 000",
  address: "Calle de la Innovación, 12",
  postalCode: "28013",
  city: "Madrid",
  province: "Madrid",
};

let originalWorkingDirectory: string;
let originalDemoMode: string | undefined;
let temporaryWorkingDirectory: string;
let checkout: CheckoutRoute;
let demoOrders: DemoOrders;
let requestSequence = 0;

function orderBody(
  items: Array<{ productId: string; quantity: number }>,
  overrides: Record<string, unknown> = {},
) {
  return {
    items,
    idempotencyKey: crypto.randomUUID(),
    customer,
    paymentMethod: "approved",
    ...overrides,
  };
}

function post(body: unknown, rawBody?: string) {
  requestSequence += 1;
  return checkout.POST(
    new Request("http://localhost/api/checkout", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-forwarded-for": `vitest-${requestSequence}`,
      },
      body: rawBody ?? JSON.stringify(body),
    }),
  );
}

describe("demo checkout route", () => {
  beforeAll(async () => {
    originalWorkingDirectory = process.cwd();
    originalDemoMode = process.env.DEMO_MODE;
    temporaryWorkingDirectory = await mkdtemp(join(tmpdir(), "nodria-checkout-test-"));
    process.chdir(temporaryWorkingDirectory);
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "");
    process.env.DEMO_MODE = "true";

    checkout = await import("../../app/api/checkout/route");
    demoOrders = await import("../../lib/server/demo-orders");
  });

  afterAll(async () => {
    process.chdir(originalWorkingDirectory);
    vi.unstubAllEnvs();
    if (originalDemoMode === undefined) delete process.env.DEMO_MODE;
    else process.env.DEMO_MODE = originalDemoMode;
    await rm(temporaryWorkingDirectory, { recursive: true, force: true });
  });

  it("rejects malformed JSON and invalid customer input without writing an order", async () => {
    const malformed = await post({}, "not-json");
    expect(malformed.status).toBe(400);
    expect((await malformed.json()).error).toContain("JSON válido");

    const invalidCustomer = await post(
      orderBody([{ productId: "pr_loom27", quantity: 1 }], {
        customer: { ...customer, email: "no-es-un-email" },
      }),
    );
    expect(invalidCustomer.status).toBe(400);
    expect(await demoOrders.getDemoOrderCount()).toBe(0);
  });

  it("rejects client-supplied prices instead of trusting cart data", async () => {
    const response = await post({
      ...orderBody([{ productId: "pr_loom27", quantity: 1 }]),
      items: [{ productId: "pr_loom27", quantity: 1, price: 1 }],
    });

    expect(response.status).toBe(400);
    expect(await demoOrders.getDemoOrderCount()).toBe(0);
  });

  it("re-reads fixture prices and persists a server-calculated order snapshot", async () => {
    const response = await post(
      orderBody([{ productId: "pr_loom27", quantity: 2 }]),
    );

    expect(response.status).toBe(201);
    const responseBody = await response.json();
    expect(responseBody.paymentStatus).toBe("approved");
    expect(responseBody.orderStatus).toBe("confirmed");

    const records = await demoOrders.getDemoOrderRecords();
    expect(records).toHaveLength(1);
    const [record] = records as DemoOrderRecord[];
    expect(record.items).toEqual([
      expect.objectContaining({
        productId: "pr_loom27",
        name: "Loom 27 4K",
        sku: "NOD-LM27-4K",
        quantity: 2,
        unitPrice: 629,
        lineTotal: 1258,
        source: "catalogue",
      }),
    ]);
    expect(record.subtotal).toBe(1258);
    expect(record.shipping).toBe(0);
    expect(record.tax).toBe(218.33);
    expect(record.total).toBe(1258);
    expect(record.timeline.map((event) => event.event)).toEqual([
      "order_created",
      "payment_approved",
    ]);

    const persisted = JSON.parse(
      await readFile(join(temporaryWorkingDirectory, ".data", "orders.json"), "utf8"),
    ) as DemoOrderRecord[];
    expect(persisted[0]).toEqual(record);
  });

  it("rejects quantities above current fixture stock", async () => {
    const beforeCount = await demoOrders.getDemoOrderCount();
    const response = await post(
      orderBody([{ productId: "pr_foundry_s", quantity: 7 }]),
    );

    expect(response.status).toBe(409);
    expect((await response.json()).error).toContain("stock suficiente");
    expect(await demoOrders.getDemoOrderCount()).toBe(beforeCount);
  });
});
