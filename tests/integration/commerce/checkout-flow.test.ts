import { randomUUID } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";

const checkoutMocks = vi.hoisted(() => ({
  createUserClient: vi.fn(),
  createPaymentAdminClient: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: checkoutMocks.createUserClient,
}));

vi.mock("@/lib/commerce/payment-admin", () => ({
  createSupabasePaymentAdminClient: checkoutMocks.createPaymentAdminClient,
  getDemoPaymentEventId: (_userId: string, _key: string, method: string) => Buffer.from(method).toString("hex").padEnd(64, "0").slice(0, 64),
  toDatabaseDemoPaymentOutcome: (method: string) => method === "declined" || method === "insufficient_funds" ? "failed" : method,
}));

type CheckoutRoute = typeof import("@/app/api/checkout/route");
type CheckoutBody = {
  items: Array<{ productId: string; quantity: number }>;
  idempotencyKey: string;
  customer: {
    name: string;
    email: string;
    phone: string;
    address: string;
    postalCode: string;
    city: string;
    province: string;
  };
  paymentMethod: "approved" | "declined" | "insufficient_funds" | "processing" | "temporary_error";
};

const customer = {
  name: "Alex García",
  email: "alex.garcia@demo.nodria.test",
  phone: "600 000 000",
  address: "Calle de la Innovación, 12",
  postalCode: "28013",
  city: "Madrid",
  province: "Madrid",
};

let checkout: CheckoutRoute;

function makeBody(overrides: Partial<CheckoutBody> = {}): CheckoutBody {
  return {
    items: [{ productId: "pr_loom27", quantity: 1 }],
    idempotencyKey: randomUUID(),
    customer,
    paymentMethod: "approved",
    ...overrides,
  };
}

function makeConnectedClients(options: { paymentResults?: Array<{ data: unknown; error: unknown }>; rejectSecondPlace?: boolean } = {}) {
  const userId = randomUUID();
  const orderId = randomUUID();
  const cartId = randomUUID();
  let orderExists = false;
  let placeCallCount = 0;
  let orderCreateCount = 0;
  let cartItems: Array<{ variant_id: string; quantity: number }> = [];
  const placeOrderArgs: Array<Record<string, unknown>> = [];
  const paymentArgs: Array<Record<string, unknown>> = [];
  const paymentResults = [...(options.paymentResults ?? [{ data: "paid", error: null }])];

  const query = (result: unknown) => {
    const value = {
      select: () => value,
      eq: () => value,
      in: () => value,
      insert: () => value,
      delete: () => value,
      upsert: (rows: Array<{ variant_id: string; quantity: number }>) => {
        cartItems = rows;
        return value;
      },
      maybeSingle: async () => ({ data: result, error: null }),
      single: async () => ({ data: { id: cartId }, error: null }),
      then: (resolve: (value: unknown) => unknown, reject?: (reason: unknown) => unknown) => Promise.resolve({ data: result, error: null }).then(resolve, reject),
    };
    return value;
  };

  const userClient = {
    auth: { getUser: async () => ({ data: { user: { id: userId } }, error: null }) },
    from: (table: string) => {
      if (table === "orders") return query(orderExists ? {
        id: orderId,
        order_number: "NOD-20261007-ABCDEF1234",
        status: "pending_payment",
        grand_total: "629.00",
        currency: "EUR",
      } : null);
      if (table === "product_variants") return query([{ id: "11111111-1111-4111-8111-111111111111", product_id: "pr_loom27" }]);
      if (table === "carts") return query(null);
      if (table === "cart_items") return query(cartItems.map(({ variant_id }) => ({ variant_id })));
      throw new Error(`Unexpected table ${table}`);
    },
    rpc: async (name: string, args: Record<string, unknown>) => {
      if (name !== "place_order_from_checkout") throw new Error(`Unexpected user RPC ${name}`);
      placeCallCount += 1;
      placeOrderArgs.push(args);
      if (options.rejectSecondPlace && placeCallCount > 1) {
        return { data: null, error: { code: "23505", message: "Checkout idempotency key was reused with a different payload" } };
      }
      if (!orderExists) {
        orderExists = true;
        orderCreateCount += 1;
      }
      return {
        data: [{ order_id: orderId, order_number: "NOD-20261007-ABCDEF1234", grand_total: "629.00", currency: "EUR" }],
        error: null,
      };
    },
  };

  const paymentAdmin = {
    rpc: async (name: string, args: Record<string, unknown>) => {
      if (name !== "resolve_demo_payment") throw new Error(`Unexpected payment RPC ${name}`);
      paymentArgs.push(args);
      return paymentResults.shift() ?? { data: "paid", error: null };
    },
  };

  return { userId, orderId, userClient, paymentAdmin, placeOrderArgs, paymentArgs, getOrderCreateCount: () => orderCreateCount };
}

function request(body: unknown) {
  return checkout.POST(new Request("http://localhost/api/checkout", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  }));
}

