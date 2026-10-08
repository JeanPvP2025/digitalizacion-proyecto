import { describe, expect, it } from "vitest";
import type { Product, ProductCategory } from "@/lib/catalog";
import type { CatalogData } from "@/lib/catalog-mapping";
import { getHomepageMerchandising, productHref } from "@/lib/content/merchandising";

function product(id: string, category: ProductCategory = "Ordenadores", options: Partial<Product> = {}): Product {
  return {
    id, slug: `ficha-${id}`, sku: `TEST-${id}`, name: `Equipo ${id}`, category,
    brand: "Marca ficticia", price: 125, rating: 0, reviewCount: 0, stock: 0,
    image: "", imageAlt: "", summary: "Ficha ficticia", specifications: [], ...options,
  };
}

function catalog(products: Product[]): CatalogData {
  return {
    source: "supabase", products,
    categories: ["Ordenadores", "Monitores", "Redes", "Almacenamiento", "Telefonía", "Componentes"].map((name, index) => ({
      id: `category-${index}`, name: name as ProductCategory,
      slug: `category-${index}`, description: "Categoría ficticia", sortOrder: index,
    })),
  };
}

function placements(result: ReturnType<typeof getHomepageMerchandising>) {
  return [...(result.hero ? [result.hero] : []), ...result.featured, ...(result.campaign?.products ?? []), ...result.discoveries];
}

describe("homepage merchandising rules", () => {
  it("keeps identities and destinations unique across hero, featured, campaign and discoveries", () => {
    const products = [
      product("a", "Ordenadores", { featured: true }),
      product("b", "Monitores", { featured: true }),
      product("c", "Ordenadores"), product("d", "Monitores"), product("e", "Redes"),
      product("f", "Almacenamiento"), product("g", "Telefonía"), product("h", "Componentes"),
    ];
    const result = getHomepageMerchandising(catalog([...products, products[0], product("other-id", "Ordenadores", { slug: products[0].slug })]));
    const selected = placements(result);
    expect(result.totalProducts).toBe(8);
    expect(new Set(selected.map(({ id }) => id)).size).toBe(selected.length);
    expect(new Set(selected.map(productHref)).size).toBe(selected.length);
    expect(result.featured.map(({ id }) => id)).toEqual(["b"]);
    expect(result.campaign?.products.map(({ id }) => id)).toEqual(["c", "d", "e"]);
    expect(result.discoveries.map(({ id }) => id)).toEqual(["f", "g", "h"]);
  });

  it("is deterministic despite repository order and does not mutate its input", () => {
    const data = catalog([product("z"), product("a", "Redes"), product("c", "Telefonía"), product("b", "Monitores")]);
    if (data.source === "error") throw new Error("Fixture catalog must be available");
    const snapshot = structuredClone(data);
    const result = getHomepageMerchandising(data);
    expect(getHomepageMerchandising({ ...data, products: [...data.products].reverse(), categories: [...data.categories].reverse() })).toEqual(result);
    expect(data).toEqual(snapshot);
  });

  it("prefers an explicitly featured hero with an image and does not promote ordinary products as featured", () => {
    const result = getHomepageMerchandising(catalog([
      product("a", "Ordenadores", { featured: true }),
      product("z", "Redes", { featured: true, image: "https://example.test/photo.png" }),
      product("b"),
    ]));
    expect(result.hero?.id).toBe("z");
    expect(result.featured.map(({ id }) => id)).toEqual(["a"]);
    expect(getHomepageMerchandising(catalog([product("a"), product("b")])).featured).toEqual([]);
  });

  it("keeps explicit novelty badges for discoveries and does not infer recency from a price or ID", () => {
    const result = getHomepageMerchandising(catalog([
      product("a", "Ordenadores", { featured: true }),
      product("b", "Redes", { badge: "Novedad" }),
      product("c", "Redes", { badge: "Nuevo" }),
      product("d", "Monitores"), product("e", "Telefonía"),
    ]));
    expect(result.hasExplicitNovelties).toBe(true);
    expect(result.discoveries.map(({ id }) => id)).toEqual(["b", "e", "c"]);
    expect(result.campaign?.products.map(({ id }) => id)).toEqual(["d"]);
    expect(getHomepageMerchandising(catalog([product("20261008", "Redes", { previousPrice: 250 })])).hasExplicitNovelties).toBe(false);
  });

  it("shows populated source categories with exact counts and encoded valid filter destinations", () => {
    const data = catalog([product("a"), product("b"), product("c", "Redes")]);
    data.categories[0].slug = "ordenadores / prueba";
    const result = getHomepageMerchandising(data);
    expect(result.categories.map(({ name, count }) => ({ name, count }))).toEqual([
      { name: "Ordenadores", count: 2 }, { name: "Redes", count: 1 },
    ]);
    expect(result.categories[0].href).toBe("/catalogo?categoria=ordenadores%20%2F%20prueba");
    expect(productHref(product("a", "Redes", { slug: "equipo / A" }))).toBe("/producto/equipo%20%2F%20A");
  });

  it.each([0, 1, 2, 3, 6, 25])("handles %i products without filling sections with duplicate products", (count) => {
    const result = getHomepageMerchandising(catalog(Array.from({ length: count }, (_, index) => product(String(index), "Ordenadores", { featured: index % 3 === 0 }))));
    const selected = placements(result);
    expect(new Set(selected.map(({ id }) => id)).size).toBe(selected.length);
    expect(result.featured.length).toBeLessThanOrEqual(4);
    expect(result.discoveries.length).toBeLessThanOrEqual(4);
    expect(result.campaign?.products.length ?? 0).toBeLessThanOrEqual(3);
    expect(selected.length).toBeLessThanOrEqual(count);
    if (count === 0) expect(result.hero).toBeNull();
  });

  it("returns no merchandising at all for an error, never substitutes demo fixtures", () => {
    expect(getHomepageMerchandising({ source: "error", products: [], categories: [], message: "Read error" })).toEqual({
      hero: null, featured: [], discoveries: [], categories: [], campaign: null,
      totalProducts: 0, hasExplicitNovelties: false,
    });
  });
});
