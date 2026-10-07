import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const createClientMock = vi.hoisted(() => vi.fn());
vi.mock("@supabase/supabase-js", () => ({ createClient: createClientMock }));

type PaymentAdminModule = typeof import("@/lib/commerce/payment-admin");
let paymentAdmin: PaymentAdminModule;

describe("server-only Supabase payment client", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://nodria.example.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "sb_publishable_test");
    vi.stubEnv("SUPABASE_SECRET_KEY", "sb_secret_test");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "legacy_service_role_test");
    paymentAdmin = await import("@/lib/commerce/payment-admin");
  });

  afterEach(() => vi.unstubAllEnvs());

  it("uses the modern server secret and disables persisted auth state", () => {
    const client = {};
    createClientMock.mockReturnValue(client);

    expect(paymentAdmin.createSupabasePaymentAdminClient()).toBe(client);
    expect(createClientMock).toHaveBeenCalledWith(
      "https://nodria.example.supabase.co",
      "sb_secret_test",
      { auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false } },
    );
  });

  it("accepts the legacy server-role variable when no modern secret is configured", () => {
    vi.stubEnv("SUPABASE_SECRET_KEY", "");
    createClientMock.mockReturnValue({});

    paymentAdmin.createSupabasePaymentAdminClient();

    expect(createClientMock).toHaveBeenCalledWith(
      "https://nodria.example.supabase.co",
      "legacy_service_role_test",
      expect.any(Object),
    );
  });

  it("refuses to create a privileged client when only public credentials are present", () => {
    vi.stubEnv("SUPABASE_SECRET_KEY", "");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "");

    expect(paymentAdmin.createSupabasePaymentAdminClient()).toBeNull();
    expect(createClientMock).not.toHaveBeenCalled();
  });

  it("derives stable, outcome-specific event IDs", () => {
    const first = paymentAdmin.getDemoPaymentEventId("customer-a", "checkout-key", "approved");

    expect(first).toMatch(/^[a-f0-9]{64}$/);
    expect(paymentAdmin.getDemoPaymentEventId("customer-a", "checkout-key", "approved")).toBe(first);
    expect(paymentAdmin.getDemoPaymentEventId("customer-a", "checkout-key", "declined")).not.toBe(first);
  });
});
