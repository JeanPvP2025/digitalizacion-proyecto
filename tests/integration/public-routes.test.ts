import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

const supabaseMock = vi.hoisted(() => ({ createClient: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createSupabaseServerClient: supabaseMock.createClient }));

type SearchRoute = typeof import("../../app/api/search/route");
type CheckoutRoute = typeof import("../../app/api/checkout/route");
type QuoteRoute = typeof import("../../app/api/quotes/route");
type SupportRoute = typeof import("../../app/api/support/route");

const customer = {
  name: "Alex García",
  email: "alex.garcia@demo.nodria.test",
  phone: "600 000 000",
  address: "Calle de la Innovación, 12",
  postalCode: "28013",
  city: "Madrid",
  province: "Madrid",
};

const quote = {
  companyName: "Nodria QA SL",
  contactName: "Ana Demo",
  email: "ana.demo@example.test",
  phone: "",
  volume: "1–5 equipos",
  message: "Necesitamos renovar varios equipos para nuestra oficina.",
  privacyAccepted: true,
};

const support = {
  subject: "Consulta sobre un producto",
  message: "Necesito ayuda para confirmar la compatibilidad con mi equipo actual.",
  email: "cliente.demo@example.test",
  orderNumber: "",
  privacyAccepted: true,
};

let originalWorkingDirectory: string;
let temporaryWorkingDirectory: string;
let originalEnvironment: Record<string, string | undefined>;
let search: SearchRoute;
let checkout: CheckoutRoute;
let quotes: QuoteRoute;
let supportRoute: SupportRoute;

