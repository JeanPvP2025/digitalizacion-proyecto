import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

const supabaseMock = vi.hoisted(() => ({ createClient: vi.fn() }));
vi.mock("@supabase/supabase-js", () => ({ createClient: supabaseMock.createClient }));

const environmentKeys = [
  "NODE_ENV",
  "DEMO_MODE",
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
] as const;
const originalEnvironment = Object.fromEntries(environmentKeys.map((key) => [key, process.env[key]]));

const connectedProduct = {
  id: "db-product-814",
  slug: "connected-router-814",
  sku: "NOD-DB-814",
  name: "Router conectado 814",
  brand: "NODRIA",
  summary: "Producto leído desde PostgreSQL para la prueba de frontera.",
  description: "Descripción de prueba.",
  image_url: null,
  image_alt: "",
  badge: null,
  rating_average: 0,
  rating_count: 0,
  is_featured: false,
  is_published: true,
};

function queryResult(data: unknown, error: unknown = null) {
  return { data, error };
}

function mockSupabaseClient(results: Record<string, ReturnType<typeof queryResult>>) {
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

function connectedResults() {
  return {
    products: queryResult([connectedProduct]),
    categories: queryResult([{ id: "db-category-network", slug: "redes", name: "Redes", description: "Redes conectadas", sort_order: 10, is_active: true }]),
    product_categories: queryResult([{ product_id: connectedProduct.id, category_id: "db-category-network" }]),
    product_variants: queryResult([{ id: "db-variant-814", product_id: connectedProduct.id, sku: connectedProduct.sku, title: "Única", current_price: "814.50", compare_at_price: null, currency: "EUR", is_active: true }]),
    product_specifications: queryResult([{ product_id: connectedProduct.id, label: "Estándar", value: "Wi-Fi 7 desde DB", sort_order: 1 }]),
  };
}

function setLocalDemoMode() {
  Reflect.set(process.env, "NODE_ENV", "development");
  process.env.DEMO_MODE = "true";
  delete process.env.NEXT_PUBLIC_SUPABASE_URL;
  delete process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
}

function setSupabaseMode() {
  Reflect.set(process.env, "NODE_ENV", "production");
  process.env.DEMO_MODE = "true";
  process.env.NEXT_PUBLIC_SUPABASE_URL = "http://127.0.0.1:56201";
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "test-publishable-key";
}

function request(url: string) {
  return new Request(`http://localhost${url}`);
}

describe("catalog and search data boundaries", () => {
  beforeEach(() => {
    vi.resetModules();
    supabaseMock.createClient.mockReset();
    setLocalDemoMode();
  });

  afterAll(() => {
    for (const key of environmentKeys) {
      const value = originalEnvironment[key];
      if (value === undefined) delete process.env[key];
      else Reflect.set(process.env, key, value);
    }
  });

  it("uses fixtures only in explicit local demo mode", async () => {
    const catalogRepository = await import("@/lib/catalog-repository");
    const catalog = await catalogRepository.getCatalogData();

    expect(catalog.source).toBe("demo");
    expect(catalog.products.map(({ id }) => id)).toContain("pr_fluxbook14");
  });

  it.each([
    ["production without credentials", "production", undefined, undefined],
    ["development without explicit demo flag", "development", undefined, undefined],
    ["partial Supabase configuration", "production", "http://127.0.0.1:56201", undefined],
  ])("does not use fixtures for %s", async (_label, nodeEnv, url, key) => {
    Reflect.set(process.env, "NODE_ENV", nodeEnv);
    delete process.env.DEMO_MODE;
    if (url === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    else process.env.NEXT_PUBLIC_SUPABASE_URL = url;
    if (key === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
    else process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = key;

    const catalogRepository = await import("@/lib/catalog-repository");
    const catalog = await catalogRepository.getCatalogData();

    expect(catalog).toMatchObject({ source: "error", products: [], categories: [] });
    expect(supabaseMock.createClient).not.toHaveBeenCalled();
  });

  it("searches only the connected catalogue even when demo mode is enabled", async () => {
    setSupabaseMode();
    supabaseMock.createClient.mockReturnValue(mockSupabaseClient(connectedResults()));
    const search = await import("../../app/api/search/route");

    const response = await search.GET(request("/api/search?q=NOD-DB-814"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      source: "supabase",
      total: 1,
      results: [{ slug: connectedProduct.slug, name: connectedProduct.name, price: 814.5 }],
    });
    expect(body.results.some((product: { name: string }) => product.name === "FluxBook 14 Pro")).toBe(false);
    expect(response.headers.get("cache-control")).toBe("no-store");
  });

  it("returns a connected read error without substituting demo search results", async () => {
    setSupabaseMode();
    supabaseMock.createClient.mockReturnValue(mockSupabaseClient({
      products: queryResult(null, { message: "database unavailable" }),
    }));
    const search = await import("../../app/api/search/route");

    const response = await search.GET(request("/api/search?q=FluxBook"));
    const body = await response.json();

    expect(response.status).toBe(503);
    expect(body).toEqual({ error: "No se pudo cargar el catálogo. Inténtalo de nuevo más tarde." });
    expect(body.results).toBeUndefined();
  });
});
