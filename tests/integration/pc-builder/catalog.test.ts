import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

const supabaseMock = vi.hoisted(() => ({ createClient: vi.fn() }));
vi.mock("@supabase/supabase-js", () => ({ createClient: supabaseMock.createClient }));

const environmentKeys = ["NODE_ENV", "DEMO_MODE", "NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"] as const;
const originalEnvironment = Object.fromEntries(environmentKeys.map((key) => [key, process.env[key]]));

function queryResult(data: unknown, error: unknown = null) {
  return { data, error };
}

function mockClient(results: Record<string, ReturnType<typeof queryResult>>) {
  return {
    from: vi.fn((table: string) => {
      const result = results[table] ?? queryResult([]);
      const query = {
        select: vi.fn(() => query),
        eq: vi.fn(() => query),
        order: vi.fn(() => query),
        in: vi.fn(() => query),
        then: (resolve: (value: unknown) => unknown, reject: (reason: unknown) => unknown) => Promise.resolve(result).then(resolve, reject),
      };
      return query;
    }),
  };
}

function setDemoMode() {
  Reflect.set(process.env, "NODE_ENV", "development");
  process.env.DEMO_MODE = "true";
  delete process.env.NEXT_PUBLIC_SUPABASE_URL;
  delete process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
}

function setSupabaseMode() {
  Reflect.set(process.env, "NODE_ENV", "production");
  delete process.env.DEMO_MODE;
  process.env.NEXT_PUBLIC_SUPABASE_URL = "http://127.0.0.1:56201";
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "test-publishable-key";
}

function catalogueResults() {
  return {
    products: queryResult([{ id: "pr_cpu", slug: "cpu-a", name: "CPU A", brand: "NODRIA", summary: "CPU de prueba", is_published: true }]),
    categories: queryResult([{ id: "cat-components", slug: "componentes", is_active: true }]),
    product_categories: queryResult([{ product_id: "pr_cpu", category_id: "cat-components" }]),
    product_variants: queryResult([{
      id: "00000000-0000-4000-8000-000000000001", product_id: "pr_cpu", sku: "NOD-CPU-A", title: "Única",
      attributes: { pc_builder: { category: "cpu", socket: "AM5", memory_generations: ["DDR5"], estimated_power_w: 65, integrated_graphics: true } },
      current_price: "199.00", currency: "EUR", is_active: true,
    }]),
  };
}

describe("PC Builder catalogue loading boundary", () => {
  beforeEach(() => {
    vi.resetModules();
    supabaseMock.createClient.mockReset();
    setDemoMode();
  });

  afterAll(() => {
    for (const key of environmentKeys) {
      const value = originalEnvironment[key];
      if (value === undefined) delete process.env[key];
      else Reflect.set(process.env, key, value);
    }
  });

  it("does not expose fictional parts as purchasable in local demo mode", async () => {
    const { getPcBuilderCatalog } = await import("@/lib/pc-builder/catalog");
    await expect(getPcBuilderCatalog()).resolves.toEqual({ source: "demo", components: [], omittedVariants: 0 });
    expect(supabaseMock.createClient).not.toHaveBeenCalled();
  });

  it("loads sellable options by real variant ID from the public catalogue", async () => {
    setSupabaseMode();
    supabaseMock.createClient.mockReturnValue(mockClient(catalogueResults()));
    const { getPcBuilderCatalog } = await import("@/lib/pc-builder/catalog");
    const result = await getPcBuilderCatalog();
    expect(result.source).toBe("supabase");
    if (result.source !== "supabase") throw new Error("Expected the connected catalogue.");
    expect(result.components).toHaveLength(1);
    expect(result.components[0]).toMatchObject({ variantId: "00000000-0000-4000-8000-000000000001", productId: "pr_cpu", priceEur: 199 });
    expect(supabaseMock.createClient).toHaveBeenCalledWith("http://127.0.0.1:56201", "test-publishable-key", expect.any(Object));
  });

  it("returns an explicit error instead of substituting demo fixtures when the connected catalogue fails", async () => {
    setSupabaseMode();
    supabaseMock.createClient.mockReturnValue(mockClient({ products: queryResult(null, { message: "database unavailable" }) }));
    const { getPcBuilderCatalog } = await import("@/lib/pc-builder/catalog");
    await expect(getPcBuilderCatalog()).resolves.toMatchObject({ source: "error", components: [] });
  });
});

