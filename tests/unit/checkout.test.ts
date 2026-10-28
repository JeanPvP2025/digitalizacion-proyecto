import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { demoProducts } from "@/lib/catalog";
import { getVerifiedReferenceBuilderCatalog } from "@/lib/pc-builder/reference-catalog";
import { DEMO_SESSION_COOKIE, verifyDemoSession } from "@/lib/server/demo-session";

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

  it("creates an automatically approved internal demo order without collecting card details", async () => {
    const response = await post(orderBody([{ productId: demoProducts[0]!.id, quantity: 2 }]));
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body).toMatchObject({ mode: "demo", paymentStatus: "approved", orderStatus: "confirmed" });
    expect(body.message).toContain("no se ha realizado ningún cargo");
    const [order] = await demoOrders.getDemoOrderRecords();
    expect(order.items).toMatchObject([{ productId: demoProducts[0]!.id, quantity: 2, unitPrice: demoProducts[0]!.price }]);
    expect(order.paymentAttempt).toMatchObject({ method: "nodria_demo", status: "approved" });
  });

  it("rejects quantities above the checkout request limit", async () => {
    const beforeCount = await demoOrders.getDemoOrderCount();
    const response = await post(
      orderBody([{ productId: demoProducts[0]!.id, quantity: 11 }]),
    );

    expect(response.status).toBe(400);
    expect(await demoOrders.getDemoOrderCount()).toBe(beforeCount);
  });

  it("replays the same key and payload once, then rejects a different payload under that key", async () => {
    const key = crypto.randomUUID();
    const beforeCount = await demoOrders.getDemoOrderCount();
    const original = orderBody([{ productId: demoProducts[0]!.id, quantity: 1 }], { idempotencyKey: key });
    const first = await post(original);
    const retry = await post(original);
    const changed = await post({ ...original, items: [{ productId: demoProducts[0]!.id, quantity: 2 }] });

    expect(first.status).toBe(201);
    expect(retry.status).toBe(200);
    expect((await first.json()).orderNumber).toBe((await retry.json()).orderNumber);
    expect(changed.status).toBe(409);
    expect((await changed.json()).error).toContain("otros artículos o datos de entrega");
    expect(await demoOrders.getDemoOrderCount()).toBe(beforeCount + 1);
  });

  it("rejects client attempts to choose a non-approved payment outcome", async () => {
    const beforeCount = await demoOrders.getDemoOrderCount();
    const response = await post(orderBody([{ productId: demoProducts[0]!.id, quantity: 1 }], { paymentMethod: "declined" }));

    expect(response.status).toBe(400);
    expect(await demoOrders.getDemoOrderCount()).toBe(beforeCount);
  });

  it("rejects combining catalogue and PC builder lines for the same product when exceeding max limit", async () => {
    const targetProduct = demoProducts.find((p) => getVerifiedReferenceBuilderCatalog().components.some((c) => c.productId === p.id))!;
    const builderComp = getVerifiedReferenceBuilderCatalog().components.find((c) => c.productId === targetProduct.id)!;
    const response = await post({
      ...orderBody([]),
      items: [
        { productId: targetProduct.id, quantity: 6 },
        { variantId: builderComp.variantId, quantity: 6 },
      ],
    });

    expect(response.status).toBe(400);
    expect((await response.json()).error).toContain("No se pueden pedir más de 10 unidades");
  });

  it("consolidates catalogue and PC builder lines within limits and creates approved demo order", async () => {
    const targetProduct = demoProducts.find((p) => getVerifiedReferenceBuilderCatalog().components.some((c) => c.productId === p.id))!;
    const builderComp = getVerifiedReferenceBuilderCatalog().components.find((c) => c.productId === targetProduct.id)!;
    const response = await post({
      ...orderBody([]),
      items: [
        { productId: targetProduct.id, quantity: 2 },
        { variantId: builderComp.variantId, quantity: 3 },
      ],
    });

    expect(response.status).toBe(201);
    const body = await response.json();
    expect(body.orderStatus).toBe("confirmed");
  });

  it("sets a cryptographically signed HttpOnly demo session cookie and clears insecure cookies", async () => {
    const response = await post(orderBody([{ productId: demoProducts[0]!.id, quantity: 1 }]));
    expect(response.status).toBe(201);

    const setCookieHeaders = response.headers.getSetCookie();
    const sessionCookieHeader = setCookieHeaders.find((header) => header.startsWith(`${DEMO_SESSION_COOKIE}=`));
    expect(sessionCookieHeader).toBeDefined();
    expect(sessionCookieHeader).toContain("HttpOnly");
    expect(sessionCookieHeader?.toLowerCase()).toContain("samesite=lax");

    const tokenMatch = sessionCookieHeader!.match(new RegExp(`${DEMO_SESSION_COOKIE}=([^;]+)`));
    expect(tokenMatch).not.toBeNull();
    const token = tokenMatch![1];
    const verified = verifyDemoSession(token);
    expect(verified).not.toBeNull();
    expect(verified!.orderIds.length).toBeGreaterThan(0);

    // Verifies insecure cookies are deleted / expired
    const expiredEmail = setCookieHeaders.find((h) => h.includes("nodria_demo_email="));
    expect(expiredEmail).toBeDefined();
    expect(expiredEmail).toMatch(/Expires=Thu, 01 Jan 1970|Max-Age=0/i);
  });

  it("handles concurrent checkout requests with the same idempotency key safely", async () => {
    const key = crypto.randomUUID();
    const payload = orderBody([{ productId: demoProducts[0]!.id, quantity: 1 }], { idempotencyKey: key });

    // Simulate 5 concurrent requests fired in parallel
    const responses = await Promise.all([
      post(payload),
      post(payload),
      post(payload),
      post(payload),
      post(payload),
    ]);

    const statuses = responses.map((r) => r.status);
    expect(statuses).toContain(201); // At least one creates it
    expect(statuses.every((s) => s === 201 || s === 200)).toBe(true);

    const orderNumbers = await Promise.all(responses.map(async (r) => (await r.json()).orderNumber));
    const uniqueNumbers = new Set(orderNumbers);
    expect(uniqueNumbers.size).toBe(1); // All return the exact same order
  });

  it("handles concurrent checkout requests with different idempotency keys safely", async () => {
    const beforeCount = await demoOrders.getDemoOrderCount();
    const requests = Array.from({ length: 3 }, () =>
      post(orderBody([{ productId: demoProducts[0]!.id, quantity: 1 }])),
    );

    const responses = await Promise.all(requests);
    expect(responses.every((r) => r.status === 201)).toBe(true);

    const afterCount = await demoOrders.getDemoOrderCount();
    expect(afterCount).toBe(beforeCount + 3);
  });
});