function request(url: string, body?: unknown, forwardedFor = `qa-${randomUUID()}`) {
  return new Request(`http://localhost${url}`, {
    method: body === undefined ? "GET" : "POST",
    headers: {
      ...(body === undefined ? {} : { "content-type": "application/json" }),
      "x-forwarded-for": forwardedFor,
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}

function checkoutBody(overrides: Record<string, unknown> = {}) {
  return {
    items: [{ productId: "pr_loom27", quantity: 1 }],
    idempotencyKey: randomUUID(),
    customer,
    paymentMethod: "approved",
    ...overrides,
  };
}

function setNodeEnv(value: string) {
  Reflect.set(process.env, "NODE_ENV", value);
}

async function records<T>(name: string): Promise<T[]> {
  try {
    return JSON.parse(await readFile(join(temporaryWorkingDirectory, ".data", name), "utf8")) as T[];
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") return [];
    throw error;
  }
}

describe("public route integration", () => {
  beforeAll(async () => {
    originalWorkingDirectory = process.cwd();
    originalEnvironment = {
      NODE_ENV: process.env.NODE_ENV,
      DEMO_MODE: process.env.DEMO_MODE,
      NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    };
    temporaryWorkingDirectory = await mkdtemp(join(tmpdir(), "nodria-routes-test-"));
    process.chdir(temporaryWorkingDirectory);
    setNodeEnv("development");
    process.env.DEMO_MODE = "true";
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

    // Demo repositories resolve their local .data directory when imported.
    search = await import("../../app/api/search/route");
    checkout = await import("../../app/api/checkout/route");
    quotes = await import("../../app/api/quotes/route");
    supportRoute = await import("../../app/api/support/route");
  });

  afterAll(async () => {
    process.chdir(originalWorkingDirectory);
    for (const [key, value] of Object.entries(originalEnvironment)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    await rm(temporaryWorkingDirectory, { recursive: true, force: true });
  });

  it("validates search query multiplicity, bounds, control characters, and empty results", async () => {
    const empty = await search.GET(request("/api/search?q="));
    expect(empty.status).toBe(400);

    const missing = await search.GET(request("/api/search"));
    expect(missing.status).toBe(400);

    const duplicate = await search.GET(request("/api/search?q=arc&q=loom"));
    expect(duplicate.status).toBe(400);

    const tooLong = await search.GET(request(`/api/search?q=${"x".repeat(81)}`));
    expect(tooLong.status).toBe(400);

    const controlCharacter = await search.GET(request("/api/search?q=%01"));
    expect(controlCharacter.status).toBe(400);

    const badLimit = await search.GET(request("/api/search?q=arc&limit=9"));
    expect(badLimit.status).toBe(400);

    const zeroResults = await search.GET(request("/api/search?q=sin-coincidencias-qa"));
    expect(zeroResults.status).toBe(200);
    expect(await zeroResults.json()).toMatchObject({ query: "sin-coincidencias-qa", total: 0, results: [] });
    expect(zeroResults.headers.get("cache-control")).toBe("no-store");
  });

  it("normalizes a search query and reports exact totals before applying its limit", async () => {
    const response = await search.GET(request("/api/search?q=  NODRIA  &limit=1"));

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      query: "NODRIA",
      total: 6,
      results: [expect.objectContaining({ name: "FluxBook 14 Pro" })],
    });
  });

  it("rejects empty and invalid checkout carts before creating an order", async () => {
    const empty = await checkout.POST(request("/api/checkout", checkoutBody({ items: [] })));
    expect(empty.status).toBe(400);

    const invalidQuantity = await checkout.POST(
      request("/api/checkout", checkoutBody({ items: [{ productId: "pr_loom27", quantity: 0 }] })),
    );
    expect(invalidQuantity.status).toBe(400);

    const clientPrice = await checkout.POST(request("/api/checkout", {
      ...checkoutBody(),
      items: [{ productId: "pr_loom27", quantity: 1, price: 1 }],
    }));
    expect(clientPrice.status).toBe(400);
    expect(await records("orders.json")).toHaveLength(0);
  });

  it("makes checkout retries idempotent and persists one authoritative price snapshot", async () => {
    const body = checkoutBody();
    const ip = `checkout-retry-${randomUUID()}`;
    const first = await checkout.POST(request("/api/checkout", body, ip));
    const retry = await checkout.POST(request("/api/checkout", body, ip));
    const firstBody = await first.json();
    const retryBody = await retry.json();

    expect(first.status).toBe(201);
    expect(retry.status).toBe(200);
    expect(retryBody.orderNumber).toBe(firstBody.orderNumber);
    expect(retryBody.idempotencyKey).toBe(body.idempotencyKey);
    expect(await records<Array<unknown>>("orders.json")).toHaveLength(1);
    expect(await records<{ items: Array<{ unitPrice: number }>; total: number }>("orders.json")).toEqual([
      expect.objectContaining({ items: [expect.objectContaining({ unitPrice: 629 })], total: 629 }),
    ]);
  });

  it("rejects insufficient demo stock and enforces the checkout attempt limit", async () => {
    const stockError = await checkout.POST(request("/api/checkout", checkoutBody({
      items: [{ productId: "pr_foundry_s", quantity: 7 }],
    })));
    expect(stockError.status).toBe(409);
    expect((await stockError.json()).error).toContain("stock suficiente");

    const ip = `checkout-throttle-${randomUUID()}`;
    const statuses: number[] = [];
    for (let index = 0; index < 7; index += 1) {
      const response = await checkout.POST(request("/api/checkout", checkoutBody(), ip));
      statuses.push(response.status);
    }
    expect(statuses).toEqual([201, 201, 201, 201, 201, 201, 429]);
  });

  it("validates and persists B2B quote requests in isolated demo storage", async () => {
    const ip = `quote-valid-${randomUUID()}`;
    const response = await quotes.POST(request("/api/quotes", quote, ip));
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body).toMatchObject({ persisted: true, persistence: "local-demo" });
    expect(await records<{ companyName: string; volume: string }>("quotes.json")).toEqual([
      expect.objectContaining({ companyName: "Nodria QA SL", volume: "1–5 equipos" }),
    ]);

    const invalid = await quotes.POST(request("/api/quotes", { ...quote, privacyAccepted: false }));
    const honeypot = await quotes.POST(request("/api/quotes", { ...quote, website: "spam.example" }));
    expect(invalid.status).toBe(400);
    expect(honeypot.status).toBe(400);
    expect(await records("quotes.json")).toHaveLength(1);
  });

  it("enforces B2B quote rate limits and refuses production fallback without Supabase", async () => {
    const ip = `quote-throttle-${randomUUID()}`;
    const statuses: number[] = [];
    for (let index = 0; index < 5; index += 1) {
      statuses.push((await quotes.POST(request("/api/quotes", quote, ip))).status);
    }
    expect(statuses).toEqual([201, 201, 201, 201, 429]);

    setNodeEnv("production");
    const unavailable = await quotes.POST(request("/api/quotes", quote));
    expect(unavailable.status).toBe(503);
    expect((await unavailable.json()).persisted).toBeUndefined();
    setNodeEnv("development");
  });

  it("validates support requests, records a demo ticket, and applies its per-IP limit", async () => {
    const response = await supportRoute.POST(request("/api/support", support));
    expect(response.status).toBe(201);
    expect(await response.json()).toMatchObject({ persisted: true, mode: "demo" });
    expect(await records<{ subject: string; email: string }>("tickets.json")).toEqual([
      expect.objectContaining({ subject: support.subject, email: support.email }),
    ]);

    const invalidEmail = await supportRoute.POST(request("/api/support", { ...support, email: "no-valido" }));
    const missingConsent = await supportRoute.POST(request("/api/support", { ...support, privacyAccepted: false }));
    expect(invalidEmail.status).toBe(400);
    expect(missingConsent.status).toBe(400);
    expect(await records("tickets.json")).toHaveLength(1);

    const ip = `support-throttle-${randomUUID()}`;
    const statuses: number[] = [];
    for (let index = 0; index < 6; index += 1) {
      statuses.push((await supportRoute.POST(request("/api/support", support, ip))).status);
    }
    expect(statuses).toEqual([201, 201, 201, 201, 201, 429]);
  });

  it("requires an authenticated session for connected support and rejects unowned order references", async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "http://127.0.0.1:56201";
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "qa-publishable-key";
    setNodeEnv("production");

    const noDatabaseReads = vi.fn();
    supabaseMock.createClient.mockResolvedValueOnce({
      auth: { getUser: async () => ({ data: { user: null }, error: null }) },
      from: noDatabaseReads,
    });
    const unauthorized = await supportRoute.POST(request("/api/support", support));
    expect(unauthorized.status).toBe(401);
    expect((await unauthorized.json()).code).toBe("AUTH_REQUIRED");
    expect(noDatabaseReads).not.toHaveBeenCalled();

    const calls: string[] = [];
    const orderQuery = {
      select: () => orderQuery,
      eq: () => orderQuery,
      maybeSingle: async () => ({ data: null, error: null }),
    };
    supabaseMock.createClient.mockResolvedValueOnce({
      auth: { getUser: async () => ({ data: { user: { id: randomUUID() } }, error: null }) },
      from: (table: string) => { calls.push(table); return orderQuery; },
    });
    const unownedOrder = await supportRoute.POST(request("/api/support", {
      ...support,
      orderNumber: "NOD-20261007-1234567890",
    }));
    expect(unownedOrder.status).toBe(400);
    expect(calls).toEqual(["orders"]);

    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
    setNodeEnv("development");
  });

  it("reports a ticket separately when its first connected message fails", async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "http://127.0.0.1:56201";
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "qa-publishable-key";
    setNodeEnv("production");

    const calls: string[] = [];
    const ticketQuery = {
      insert: () => ticketQuery,
      select: () => ticketQuery,
      single: async () => ({ data: { id: randomUUID(), ticket_number: "SUP-20261007-QA000001" }, error: null }),
    };
    const messageQuery = {
      insert: () => messageQuery,
      select: () => messageQuery,
      single: async () => ({ data: null, error: { code: "42501" } }),
    };
    supabaseMock.createClient.mockResolvedValueOnce({
      auth: { getUser: async () => ({ data: { user: { id: randomUUID() } }, error: null }) },
      from: (table: string) => { calls.push(table); return table === "support_tickets" ? ticketQuery : messageQuery; },
    });

    const response = await supportRoute.POST(request("/api/support", support));
    expect(response.status).toBe(502);
    expect(await response.json()).toMatchObject({
      code: "INITIAL_MESSAGE_NOT_CONFIRMED",
      ticketNumber: "SUP-20261007-QA000001",
    });
    expect(calls).toEqual(["support_tickets", "support_messages"]);

    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
    setNodeEnv("development");
  });

  it("does not enable local support or checkout persistence in production", async () => {
    setNodeEnv("production");
    const noDemoCheckout = await checkout.POST(request("/api/checkout", checkoutBody()));
    const noDemoSupport = await supportRoute.POST(request("/api/support", support));
    expect(noDemoCheckout.status).toBe(503);
    expect(noDemoSupport.status).toBe(503);
    expect(await records("orders.json")).toHaveLength(7);
    expect(await records("tickets.json")).toHaveLength(6);
    setNodeEnv("development");
  });
});
