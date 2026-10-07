import { describe, expect, it } from "vitest";
import { demoProducts } from "@/lib/catalog";
import { rankCatalogProducts, searchCatalogProducts } from "@/lib/search";

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
});
