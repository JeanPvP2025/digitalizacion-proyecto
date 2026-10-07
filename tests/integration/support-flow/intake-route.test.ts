import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const serverMock = vi.hoisted(() => ({ createClient: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createSupabaseServerClient: serverMock.createClient }));

type IntakeRoute = typeof import("@/app/api/support/route");
let route: IntakeRoute;
const environmentKeys = ["NODE_ENV", "DEMO_MODE", "NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"] as const;
let originalEnvironment: Record<(typeof environmentKeys)[number], string | undefined>;

function request(body: unknown) {
  return new Request("http://localhost/api/support", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("support ticket intake route", () => {
  beforeAll(() => {
    originalEnvironment = Object.fromEntries(environmentKeys.map((key) => [key, process.env[key]])) as typeof originalEnvironment;
  });

  beforeEach(async () => {
    Reflect.set(process.env, "NODE_ENV", "production");
    process.env.NEXT_PUBLIC_SUPABASE_URL = "http://127.0.0.1:56201";
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "qa-publishable-key";
    delete process.env.DEMO_MODE;
    serverMock.createClient.mockReset();
    route = await import("@/app/api/support/route");
  });

  afterAll(() => {
    for (const key of environmentKeys) {
      const value = originalEnvironment?.[key];
      if (value === undefined) Reflect.deleteProperty(process.env, key);
      else Reflect.set(process.env, key, value);
    }
  });

  it("passes a stable idempotency key to the atomic intake RPC on a retry", async () => {
    const idempotencyKey = "10000000-0000-4000-8000-00000000e301";
    const rpc = vi.fn().mockResolvedValue({
      data: [{ ticket_id: "10000000-0000-4000-8000-00000000e302", ticket_number: "TCK-2026-ABC12345" }],
      error: null,
    });
    serverMock.createClient.mockResolvedValue({
      auth: { getUser: async () => ({ data: { user: { id: "20000000-0000-4000-8000-000000000001" } }, error: null }) },
      rpc,
      from: vi.fn(),
    });
    const body = {
      subject: "Ayuda con mi pedido",
      message: "El pedido aparece entregado pero aún no ha llegado a casa.",
      orderNumber: "",
      organizationSlug: "",
      privacyAccepted: true,
      idempotencyKey,
    };

    const first = await route.POST(request(body));
    const retry = await route.POST(request(body));

    expect(first.status).toBe(201);
    expect(retry.status).toBe(201);
    expect(rpc).toHaveBeenCalledTimes(2);
    expect(rpc).toHaveBeenNthCalledWith(1, "create_support_ticket", expect.objectContaining({
      p_idempotency_key: idempotencyKey,
      p_subject: body.subject,
      p_message: body.message,
    }));
    expect(rpc.mock.calls[0]).toEqual(rpc.mock.calls[1]);
  });

  it("keeps legacy callers idempotent through the database compatibility RPC", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: [{ ticket_id: "10000000-0000-4000-8000-00000000e302", ticket_number: "TCK-2026-ABC12345" }],
      error: null,
    });
    serverMock.createClient.mockResolvedValue({
      auth: { getUser: async () => ({ data: { user: { id: "20000000-0000-4000-8000-000000000001" } }, error: null }) },
      rpc,
      from: vi.fn(),
    });
    const response = await route.POST(request({
      subject: "Ayuda con mi pedido",
      message: "El pedido aparece entregado pero aún no ha llegado a casa.",
      privacyAccepted: true,
    }));

    expect(response.status).toBe(201);
    expect(rpc).toHaveBeenCalledWith("create_support_ticket", expect.objectContaining({ p_subject: "Ayuda con mi pedido" }));
    expect(rpc.mock.calls[0][1]).not.toHaveProperty("p_idempotency_key");
  });
});