describe("connected Supabase checkout", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("DEMO_MODE", "false");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "http://127.0.0.1:56201");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "test-publishable-key");
    vi.stubEnv("SUPABASE_SECRET_KEY", "test-server-secret-key");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "");
    checkout = await import("@/app/api/checkout/route");
  });

  it("creates one order from server-priced data and settles an approved payment", async () => {
    const clients = makeConnectedClients();
    checkoutMocks.createUserClient.mockResolvedValue(clients.userClient);
    checkoutMocks.createPaymentAdminClient.mockReturnValue(clients.paymentAdmin);

    const response = await request(makeBody());
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body).toMatchObject({
      mode: "supabase",
      orderId: clients.orderId,
      paymentStatus: "approved",
      orderStatus: "paid",
      total: 629,
      currency: "EUR",
    });
    expect(clients.getOrderCreateCount()).toBe(1);
    expect(clients.placeOrderArgs[0]).toMatchObject({
      p_items: [{ variant_id: "11111111-1111-4111-8111-111111111111", quantity: 1 }],
      p_shipping_address: expect.objectContaining({ postalCode: "28013", countryCode: "ES" }),
      p_billing_address: expect.objectContaining({ postalCode: "28013", countryCode: "ES" }),
    });
    expect(clients.paymentArgs[0]).toMatchObject({
      p_order_id: clients.orderId,
      p_outcome: "approved",
    });
    expect(clients.paymentArgs[0].p_event_id).toMatch(/^[a-f0-9]{64}$/);
  });

  it.each([
    ["declined", "declined"],
    ["insufficient_funds", "insufficient_funds"],
  ] as const)("records %s as a failed payment and cancelled order", async (method, paymentStatus) => {
    const clients = makeConnectedClients({ paymentResults: [{ data: "failed", error: null }] });
    checkoutMocks.createUserClient.mockResolvedValue(clients.userClient);
    checkoutMocks.createPaymentAdminClient.mockReturnValue(clients.paymentAdmin);

    const response = await request(makeBody({ paymentMethod: method }));
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body).toMatchObject({ paymentStatus, orderStatus: "cancelled" });
    expect(clients.paymentArgs[0].p_outcome).toBe("failed");
  });

  it("replays the same order and payment event without creating a second order", async () => {
    const clients = makeConnectedClients();
    checkoutMocks.createUserClient.mockResolvedValue(clients.userClient);
    checkoutMocks.createPaymentAdminClient.mockReturnValue(clients.paymentAdmin);
    const body = makeBody();

    const first = await request(body);
    const retry = await request(body);

    expect(first.status).toBe(201);
    expect(retry.status).toBe(200);
    expect(clients.getOrderCreateCount()).toBe(1);
    expect(clients.paymentArgs).toHaveLength(2);
    expect(clients.paymentArgs[1].p_event_id).toBe(clients.paymentArgs[0].p_event_id);
  });

  it("rejects a changed item/address payload under the existing order key", async () => {
    const clients = makeConnectedClients({ rejectSecondPlace: true });
    checkoutMocks.createUserClient.mockResolvedValue(clients.userClient);
    checkoutMocks.createPaymentAdminClient.mockReturnValue(clients.paymentAdmin);
    const body = makeBody();

    const first = await request(body);
    const changed = await request({ ...body, customer: { ...body.customer, address: "Avenida de Otro Lugar, 42" } });

    expect(first.status).toBe(201);
    expect(changed.status).toBe(409);
    expect((await changed.json()).error).toContain("otros artículos o una dirección distinta");
    expect(clients.getOrderCreateCount()).toBe(1);
    expect(clients.paymentArgs).toHaveLength(1);
  });

  it("recovers when order creation commits but payment resolution temporarily fails", async () => {
    const clients = makeConnectedClients({
      paymentResults: [
        { data: null, error: { code: "FETCH_ERROR", message: "connection interrupted" } },
        { data: "paid", error: null },
      ],
    });
    checkoutMocks.createUserClient.mockResolvedValue(clients.userClient);
    checkoutMocks.createPaymentAdminClient.mockReturnValue(clients.paymentAdmin);
    const body = makeBody();

    const failedAttempt = await request(body);
    const retry = await request(body);

    expect(failedAttempt.status).toBe(503);
    expect(retry.status).toBe(200);
    expect((await retry.json()).orderStatus).toBe("paid");
    expect(clients.getOrderCreateCount()).toBe(1);
    expect(clients.paymentArgs[1].p_event_id).toBe(clients.paymentArgs[0].p_event_id);
  });

  it("keeps processing/error outcomes pending and allows a later outcome on the same order", async () => {
    const clients = makeConnectedClients({ paymentResults: [
      { data: "pending", error: null },
      { data: "pending", error: null },
      { data: "paid", error: null },
    ] });
    checkoutMocks.createUserClient.mockResolvedValue(clients.userClient);
    checkoutMocks.createPaymentAdminClient.mockReturnValue(clients.paymentAdmin);
    const body = makeBody({ paymentMethod: "processing" });

    const processing = await request(body);
    const temporaryError = await request({ ...body, paymentMethod: "temporary_error" });
    const approved = await request({ ...body, paymentMethod: "approved" });

    expect(processing.status).toBe(201);
    expect((await processing.json()).orderStatus).toBe("pending_payment");
    expect(temporaryError.status).toBe(503);
    expect(approved.status).toBe(200);
    expect((await approved.json()).orderStatus).toBe("paid");
    expect(clients.getOrderCreateCount()).toBe(1);
    expect(new Set(clients.paymentArgs.map((args) => args.p_event_id)).size).toBe(3);
  });

  it("does not create a pending order when the server-only key is missing", async () => {
    const clients = makeConnectedClients();
    checkoutMocks.createUserClient.mockResolvedValue(clients.userClient);
    checkoutMocks.createPaymentAdminClient.mockReturnValue(null);

    const response = await request(makeBody());

    expect(response.status).toBe(503);
    expect(clients.getOrderCreateCount()).toBe(0);
  });
});
