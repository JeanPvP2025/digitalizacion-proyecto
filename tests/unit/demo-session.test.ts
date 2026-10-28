import { describe, expect, it, vi } from "vitest";
import {
  extractAuthorizedOrderIds,
  signDemoSession,
  verifyDemoSession,
} from "@/lib/server/demo-session";

describe("demo session authentication and order authorization", () => {
  it("signs and verifies valid demo session payloads", () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("DEMO_MODE", "true");

    const token = signDemoSession({
      orderIds: ["order-1", "order-2"],
      customerName: "Alex García",
      createdAt: Date.now(),
    });

    expect(token).toBeTruthy();
    expect(token).toContain(".");

    const verified = verifyDemoSession(token);
    expect(verified).not.toBeNull();
    expect(verified?.orderIds).toEqual(["order-1", "order-2"]);
    expect(verified?.customerName).toBe("Alex García");
    expect(extractAuthorizedOrderIds(token)).toEqual(["order-1", "order-2"]);
  });

  it("rejects forged or modified tokens", () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("DEMO_MODE", "true");

    const validToken = signDemoSession({
      orderIds: ["order-victim-id"],
      customerName: "Victim Customer",
      createdAt: Date.now(),
    });

    const [validSignature, payload] = validToken.split(".");

    // 1. Tampered signature
    const fakeSignature = "0".repeat(64);
    expect(verifyDemoSession(`${fakeSignature}.${payload}`)).toBeNull();

    // 2. Tampered payload with valid signature of another payload
    const attackerPayload = Buffer.from(
      JSON.stringify({ orderIds: ["stolen-order-id"], customerName: "Attacker", createdAt: Date.now() }),
    ).toString("base64url");
    expect(verifyDemoSession(`${validSignature}.${attackerPayload}`)).toBeNull();

    // 3. Malformed tokens
    expect(verifyDemoSession("not-a-token")).toBeNull();
    expect(verifyDemoSession("")).toBeNull();
    expect(verifyDemoSession(null)).toBeNull();
    expect(verifyDemoSession(undefined)).toBeNull();
    expect(verifyDemoSession("bad.sig.extra.dots")).toBeNull();
  });

  it("extracts empty list when cookie is absent or invalid without throwing", () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("DEMO_MODE", "true");

    expect(extractAuthorizedOrderIds(undefined)).toEqual([]);
    expect(extractAuthorizedOrderIds("tampered-token")).toEqual([]);
  });
});
