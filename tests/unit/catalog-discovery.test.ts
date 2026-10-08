import { describe, expect, it } from "vitest";
import { changeCatalogParam, discoverCatalog } from "@/components/storefront/catalog/discovery";
import { mapCatalogRows, type CatalogRows } from "@/lib/catalog-mapping";

const rootId = "category-computers";
const leafId = "category-laptops";

function rows(): CatalogRows {
  return {
    products: [{
      id: "product-laptop", slug: "portatil-academico", sku: "NOD-LAP-1", name: "Portátil académico",
      brand: "Marca A", summary: "Equipo de estudio", description: "", image_url: null, image_alt: "",
      badge: null, is_featured: false, is_published: true,
    }],
    categories: [
      { id: rootId, slug: "ordenadores", name: "Ordenadores", description: "Equipos", sort_order: 10, parent_id: null, is_active: true },
      { id: leafId, slug: "portatiles", name: "Portátiles", description: "Portátiles", sort_order: 100, parent_id: rootId, is_active: true },
      { id: "inactive", slug: "retired", name: "Retirada", description: "", sort_order: 101, parent_id: rootId, is_active: false },
    ],
    productCategories: [{ product_id: "product-laptop", category_id: rootId }, { product_id: "product-laptop", category_id: leafId }],
    variants: [{ id: "variant-laptop", product_id: "product-laptop", sku: "NOD-LAP-1", title: "16 GB", current_price: "899", compare_at_price: null, currency: "EUR", is_active: true }],
    specifications: [
      { product_id: "product-laptop", label: "Memoria", value: "16 GB", sort_order: 1 },
      { product_id: "product-laptop", label: "Pantalla", value: "14 pulgadas", sort_order: 2 },
    ],
  };
}

describe("catalog discovery integration contract", () => {
  it("retains category hierarchy and product memberships from repository rows", () => {
    const mapped = mapCatalogRows(rows());
    expect(mapped.categories.find((category) => category.id === leafId)).toMatchObject({ name: "Portátiles", parentId: rootId });
    expect(mapped.categories.some((category) => category.id === "inactive")).toBe(false);
    expect(mapped.products[0]).toMatchObject({ category: "Ordenadores", categoryIds: [rootId, leafId] });

    const result = discoverCatalog(mapped.products, mapped.categories, new URLSearchParams("categoria=portatiles"), "supabase");
    expect(result.results.map(({ id }) => id)).toEqual(["product-laptop"]);
    expect(result.categoryOptions.find(({ slug }) => slug === "portatiles")).toMatchObject({ selected: true, count: 1, depth: 1 });
  });

  it("keeps unrelated query parameters while applying multi-value facets", () => {
    const current = new URLSearchParams("q=portatil&orden=precio-asc&marca=Marca+A");
    const next = new URL(changeCatalogParam(current, "marca", "Marca B", true), "https://nodria.test").searchParams;
    expect(next.get("q")).toBe("portatil");
    expect(next.get("orden")).toBe("precio-asc");
    expect(next.getAll("marca")).toEqual(["Marca A", "Marca B"]);
  });

  it("does not expose stock facets in connected mode and ignores malformed bounds safely", () => {
    const mapped = mapCatalogRows(rows());
    const result = discoverCatalog(mapped.products, mapped.categories, new URLSearchParams("disponibilidad=en-stock&min=NaN&max=-1"), "supabase");
    expect(result.results).toHaveLength(1);
    expect(result.facets.some(({ key }) => key === "disponibilidad")).toBe(false);
    expect(result.notices).toHaveLength(2);
  });

  it("keeps technical selections active while counting matching categories", () => {
    const mapped = mapCatalogRows(rows());
    const result = discoverCatalog(mapped.products, mapped.categories, new URLSearchParams("categoria=portatiles&spec.Memoria=32+GB"), "supabase");
    expect(result.results).toHaveLength(0);
    expect(result.categoryOptions.find(({ slug }) => slug === "portatiles")?.count).toBe(0);
  });
});
