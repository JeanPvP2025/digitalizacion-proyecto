import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  dataMode: vi.fn(),
  authState: vi.fn(),
  roleGrants: vi.fn(),
  consumeRateLimit: vi.fn(),
  createProductReview: vi.fn(),
  moderateProductReview: vi.fn(),
}));

vi.mock("@/lib/server/data-mode", () => ({ getServerDataMode: mocks.dataMode }));
vi.mock("@/lib/supabase/auth", () => ({
  getServerAuthState: mocks.authState,
  getStaffRoleGrants: mocks.roleGrants,
}));
vi.mock("@/lib/server/rate-limit", () => ({ consumeRateLimit: mocks.consumeRateLimit }));
vi.mock("@/lib/reviews/data", () => ({
  createProductReview: mocks.createProductReview,
  moderateProductReview: mocks.moderateProductReview,
}));

import { POST as submitReview } from "@/app/api/reviews/route";
import { PATCH as moderateReview } from "@/app/api/reviews/[reviewId]/route";

const validReview = {
  productId: "nodria-laptop",
  orderItemId: "10000000-0000-4000-8000-000000000001",
  rating: 4,
  title: "Buena compra",
  body: "Llegó en el plazo previsto y cumple con lo que necesitaba.",
};

function jsonRequest(url: string, method: string, body: unknown) {
  return new Request(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("reviews route handlers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.dataMode.mockReturnValue("supabase");
    mocks.authState.mockResolvedValue({
      kind: "signed-in",
      user: { id: "customer-1" },
      supabase: {},
    });
    mocks.roleGrants.mockResolvedValue({ roles: ["super_admin"], error: null });
    mocks.consumeRateLimit.mockReturnValue(true);
    mocks.createProductReview.mockResolvedValue({ ok: true, reviewId: "review-1" });
    mocks.moderateProductReview.mockResolvedValue({ ok: true });
  });

  it("requires connected Supabase instead of persisting reviews in demo mode", async () => {
    mocks.dataMode.mockReturnValue("local-demo");
    const response = await submitReview(jsonRequest("http://localhost/api/reviews", "POST", validReview));
    expect(response.status).toBe(503);
    expect(mocks.createProductReview).not.toHaveBeenCalled();
  });

  it("requires the buyer session before saving a review", async () => {
    mocks.authState.mockResolvedValue({ kind: "signed-out" });
    const response = await submitReview(jsonRequest("http://localhost/api/reviews", "POST", validReview));
    expect(response.status).toBe(401);
    expect(mocks.createProductReview).not.toHaveBeenCalled();
  });

  it("persists only a validated review and returns its pending status", async () => {
    const response = await submitReview(jsonRequest("http://localhost/api/reviews", "POST", validReview));
    expect(response.status).toBe(201);
    expect(await response.json()).toMatchObject({ persisted: true, status: "pending", reviewId: "review-1" });
    expect(mocks.createProductReview).toHaveBeenCalledWith({}, validReview);
  });

  it("rejects customer-supplied author identity fields", async () => {
    const response = await submitReview(jsonRequest("http://localhost/api/reviews", "POST", { ...validReview, authorId: "another-user" }));
    expect(response.status).toBe(400);
    expect(mocks.createProductReview).not.toHaveBeenCalled();
  });

  it("blocks moderation before calling the database when the role is missing", async () => {
    mocks.roleGrants.mockResolvedValue({ roles: ["catalog_manager"], error: null });
    const response = await moderateReview(
      jsonRequest("http://localhost/api/reviews/review-1", "PATCH", { status: "published" }),
      { params: Promise.resolve({ reviewId: "10000000-0000-4000-8000-000000000001" }) },
    );
    expect(response.status).toBe(403);
    expect(mocks.moderateProductReview).not.toHaveBeenCalled();
  });

  it("allows an authorized super admin to make a final decision", async () => {
    const reviewId = "10000000-0000-4000-8000-000000000001";
    const response = await moderateReview(
      jsonRequest("http://localhost/api/reviews/" + reviewId, "PATCH", { status: "published" }),
      { params: Promise.resolve({ reviewId }) },
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ persisted: true, status: "published" });
    expect(mocks.moderateProductReview).toHaveBeenCalledWith({}, reviewId, { status: "published" });
  });
});
