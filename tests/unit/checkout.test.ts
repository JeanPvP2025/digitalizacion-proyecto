import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { demoProducts } from "@/lib/catalog";

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
      orderBody([{ productId: demoProducts[0]!.id, quantity: 1 }], {
        customer: { ...customer, email: "no-es-un-email" },
      }),
    );
    expect(invalidCustomer.status).toBe(400);
    expect(await demoOrders.getDemoOrderCount()).toBe(0);
  });

  it("rejects client-supplied prices instead of trusting cart data", async () => {
    const response = await post({
      ...orderBody([{ productId: demoProducts[0]!.id, quantity: 1 }]),
      items: [{ productId: demoProducts[0]!.id, quantity: 1, price: 1 }],
    });

    expect(response.status).toBe(400);
    expect(await demoOrders.getDemoOrderCount()).toBe(0);
  });

  it("rejects a real retailer reference instead of creating a fictional NODRIA order", async () => {
    const response = await post(orderBody([{ productId: demoProducts[0]!.id, quantity: 2 }]));

    expect(response.status).toBe(409);
    expect((await response.json()).error).toContain("NODRIA no lo vende");
    expect(await demoOrders.getDemoOrderRecords()).toHaveLength(0);
  });

  it("rejects quantities above current fixture stock", async () => {
    const beforeCount = await demoOrders.getDemoOrderCount();
    const response = await post(
      orderBody([{ productId: demoProducts[0]!.id, quantity: 7 }]),
    );

    expect(response.status).toBe(409);
    expect((await response.json()).error).toContain("NODRIA no lo vende");
    expect(await demoOrders.getDemoOrderCount()).toBe(beforeCount);
  });
});
