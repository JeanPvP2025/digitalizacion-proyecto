import { randomUUID } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";

const authMocks = vi.hoisted(() => ({ session: vi.fn(), role: vi.fn() }));
vi.mock("@/lib/support/auth", () => ({
  getConnectedSupportSession: authMocks.session,
  checkSupportAgentRole: authMocks.role,
}));

type ListRoute = typeof import("@/app/api/support/tickets/route");
type DetailRoute = typeof import("@/app/api/support/tickets/[ticketId]/route");
type MessageRoute = typeof import("@/app/api/support/tickets/[ticketId]/messages/route");
type ReviewRoute = typeof import("@/app/api/support/returns/[returnId]/review/route");
type QueueRoute = typeof import("@/app/api/support/returns/queue/route");
let listRoute: ListRoute;
let detailRoute: DetailRoute;
let messageRoute: MessageRoute;
let reviewRoute: ReviewRoute;
let queueRoute: QueueRoute;

function query(data: unknown, error: unknown = null) {
  const builder = {
    select: vi.fn(() => builder),
    eq: vi.fn(() => builder),
    in: vi.fn(() => builder),
    order: vi.fn(() => builder),
    limit: vi.fn(() => builder),
    maybeSingle: vi.fn(async () => ({ data, error })),
    then: (resolve: (value: { data: unknown; error: unknown }) => unknown) => Promise.resolve({ data, error }).then(resolve),
  };
  return builder;
}

function request(url: string, body?: unknown) {
  return new Request(`http://localhost${url}`, {
    method: body === undefined ? "GET" : "POST",
    headers: body === undefined ? undefined : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

function session(supabase: { from: (table: string) => unknown; rpc: ReturnType<typeof vi.fn> }) {
  authMocks.session.mockResolvedValue({
    kind: "authenticated",
    supabase,
    user: { id: "20000000-0000-4000-8000-000000000001" },
  });
}

describe("support workflow routes", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    authMocks.role.mockResolvedValue({ allowed: true, error: null });
    [listRoute, detailRoute, messageRoute, reviewRoute, queueRoute] = await Promise.all([
      import("@/app/api/support/tickets/route"),
      import("@/app/api/support/tickets/[ticketId]/route"),
      import("@/app/api/support/tickets/[ticketId]/messages/route"),
      import("@/app/api/support/returns/[returnId]/review/route"),
      import("@/app/api/support/returns/queue/route"),
    ]);
  });

  it("lists only rows visible through the authenticated RLS query", async () => {
    const ticketId = randomUUID();
    const supabase = { from: vi.fn(() => query([{
      id: ticketId, ticket_number: "TCK-2026-A1B2C3D4", subject: "Ayuda con mi pedido", status: "open",
      created_at: "2026-10-07T10:00:00.000Z", updated_at: "2026-10-07T10:00:00.000Z",
    }])), rpc: vi.fn() };
    session(supabase);

    const response = await listRoute.GET();
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ tickets: [{ id: ticketId, status: "open" }] });
    expect(response.headers.get("cache-control")).toBe("no-store");
  });

  it("does not disclose ticket existence when RLS returns no detail row", async () => {
    const from = vi.fn(() => query(null));
    session({ from, rpc: vi.fn() });

    const response = await detailRoute.GET(request("/"), { params: Promise.resolve({ ticketId: randomUUID() }) });
    expect(response.status).toBe(404);
    expect(from).toHaveBeenCalledTimes(1);
  });

  it("reuses the same request key for an idempotent agent reply and status transition", async () => {
    const ticketId = randomUUID();
    const idempotencyKey = randomUUID();
    const rpc = vi.fn().mockResolvedValue({ data: [{ message_id: randomUUID(), ticket_status: "resolved" }], error: null });
    session({ from: vi.fn(), rpc });
    const body = { body: "Hemos validado el equipo y aplicado la solución indicada.", status: "resolved", idempotencyKey };

    const first = await messageRoute.POST(request("/", body), { params: Promise.resolve({ ticketId }) });
    const retry = await messageRoute.POST(request("/", body), { params: Promise.resolve({ ticketId }) });

    expect(first.status).toBe(200);
    expect(retry.status).toBe(200);
    expect(rpc).toHaveBeenCalledTimes(2);
    expect(rpc).toHaveBeenNthCalledWith(1, "send_support_message", expect.objectContaining({
      p_ticket_id: ticketId,
      p_next_status: "resolved",
      p_idempotency_key: idempotencyKey,
    }));
    expect(rpc.mock.calls[0]).toEqual(rpc.mock.calls[1]);
  });

  it("rejects a customer status change before calling the database", async () => {
    const rpc = vi.fn();
    session({ from: vi.fn(), rpc });
    authMocks.role.mockResolvedValue({ allowed: false, error: null });
    const response = await messageRoute.POST(request("/", {
      body: "Quiero cerrar mi ticket desde el formulario del cliente.",
      status: "closed",
      idempotencyKey: randomUUID(),
    }), { params: Promise.resolve({ ticketId: randomUUID() }) });

    expect(response.status).toBe(403);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("requires a support role before approving or rejecting a return", async () => {
    const rpc = vi.fn();
    session({ from: vi.fn(), rpc });
    authMocks.role.mockResolvedValue({ allowed: false, error: null });
    const response = await reviewRoute.POST(request("/", {
      decision: "approved", idempotencyKey: randomUUID(),
    }), { params: Promise.resolve({ returnId: randomUUID() }) });

    expect(response.status).toBe(403);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("passes the explicit decision and stable retry key to the decision RPC", async () => {
    const returnId = randomUUID();
    const idempotencyKey = randomUUID();
    const rpc = vi.fn().mockResolvedValue({ data: [{
      return_request_id: returnId,
      return_status: "rejected",
      refund_amount: null,
      refund_currency: null,
      inventory_pending_inspection_quantity: 0,
      replayed: false,
    }], error: null });
    session({ from: vi.fn(), rpc });
    const body = { decision: "rejected", reason: "La solicitud no cumple las condiciones publicadas.", idempotencyKey };

    const response = await reviewRoute.POST(request("/", body), { params: Promise.resolve({ returnId }) });

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ persisted: true, id: returnId, status: "rejected" });
    expect(rpc).toHaveBeenCalledWith("review_return_request", {
      p_return_request_id: returnId,
      p_decision: "rejected",
      p_decision_reason: body.reason,
      p_idempotency_key: idempotencyKey,
    });
  });

  it("returns the simulated refund and inspection quantity after an approval", async () => {
    const returnId = randomUUID();
    const idempotencyKey = randomUUID();
    const rpc = vi.fn().mockResolvedValue({ data: [{
      return_request_id: returnId,
      return_status: "approved",
      refund_amount: "99.95",
      refund_currency: "EUR",
      inventory_pending_inspection_quantity: 2,
      replayed: true,
    }], error: null });
    session({ from: vi.fn(), rpc });

    const response = await reviewRoute.POST(request("/", {
      decision: "approved", reason: "Aprobada tras validar pedido y unidades.", idempotencyKey,
    }), { params: Promise.resolve({ returnId }) });

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      persisted: true,
      id: returnId,
      status: "approved",
      refundAmount: 99.95,
      refundCurrency: "EUR",
      pendingInspectionQuantity: 2,
      replayed: true,
    });
  });

  it("refuses the RMA review queue for non-agents", async () => {
    const from = vi.fn();
    session({ from, rpc: vi.fn() });
    authMocks.role.mockResolvedValue({ allowed: false, error: null });

    const response = await queueRoute.GET();
    expect(response.status).toBe(403);
    expect(from).not.toHaveBeenCalled();
  });
});
