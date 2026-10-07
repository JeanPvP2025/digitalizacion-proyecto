import { afterEach, describe, expect, it, vi } from "vitest";
import { resolveServerDataMode } from "@/lib/supabase/config";
import { getSafeRedirectPath } from "@/lib/supabase/redirects";
import { hasStaffSurfaceRole } from "@/lib/supabase/policies";
import { getServerAuthState } from "@/lib/supabase/auth";
import { getDemoOrderRecords, persistDemoOrder } from "@/lib/server/demo-orders";
import { saveDemoQuoteInquiry } from "@/lib/server/demo-inbox";

afterEach(() => vi.unstubAllEnvs());

describe("server data mode", () => {
  it("selects local files only for explicit development demo mode without Supabase credentials", () => {
    expect(resolveServerDataMode({ nodeEnv: "development", demoMode: "true" })).toBe("local-demo");
    expect(resolveServerDataMode({ nodeEnv: "development", demoMode: "false" })).toBe("unavailable");
    expect(resolveServerDataMode({ nodeEnv: "test", demoMode: "true" })).toBe("unavailable");
  });

  it("prefers complete Supabase configuration and rejects partial configuration without fallback", () => {
    expect(resolveServerDataMode({
      nodeEnv: "development",
      demoMode: "true",
      supabaseUrl: " https://project.example ",
      publishableKey: " sb_publishable_test ",
    })).toBe("supabase");
    expect(resolveServerDataMode({ nodeEnv: "development", demoMode: "true", supabaseUrl: "https://project.example" })).toBe("unavailable");
    expect(resolveServerDataMode({ nodeEnv: "production", demoMode: "true" })).toBe("unavailable");
    expect(resolveServerDataMode({ nodeEnv: "production", supabaseUrl: "https://project.example", publishableKey: "sb_publishable_test" })).toBe("supabase");
  });

  it("blocks direct .data reads and writes outside local demo mode", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("DEMO_MODE", "true");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "");

    await expect(getDemoOrderRecords()).rejects.toThrow(/only in explicit local development mode/);
    await expect(persistDemoOrder({} as never)).rejects.toThrow(/only in explicit local development mode/);
    await expect(saveDemoQuoteInquiry({} as never)).rejects.toThrow(/only in explicit local development mode/);
  });

  it("does not turn missing production credentials into a demo customer session", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("DEMO_MODE", "true");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "");

    await expect(getServerAuthState()).resolves.toEqual({ kind: "signed-out" });
  });
});

describe("server authorization policies", () => {
  it("allows only the roles assigned to each staff surface", () => {
    expect(hasStaffSurfaceRole(["sales_manager"], "backoffice")).toBe(true);
    expect(hasStaffSurfaceRole(["fulfillment_manager"], "backoffice")).toBe(true);
    expect(hasStaffSurfaceRole(["sales_manager"], "crm")).toBe(true);
    expect(hasStaffSurfaceRole(["fulfillment_manager"], "crm")).toBe(false);
    expect(hasStaffSurfaceRole(["fulfillment_manager"], "inventory")).toBe(true);
    expect(hasStaffSurfaceRole(["sales_manager"], "inventory")).toBe(false);
    expect(hasStaffSurfaceRole(["super_admin"], "operations")).toBe(true);
    expect(hasStaffSurfaceRole(["support_agent"], "operations")).toBe(false);
  });

  it("keeps Auth redirects path-relative and rejects external or malformed destinations", () => {
    expect(getSafeRedirectPath("/backoffice/crm?q=pc#inbox")).toBe("/backoffice/crm?q=pc#inbox");
    expect(getSafeRedirectPath("//attacker.example/path")).toBe("/mi-cuenta");
    expect(getSafeRedirectPath("https://attacker.example/path")).toBe("/mi-cuenta");
    expect(getSafeRedirectPath("/\\attacker.example/path")).toBe("/mi-cuenta");
  });
});
