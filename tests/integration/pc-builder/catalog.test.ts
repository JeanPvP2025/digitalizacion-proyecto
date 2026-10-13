import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { demoProducts } from "@/lib/catalog";

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
  const reference = demoProducts[0]!;
  return {
    products: queryResult([{
      id: reference.id, slug: reference.slug, name: reference.name, brand: reference.brand,
      summary: reference.summary, image_url: reference.image, image_alt: reference.imageAlt, is_published: true,
    }]),
    categories: queryResult([{ id: "cat-components", slug: "componentes", is_active: true }]),
    product_categories: queryResult([{ product_id: reference.id, category_id: "cat-components" }]),
    product_variants: queryResult([{
      id: "00000000-0000-4000-8000-000000000001", product_id: reference.id, sku: reference.sku, title: "Referencia PcComponentes",
      attributes: {
        pc_builder: { category: "cpu", socket: "AM5", memory_generations: ["DDR5"], estimated_power_w: 65, integrated_graphics: true },
        reference_price: {
          source: "PcComponentes", seller: "PcComponentes", url: reference.priceReference!.productUrl,
          observed_at: reference.priceReference!.checkedAt, price_eur: reference.price, image_url: reference.image,
          mpn: reference.modelNumber,
        },
      },
      current_price: reference.price.toFixed(2), currency: "EUR", is_active: true,
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

  it("loads the verified model/photo/price references in local demo mode without making them sellable", async () => {
    const { getPcBuilderCatalog } = await import("@/lib/pc-builder/catalog");
    const result = await getPcBuilderCatalog();
    expect(result.source).toBe("demo");
    expect(result.components).toHaveLength(64);
    expect(result.omittedVariants).toBe(0);
    expect(new Set(result.components.map(({ category }) => category)).size).toBe(8);
    expect(result.components.every((component) => component.productUrl?.startsWith("https://www.pccomponentes.com/") &&
      /^https:\/\/(img|thumb)\.pccomponentes\.com\//.test(component.imageUrl ?? "") && component.checkedAt === "2026-10-13" &&
      component.priceEur > 0 && component.modelNumber)).toBe(true);
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
    expect(result.components[0]).toMatchObject({ variantId: "00000000-0000-4000-8000-000000000001", productId: demoProducts[0]!.id, priceEur: demoProducts[0]!.price });
    expect(supabaseMock.createClient).toHaveBeenCalledWith("http://127.0.0.1:56201", "test-publishable-key", expect.any(Object));
  });

  it("returns an explicit error instead of substituting demo fixtures when the connected catalogue fails", async () => {
    setSupabaseMode();
    supabaseMock.createClient.mockReturnValue(mockClient({ products: queryResult(null, { message: "database unavailable" }) }));
    const { getPcBuilderCatalog } = await import("@/lib/pc-builder/catalog");
    await expect(getPcBuilderCatalog()).resolves.toMatchObject({ source: "error", components: [] });
  });
});

