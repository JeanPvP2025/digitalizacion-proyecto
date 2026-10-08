import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ createClient: vi.fn(), exchange: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createSupabaseServerClient: mocks.createClient }));
import { GET } from "@/app/auth/callback/route";

const origin = "https://nodria-preview.example";
async function callback(params: Record<string, string>) {
  const url = new URL("/auth/callback", origin);
  url.search = new URLSearchParams(params).toString();
  const response = await GET(new NextRequest(url));
  expect(response.headers.get("cache-control")).toBe("private, no-store");
  expect(response.headers.get("referrer-policy")).toBe("no-referrer");
  const destination = new URL(response.headers.get("location")!);
  expect(destination.origin).toBe(origin);
  return { response, destination };
}

beforeEach(() => {
  vi.resetAllMocks();
  mocks.createClient.mockResolvedValue({ auth: { exchangeCodeForSession: mocks.exchange } });
  mocks.exchange.mockResolvedValue({ error: null });
});

describe("Auth callback boundary", () => {
  it("exchanges exactly once and preserves a safe path/query/hash", async () => {
    const { destination } = await callback({ code: "one-use-code", next: "/checkout?paso=2#resumen" });
    expect(destination.href).toBe(`${origin}/checkout?paso=2#resumen`);
    expect(mocks.exchange).toHaveBeenCalledExactlyOnceWith("one-use-code");
  });

  it.each(["https://evil.invalid", "//evil.invalid", "/\\evil.invalid", "javascript:alert(1)", "/\n/evil.invalid"])("rejects redirect %s", async (next) => {
    const { destination } = await callback({ code: "valid", next });
    expect(destination.pathname).toBe("/mi-cuenta");
  });

  it.each(["otp_expired", "flow_state_expired", "flow_state_not_found"])("maps %s and never propagates code/details", async (code) => {
    mocks.exchange.mockResolvedValue({ error: { code, message: "secret-email" } });
    const { destination } = await callback({ code: "private-code", next: "/checkout" });
    expect(destination.searchParams.get("motivo")).toBe("expired");
    expect(destination.searchParams.get("next")).toBe("/checkout");
    expect(destination.href).not.toMatch(/private-code|secret-email/);
  });

  it("returns failed recovery to recovery entry, without update mode", async () => {
    mocks.exchange.mockResolvedValue({ error: { code: "bad_code_verifier" } });
    const { destination } = await callback({ code: "valid", next: "/acceso?modo=actualizar" });
    expect(destination.searchParams.get("modo")).toBe("recuperar");
    expect(destination.searchParams.get("motivo")).toBe("browser");
    expect(destination.searchParams.has("next")).toBe(false);
    expect(destination.href.endsWith("#")).toBe(true);
  });

  it("keeps successful recovery on the password update page", async () => {
    const { destination } = await callback({ code: "valid", next: "/acceso?modo=actualizar" });
    expect(destination.pathname + destination.search).toBe("/acceso?modo=actualizar");
  });

  it("does not exchange absent codes or explicit provider failures", async () => {
    await callback({ next: "//evil.invalid" });
    const { destination } = await callback({ code: "ignore", error: "access_denied", error_code: "otp_expired", error_description: "private" });
    expect(destination.searchParams.get("motivo")).toBe("expired");
    expect(destination.href).not.toContain("private");
    expect(mocks.createClient).not.toHaveBeenCalled();
    expect(mocks.exchange).not.toHaveBeenCalled();
  });

  it("catches failures including client creation and missing configuration", async () => {
    mocks.createClient.mockRejectedValueOnce(new Error("private"));
    expect((await callback({ code: "valid" })).destination.searchParams.get("motivo")).toBe("service");
    mocks.createClient.mockResolvedValueOnce(null);
    expect((await callback({ code: "valid" })).destination.searchParams.get("motivo")).toBe("service");
    mocks.exchange.mockRejectedValueOnce(new Error("private"));
    expect((await callback({ code: "valid" })).destination.searchParams.get("motivo")).toBe("service");
  });
});
