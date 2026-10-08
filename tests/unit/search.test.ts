import { beforeEach, describe, expect, it, vi } from "vitest";
import { demoProducts, type Product } from "@/lib/catalog";
import { addRecentSearch, parseRecentSearches, rankCatalogProducts, searchCatalogProducts } from "@/lib/search";

const repository = vi.hoisted(() => ({ getCatalogData: vi.fn() }));
vi.mock("@/lib/catalog-repository", () => repository);

function product(overrides: Partial<Product>): Product { return { ...demoProducts[0], featured: false, ...overrides }; }

// Enriched, fictional contract fixtures; never inserted into a database or imported by production.
const enriched: Product[] = [
  product({ id: "fixture-laptop", slug: "nival-portatil-14", sku: "NIV-NB14-32", name: "Nival Portátil 14", brand: "Nival", category: "Ordenadores", summary: "Portátil inalámbrico para trabajar.", specifications: [{ label: "Memoria", value: "32 GB DDR5" }, { label: "Almacenamiento", value: "1 TB SSD NVMe" }, { label: "Procesador", value: "16 núcleos" }] }),
  product({ id: "fixture-gpu", slug: "bruma-vector-5070", sku: "BRU-RTX5070-16", name: "Bruma Vector RTX5070", brand: "Bruma", category: "Componentes", summary: "Tarjeta gráfica dedicada.", specifications: [{ label: "Gráfica", value: "RTX 5070 · 16 GB" }, { label: "Memoria", value: "16 GB GDDR7" }] }),
  product({ id: "fixture-monitor", slug: "lumen-monitor-27", sku: "LUM-27-144", name: "Lumen Monitor 27", brand: "Lumen", category: "Monitores", summary: "Pantalla para creación.", specifications: [{ label: "Frecuencia", value: "144 Hz" }, { label: "Conexiones", value: "USB-C 90 W" }, { label: "Resolución", value: "4K UHD" }] }),
  product({ id: "fixture-router", slug: "nival-router-7", sku: "NIV-W7", name: "Nival Router 7", brand: "Nival", category: "Redes", summary: "Red inalámbrica.", specifications: [{ label: "Estándar", value: "Wi-Fi 7" }] }),
  product({ id: "fixture-ssd", slug: "bruma-ssd-2", sku: "BRU-SSD-2TB", name: "Bruma SSD 2 TB", brand: "Bruma", category: "Almacenamiento", summary: "Unidad de estado sólido.", specifications: [{ label: "Almacenamiento", value: "2 TB NVMe Gen 4" }] }),
];

function slugs(query: string, products = enriched) { return rankCatalogProducts(products, query).map(({ slug }) => slug); }

describe("catalog search ranking", () => {
  it("preserves the full catalog when the query is empty", () => {
    expect(rankCatalogProducts(demoProducts, "").map(({ id }) => id)).toEqual(
      demoProducts.map(({ id }) => id),
    );
  });

  it("normalizes accents and ranks exact SKU matches first", () => {
    const results = searchCatalogProducts(demoProducts, "telefonia", 8);
    expect(results.total).toBe(1);
    expect(results.results[0]?.name).toBe("Slate Air 11");

    const skuResults = searchCatalogProducts(demoProducts, "NOD-ARC-2T", 8);
    expect(skuResults.total).toBe(1);
    expect(skuResults.results[0]?.name).toBe("Arc SSD 2 TB");
  });

  it.each(["NIV-NB14-32", "nivnb1432", "NIV NB14 32"])("finds exact SKU regardless of separators: %s", (query) => {
    expect(slugs(query)).toEqual(["nival-portatil-14"]);
  });

  it("places exact SKU above a competing exact product name", () => {
    expect(slugs("NIV-NB14-32", [product({ id: "other", slug: "other", name: "NIV-NB14-32", sku: "OTHER", specifications: [], summary: "" }), enriched[0]])[0]).toBe("nival-portatil-14");
  });

  it.each([
    ["nival portatil", "nival-portatil-14"], ["NÍVAL PORTÁTIL", "nival-portatil-14"],
    ["laptop ram 32gb", "nival-portatil-14"], ["memory 32 GB", "nival-portatil-14"],
    ["processor 16 cores", "nival-portatil-14"], ["rtx 5070", "bruma-vector-5070"],
    ["graphics card", "bruma-vector-5070"], ["monitor 144hz", "lumen-monitor-27"],
    ["usb c 90w", "lumen-monitor-27"], ["wifi7", "nival-router-7"],
    ["network wifi 7", "nival-router-7"], ["solid state drive 2tb", "bruma-ssd-2"],
  ])("searches attributes and ES/EN equivalences: %s", (query, slug) => {
    expect(slugs(query)).toContain(slug);
  });

  it.each(["portatil", "porttail", "porttil", "portatill", "portatol"])("accepts a single reasonable typo: %s", (query) => {
    expect(slugs(query)).toContain("nival-portatil-14");
  });

  it("supports the last autocomplete prefix and exact brand", () => {
    expect(slugs("nival port")).toEqual(["nival-portatil-14"]);
    expect(slugs("Bruma")).toEqual(expect.arrayContaining(["bruma-vector-5070", "bruma-ssd-2"]));
  });

  it.each(["ram 33gb", "rtx 5071", "NIV-NB14-33", "porxxtil", "32gb 2tb", "nival alienware", "ram 1tb"])("preserves technical constraints and rejects wrong references: %s", (query) => {
    expect(slugs(query)).toEqual([]);
  });

  it("does not satisfy RAM capacity with a storage or GPU capacity", () => {
    const wrongCapacity = product({ ...enriched[0], id: "wrong", slug: "wrong", specifications: [{ label: "Memoria", value: "16 GB" }, { label: "Gráfica", value: "32 GB" }] });
    expect(slugs("ram 32gb", [wrongCapacity, enriched[0]])).toEqual(["nival-portatil-14"]);
  });

  it("uses deterministic ties independent of repository order, without mutating input", () => {
    const before = JSON.stringify(enriched);
    expect(slugs("nival", [...enriched].reverse())).toEqual(slugs("nival"));
    expect(JSON.stringify(enriched)).toBe(before);
  });

  it("reports totals before clamping the public result limit", () => {
    expect(searchCatalogProducts(enriched, "nival", 1)).toMatchObject({ total: 2, results: [expect.any(Object)], recovery: null });
    expect(searchCatalogProducts(demoProducts, "NODRIA", -1).results).toHaveLength(1);
    expect(searchCatalogProducts(demoProducts, "NODRIA", Number.NaN).results).toHaveLength(5);
  });

  it("returns partial alternatives and real category URLs, while keeping total zero", () => {
    const result = searchCatalogProducts(enriched, "ram 128gb", 5, [{ name: "Ordenadores", slug: "equipos-activos" }]);
    expect(result).toMatchObject({ total: 0, results: [], recovery: { reason: "partial" } });
    expect(result.recovery?.products.map(({ slug }) => slug)).toContain("nival-portatil-14");
    expect(result.recovery?.categories).toContainEqual({ name: "Ordenadores", href: "/catalogo?categoria=equipos-activos", count: 1 });
    for (const alternative of result.recovery?.products ?? []) expect(enriched.map(({ slug }) => slug)).toContain(alternative.slug);
  });

  it("suggests browsing only the supplied catalogue when every query term is unknown", () => {
    const isolated = [enriched[3]];
    expect(searchCatalogProducts(isolated, "sin coincidencias")).toMatchObject({
      total: 0, recovery: { reason: "browse", categories: [{ name: "Redes", count: 1 }], products: [{ slug: isolated[0].slug }] },
    });
    expect(searchCatalogProducts([], "laptop")).toEqual({ query: "laptop", total: 0, results: [], recovery: null });
  });

  it("bounds query work without truncating technical constraints or returning punctuation matches", () => {
    for (const query of ["x".repeat(81), Array(13).fill("ram").map((word, index) => word + index).join(" "), "---", "\u0000ram"]) {
      expect(slugs(query)).toEqual([]);
    }
  });

  it("searches an expanded 1000-product dataset with bounded output and stable totals", () => {
    const expanded = Array.from({ length: 1000 }, (_, index) => product({ ...enriched[index % enriched.length], id: "large-" + index, slug: "large-" + index }));
    const start = performance.now();
    const result = searchCatalogProducts(expanded, "laptop ram 32gb", 99);
    expect(result.total).toBe(200);
    expect(result.results).toHaveLength(8);
    // Coarse regression guard, not a production latency claim; no network is included.
    expect(performance.now() - start).toBeLessThan(2000);
  });
});

describe("search API shared ranking and failures", () => {
  beforeEach(() => repository.getCatalogData.mockReset());

  it.each(["NIV-NB14-32", "ram 32 GB", "laptop", "porttail", "no-product-xyz"])("uses the catalogue criterion and recovery for connected query %s", async (query) => {
    const categories = [{ name: "Ordenadores", slug: "ordenadores" }];
    repository.getCatalogData.mockResolvedValue({ source: "supabase", products: enriched, categories });
    const { GET } = await import("@/app/api/search/route");
    const response = await GET(new Request("http://localhost/api/search?" + new URLSearchParams({ q: query, limit: "8" })));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ...searchCatalogProducts(enriched, query, 8, categories), source: "supabase" });
    expect(response.headers.get("cache-control")).toBe("no-store");
  });

  it("fails closed on repository errors without recovery fixtures", async () => {
    repository.getCatalogData.mockResolvedValue({ source: "error", products: [], categories: [], message: "Catálogo no disponible." });
    const { GET } = await import("@/app/api/search/route");
    const response = await GET(new Request("http://localhost/api/search?q=ram"));
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ error: "Catálogo no disponible." });
  });

  it("rejects invalid limits before reading the repository", async () => {
    const { GET } = await import("@/app/api/search/route");
    const response = await GET(new Request("http://localhost/api/search?q=ram&limit=999"));
    expect(response.status).toBe(400);
    expect(repository.getCatalogData).not.toHaveBeenCalled();
  });
});

describe("recent search input safety", () => {
  it("normalizes duplicates, ignores corrupted values and control characters", () => {
    expect(parseRecentSearches('["PORTÁTIL","portatil",2,"\\u0001ram","32gb"]')).toEqual(["PORTÁTIL", "32gb"]);
    expect(parseRecentSearches("broken")).toEqual([]);
    expect(addRecentSearch("\u0001ram", ["ssd"])).toEqual(["ssd"]);
  });
});
